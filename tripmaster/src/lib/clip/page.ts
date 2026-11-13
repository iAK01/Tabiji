import { lookup } from 'node:dns/promises';
import net from 'node:net';
import { simplifyHtml } from '@/lib/extract/sources';

// Reading a clipped page server-side. The address comes from the clipper, so
// only public web addresses are fetched — never this server's own network.

const MAX_BYTES = 3_000_000;
const MAX_TEXT  = 60_000;

function privateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 198 && (b === 18 || b === 19));
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return privateIp(v.slice(7));
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb');
}

async function assertPublic(u: URL) {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Not a web address');
  if (u.username || u.password) throw new Error('Not a plain web address');
  const addrs = await lookup(u.hostname, { all: true });
  if (!addrs.length || addrs.some(a => privateIp(a.address))) throw new Error('Not a public web address');
}

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
    if (size >= MAX_BYTES) { await reader.cancel().catch(() => {}); break; }
  }
  return Buffer.concat(chunks).toString('utf-8');
}

export interface ClippedPage {
  url:         string;
  title:       string;
  description: string;
  site:        string;
  jsonLd:      string;   // the page's own structured data (addresses, opening hours) as written
  text:        string;
}

function meta(html: string, key: string): string {
  const re = new RegExp(`<meta[^>]+(?:property|name)\\s*=\\s*["']${key}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  return tag?.match(/content\s*=\s*["']([^"']*)["']/i)?.[1]?.trim() ?? '';
}

const decode = (s: string) => s
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/** The page's readable content, or null when it can't be fetched (login wall, blocked, not HTML). */
export async function fetchPage(raw: string): Promise<ClippedPage | null> {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }

  for (let hop = 0; hop < 5; hop++) {
    try { await assertPublic(u); } catch { return null; }
    let res: Response;
    try {
      res = await fetch(u, {
        redirect: 'manual',
        signal:   AbortSignal.timeout(10_000),
        headers:  { 'User-Agent': 'Mozilla/5.0 (compatible; TabijiClipper/1.0)', Accept: 'text/html,application/xhtml+xml' },
      });
    } catch {
      return null;
    }
    const next = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && next) { u = new URL(next, u); continue; }
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) return null;

    const html = await readCapped(res);
    const title = decode(meta(html, 'og:title') || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '');
    const jsonLd = [...html.matchAll(/<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
      .map(m => m[1].trim()).join('\n').slice(0, 20_000);
    // Menus, footers and forms say nothing about the place.
    const body = html.replace(/<(nav|footer|aside|form|iframe)\b[\s\S]*?<\/\1>/gi, ' ');
    return {
      url:         u.toString(),
      title,
      description: decode(meta(html, 'og:description') || meta(html, 'description')),
      site:        decode(meta(html, 'og:site_name')) || u.hostname.replace(/^www\./, ''),
      jsonLd,
      text:        simplifyHtml(body).slice(0, MAX_TEXT),
    };
  }
  return null;
}
