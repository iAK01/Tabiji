// Turning whatever the traveller hands us into something Claude can read.
// Shared by Smart Extract (one file, a note, pasted text) and the email intake
// (a forwarded email with any number of attachments of any kind).

import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { unzipSync, strFromU8 } from 'fflate';

export const MAX_TEXT_CHARS     = 200_000;
export const CLAUDE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

// Normalised to either readable text or a binary Claude takes natively (PDF, image).
export type Resolved =
  | { kind: 'text'; text: string; label: string }
  | { kind: 'binary'; buffer: Buffer; mimeType: string; label: string };

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function mimeFromName(name: string): string | null {
  const ext = name.toLowerCase().split('?')[0].split('.').pop() ?? '';
  const map: Record<string, string> = {
    pdf:  'application/pdf',
    jpg:  'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
    heic: 'image/heic', heif: 'image/heif',
    docx: DOCX,
    doc:  'application/msword',
    xlsx: XLSX_MIME,
    xls:  'application/vnd.ms-excel',
    csv:  'text/csv',
    txt:  'text/plain',
    md:   'text/plain',
    ics:  'text/calendar',
    htm:  'text/html', html: 'text/html',
    json: 'application/json',
    xml:  'application/xml',
    eml:  'message/rfc822',
    zip:  'application/zip',
    pkpass: 'application/vnd.apple.pkpass',
  };
  return map[ext] ?? null;
}

/** The type to trust: a generic one from the sender loses to the file's extension. */
export function bestMime(mimeType: string | null | undefined, name: string | null | undefined): string {
  const declared = (mimeType ?? '').split(';')[0].trim().toLowerCase();
  const byName   = name ? mimeFromName(name) : null;
  if (!declared || declared === 'application/octet-stream' || declared === 'binary/octet-stream') {
    return byName ?? 'application/octet-stream';
  }
  // Some senders label a .csv as Excel, or a pass as a zip.
  if (byName && (byName === 'text/csv' || byName === 'application/vnd.apple.pkpass')) return byName;
  return declared;
}

export async function fetchBinary(url: string, mimeHint?: string, label = 'document'): Promise<Resolved> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch the file (${res.status})`);
  const buffer   = Buffer.from(await res.arrayBuffer());
  const mimeType = mimeHint
    ?? res.headers.get('content-type')?.split(';')[0]?.trim()
    ?? mimeFromName(url)
    ?? 'application/octet-stream';
  return { kind: 'binary', buffer, mimeType, label };
}

/**
 * Email HTML cut down to what carries meaning: text, tables (schedules are
 * often laid out in them), lists and links with their addresses. Styles,
 * scripts, images and layout attributes go.
 */
export function simplifyHtml(html: string): string {
  let s = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(head|style|script|noscript|svg|title)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<img\b[^>]*?\balt\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/gi, (_m, a, b) => {
      const alt = (a ?? b ?? '').trim();
      return alt ? ` [image: ${alt}] ` : ' ';
    })
    .replace(/<img\b[^>]*>/gi, ' ')
    .replace(/<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/gi, (_m, a, b) => `<a href="${a ?? b ?? ''}">`)
    .replace(/<(?!a\b)(\/?[a-zA-Z][a-zA-Z0-9:]*)\b[^>]*>/g, '<$1>')
    .replace(/<\/?(span|font|center|div|tbody|thead|tfoot|o:p|u|b|strong|em|i|small|big|sup|sub|section|article|header|footer|main|body|html)>/gi, ' ')
    .replace(/&nbsp;|&#160;|&zwnj;|&#8204;|‌| /gi, ' ')
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n');
  // Layout tables leave nests of empty cells behind.
  for (let i = 0; i < 6; i++) {
    const next = s.replace(/<(td|th|tr|table|p|li|ul|ol|h\d|a href="[^"]*")>\s*<\/(td|th|tr|table|p|li|ul|ol|h\d|a)>/gi, ' ');
    if (next === s) break;
    s = next;
  }
  return s.replace(/[ ]{2,}/g, ' ').trim();
}

/** Text files inside a zip (or a Wallet pass, which is one), joined for reading. */
const ZIP_TEXT = /\.(json|txt|ics|csv|html?|md|xml|strings)$/i;

export function zipEntries(buffer: Buffer): Record<string, Uint8Array> {
  return unzipSync(new Uint8Array(buffer));
}

function zipText(buffer: Buffer): string {
  const entries = zipEntries(buffer);
  const parts: string[] = [];
  for (const [name, data] of Object.entries(entries)) {
    if (name.endsWith('/') || name.startsWith('__MACOSX')) continue;
    // A pass's translations repeat its labels in every language: English, or the untranslated base, is enough.
    if (/\.lproj\//i.test(name) && !/^(en|base)[^/]*\.lproj\//i.test(name)) continue;
    if (!ZIP_TEXT.test(name) || data.length > 2_000_000) {
      parts.push(`### ${name} (not readable as text)`);
      continue;
    }
    parts.push(`### ${name}\n${strFromU8(data)}`);
  }
  return parts.join('\n\n');
}

// Turn a resolved binary into text where Claude can't read the format natively.
export async function toClaudeInput(r: Resolved): Promise<Resolved> {
  if (r.kind === 'text') return r;

  const { mimeType, buffer, label } = r;

  if (mimeType === 'application/pdf' || CLAUDE_IMAGE_TYPES.has(mimeType)) return r;

  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    throw new Error('HEIC images can’t be read directly — take a screenshot or convert it to JPEG first.');
  }

  if (mimeType === DOCX || mimeType === 'application/msword') {
    const { value } = await mammoth.extractRawText({ buffer });
    return { kind: 'text', text: value.slice(0, MAX_TEXT_CHARS), label };
  }

  if (mimeType === XLSX_MIME || mimeType === 'application/vnd.ms-excel') {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const text = wb.SheetNames
      .map(name => `### Sheet: ${name}\n${XLSX.utils.sheet_to_csv(wb.Sheets[name])}`)
      .join('\n\n')
      .slice(0, MAX_TEXT_CHARS);
    return { kind: 'text', text, label };
  }

  if (mimeType === 'text/html') {
    return { kind: 'text', text: simplifyHtml(buffer.toString('utf-8')).slice(0, MAX_TEXT_CHARS), label };
  }

  if (mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType === 'application/xml') {
    return { kind: 'text', text: buffer.toString('utf-8').slice(0, MAX_TEXT_CHARS), label };
  }

  if (mimeType === 'application/zip' || mimeType === 'application/vnd.apple.pkpass' || mimeType === 'application/x-zip-compressed') {
    return { kind: 'text', text: zipText(buffer).slice(0, MAX_TEXT_CHARS), label };
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}
