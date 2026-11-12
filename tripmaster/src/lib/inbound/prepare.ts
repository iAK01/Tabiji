import PostalMime from 'postal-mime';
import { strFromU8 } from 'fflate';
import {
  MAX_TEXT_CHARS, CLAUDE_IMAGE_TYPES, bestMime, simplifyHtml, toClaudeInput, zipEntries, type Resolved,
} from '@/lib/extract/sources';
import type { ReceivedAttachment, ReceivedEmail } from './resend';

// A forwarded email, laid out for reading: the traveller's own note, the email
// itself, and every attachment numbered and turned into something Claude reads
// (text, a PDF, an image) — whatever kind of file it is. Emails attached to the
// email (Outlook forwards that way) are opened up, one level down.

export interface PreparedAttachment {
  index:       number;
  name:        string;
  mimeType:    string;
  inline:      boolean;
  buffer:      Buffer;
  readable:    Resolved | null;
  unreadable?: string;                              // why Claude can't see it
  pass?:       { format: string; text: string };    // a Wallet pass's barcode
}

export interface PreparedEmail {
  note:        string;   // what the traveller typed above the forwarded message
  body:        string;   // the whole email as Claude reads it
  attachments: PreparedAttachment[];
}

// Where a forwarded message starts (Gmail, Apple Mail, Outlook, Outlook web).
const FORWARD_MARKERS = [
  /^-{2,}\s*Forwarded message\s*-{2,}/im,
  /^Begin forwarded message:/im,
  /^-{2,}\s*Original Message\s*-{2,}/im,
  /^_{10,}\s*$\s*^From:/im,
  /^From:\s.+\n(?:.*\n){0,2}?(?:Sent|Date):\s/im,
];

function plain(htmlOrText: string): string {
  return htmlOrText
    .replace(/<a href="([^"]*)">([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<\/(p|tr|li|h\d|table|br)>|<br>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

/** The traveller's own words above a forwarded message; "" when it isn't a forward or they wrote nothing. */
export function forwardNote(text: string): string {
  let cut = -1;
  for (const re of FORWARD_MARKERS) {
    const m = re.exec(text);
    if (m && (cut < 0 || m.index < cut)) cut = m.index;
  }
  if (cut <= 0) return '';
  return text.slice(0, cut)
    .split('\n')
    // Signatures and "Sent from my iPhone" aren't an instruction.
    .filter(l => !/^(sent from my|get outlook for|--\s*$)/i.test(l.trim()))
    .join('\n')
    .trim()
    .slice(0, 2000);
}

const TRACKER_BYTES   = 1024;              // pixels and spacers
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;   // Claude's per-image limit
const MAX_READ_BYTES  = 18 * 1024 * 1024;  // PDFs + images in one request (base64 adds a third; the cap is 32 MB)
const MAX_IMAGES      = 40;

const PASS_FORMATS: Record<string, string> = {
  PKBarcodeFormatQR:      'QRCode',
  PKBarcodeFormatPDF417:  'PDF417',
  PKBarcodeFormatAztec:   'Aztec',
  PKBarcodeFormatCode128: 'Code128',
};

function passBarcode(buffer: Buffer): { format: string; text: string } | undefined {
  try {
    const raw = zipEntries(buffer)['pass.json'];
    if (!raw) return undefined;
    const pass = JSON.parse(strFromU8(raw));
    const code = (Array.isArray(pass.barcodes) ? pass.barcodes[0] : null) ?? pass.barcode;
    const format = PASS_FORMATS[code?.format];
    return format && typeof code?.message === 'string' && code.message ? { format, text: code.message } : undefined;
  } catch {
    return undefined;
  }
}

async function openEmail(buffer: Buffer): Promise<{ text: string; attachments: ReceivedAttachment[] }> {
  const mail = await PostalMime.parse(new Uint8Array(buffer), { attachmentEncoding: 'arraybuffer' });
  const from = mail.from && 'address' in mail.from && mail.from.address
    ? `${mail.from.name ? `${mail.from.name} ` : ''}<${mail.from.address}>` : '';
  const head = [
    from && `From: ${from}`,
    mail.date && `Date: ${mail.date}`,
    mail.subject && `Subject: ${mail.subject}`,
  ].filter(Boolean).join('\n');
  const body = mail.html ? simplifyHtml(mail.html) : (mail.text ?? '');
  return {
    text: `${head}\n\n${body}`.slice(0, MAX_TEXT_CHARS),
    attachments: mail.attachments.map(a => ({
      name:      a.filename || 'attachment',
      mimeType:  a.mimeType || 'application/octet-stream',
      inline:    a.disposition === 'inline' || !!a.related,
      contentId: a.contentId ?? null,
      buffer:    typeof a.content === 'string' ? Buffer.from(a.content) : Buffer.from(a.content as ArrayBuffer),
    })),
  };
}

export async function prepareEmail(email: ReceivedEmail, received: ReceivedAttachment[]): Promise<PreparedEmail> {
  const html = email.html ? simplifyHtml(email.html) : '';
  const body = (html || email.text || '').slice(0, MAX_TEXT_CHARS);
  const note = forwardNote(email.text?.trim() ? email.text : plain(html));

  const attachments: PreparedAttachment[] = [];
  const extraText: string[] = [];
  let readBytes = 0;
  let images = 0;

  const add = async (a: ReceivedAttachment, depth: number) => {
    if (!a.buffer) {
      attachments.push({
        index: attachments.length, name: a.name, mimeType: a.mimeType, inline: a.inline,
        buffer: Buffer.alloc(0), readable: null, unreadable: a.error ?? 'could not be downloaded',
      });
      return;
    }
    const mimeType = bestMime(a.mimeType, a.name);
    if (mimeType.startsWith('image/') && a.buffer.length < TRACKER_BYTES) return;

    if (mimeType === 'message/rfc822' && depth === 0) {
      try {
        const inner = await openEmail(a.buffer);
        extraText.push(`ATTACHED EMAIL "${a.name}":\n"""\n${inner.text}\n"""`);
        for (const child of inner.attachments) await add(child, depth + 1);
        return;
      } catch { /* fall through: kept as an unreadable file */ }
    }

    const item: PreparedAttachment = {
      index: attachments.length, name: a.name, mimeType, inline: a.inline, buffer: a.buffer, readable: null,
    };
    if (mimeType === 'application/vnd.apple.pkpass') item.pass = passBarcode(a.buffer);

    const binary = mimeType === 'application/pdf' || CLAUDE_IMAGE_TYPES.has(mimeType);
    if (CLAUDE_IMAGE_TYPES.has(mimeType) && a.buffer.length > MAX_IMAGE_BYTES) {
      item.unreadable = 'too big to read';
    } else if (CLAUDE_IMAGE_TYPES.has(mimeType) && images >= MAX_IMAGES) {
      item.unreadable = 'too many images in one email to read';
    } else if (binary && readBytes + a.buffer.length > MAX_READ_BYTES) {
      item.unreadable = 'too much in one email to read';
    } else {
      try {
        item.readable = await toClaudeInput({ kind: 'binary', buffer: a.buffer, mimeType, label: a.name });
        if (item.readable.kind === 'binary') readBytes += a.buffer.length;
        if (CLAUDE_IMAGE_TYPES.has(mimeType)) images++;
      } catch (err: any) {
        item.unreadable = err?.message ?? 'not a readable file type';
      }
    }
    attachments.push(item);
  };

  for (const a of received) await add(a, 0);

  return {
    note,
    body: [body, ...extraText].filter(Boolean).join('\n\n').slice(0, MAX_TEXT_CHARS),
    attachments,
  };
}
