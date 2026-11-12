import { Resend } from 'resend';

// Resend receives the forwarded emails (Tabiji's own account, not Avandra's) and
// calls /api/inbound/email. The webhook only says one arrived; its body and
// attachments are fetched from here.

let client: Resend | null = null;
export function resend(): Resend {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
  client ??= new Resend(process.env.RESEND_API_KEY);
  return client;
}

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export interface ReceivedEmail {
  id:       string;
  from:     string;
  to:       string[];
  subject:  string;
  date:     string;
  html:     string | null;
  text:     string | null;
  headers:  Record<string, string>;
}

export interface ReceivedAttachment {
  name:      string;
  mimeType:  string;
  inline:    boolean;
  contentId: string | null;
  buffer:    Buffer | null;   // null when too big or the download failed
  error?:    string;
}

export async function fetchEmail(emailId: string): Promise<ReceivedEmail> {
  // Inline images stay as cid: references rather than megabytes of base64 in the HTML.
  const { data, error } = await resend().emails.receiving.get(emailId, { html_format: 'cid' });
  if (error || !data) throw new Error(`Couldn't fetch the email from Resend: ${error?.message ?? 'no data'}`);
  return {
    id:      data.id,
    from:    data.from,
    to:      data.to ?? [],
    subject: data.subject ?? '',
    date:    data.created_at,
    html:    data.html,
    text:    data.text,
    headers: data.headers ?? {},
  };
}

export async function fetchAttachments(emailId: string): Promise<ReceivedAttachment[]> {
  const out: ReceivedAttachment[] = [];
  let after: string | undefined;
  for (let page = 0; page < 10; page++) {
    const { data, error } = await resend().emails.receiving.attachments.list({ emailId, limit: 100, ...(after ? { after } : {}) });
    if (error || !data) throw new Error(`Couldn't list the email's attachments: ${error?.message ?? 'no data'}`);
    for (const a of data.data) {
      const base = {
        name:      a.filename || 'attachment',
        mimeType:  a.content_type || 'application/octet-stream',
        inline:    a.content_disposition === 'inline',
        contentId: a.content_id ?? null,
      };
      if (a.size > MAX_ATTACHMENT_BYTES) { out.push({ ...base, buffer: null, error: 'too big' }); continue; }
      try {
        const res = await fetch(a.download_url);
        if (!res.ok) throw new Error(`download failed (${res.status})`);
        out.push({ ...base, buffer: Buffer.from(await res.arrayBuffer()) });
      } catch (err: any) {
        out.push({ ...base, buffer: null, error: err?.message ?? 'download failed' });
      }
    }
    if (!data.has_more || !data.data.length) break;
    after = data.data[data.data.length - 1].id;
  }
  return out;
}

/** "Name <a@b.c>" → "a@b.c" */
export function addressOf(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim().toLowerCase();
}
