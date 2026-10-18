// Finds the ticket barcode in an uploaded image (a boarding pass screenshot,
// say) and redraws it clean, so the app can show just the code — big, sharp,
// on white, offline. Server only.
//
// The redraw is kept only when it reads back as exactly the same payload: a
// scanner at the gate decodes the payload, so identical text is what makes the
// copy as good as the original.

import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { prepareZXingModule, readBarcodes, writeBarcode, type ReadResult } from 'zxing-wasm/full';
import { parseBcbp, type Bcbp } from './bcbp';

// What boarding passes, rail and event tickets use.
const TICKET_FORMATS = ['Aztec', 'QRCode', 'PDF417', 'DataMatrix'] as const;
type TicketFormat = typeof TICKET_FORMATS[number];
const isTicketFormat = (f: string): f is TicketFormat => (TICKET_FORMATS as readonly string[]).includes(f);

export const SCANNABLE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface ScannedBarcode {
  format: string;
  text:   string;
  svg:    string;
  bcbp:   Bcbp | null;
}

// The package fetches its WebAssembly from a CDN unless handed it; use the
// installed copy, falling back to the CDN when it isn't on disk. A plain file
// path, not require.resolve: the bundler would try to import the .wasm.
const WASM_PATH = join(process.cwd(), 'node_modules', 'zxing-wasm', 'dist', 'full', 'zxing_full.wasm');

let ready: Promise<unknown> | null = null;
function prepare() {
  ready ??= (async () => {
    try {
      const file = await readFile(WASM_PATH);
      const wasmBinary = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
      await prepareZXingModule({ overrides: { wasmBinary }, fireImmediately: true });
    } catch { /* CDN copy */ }
  })();
  return ready;
}

export async function scanTicket(image: Uint8Array): Promise<ScannedBarcode | null> {
  try {
    await prepare();
    const found = (await readBarcodes(image, { formats: [...TICKET_FORMATS], tryHarder: true, maxNumberOfSymbols: 4 }))
      .filter(r => r.isValid && r.text);
    // A boarding pass if there is one; otherwise the biggest code on the page.
    const pick = found.find(r => parseBcbp(r.text)) ?? found.sort((a, b) => area(b) - area(a))[0];
    if (!pick || !isTicketFormat(pick.format)) return null;
    const format = pick.format;

    const drawn = await writeBarcode(pick.text, { format, scale: 4 });
    if (drawn.error || !drawn.svg || !drawn.image) return null;
    const back = await readBarcodes(new Uint8Array(await drawn.image.arrayBuffer()), { formats: [format] });
    if (back[0]?.text !== pick.text) return null;

    const svg = scalable(drawn.svg);
    if (!svg) return null;
    return { format, text: pick.text, svg, bcbp: parseBcbp(pick.text) };
  } catch {
    return null;   // not an image it can read (HEIC, corrupt) — no barcode
  }
}

// The writer's SVG has a fixed size and no viewBox, so it wouldn't scale up to
// fill a phone screen. Give it one, and keep the module edges hard.
function scalable(svg: string): string | null {
  const start = svg.indexOf('<svg');
  const size  = svg.slice(start).match(/^<svg width="(\d+)" height="(\d+)"/);
  if (start < 0 || !size) return null;
  return `<svg viewBox="0 0 ${size[1]} ${size[2]}" shape-rendering="crispEdges"` + svg.slice(start + '<svg'.length);
}

function area(r: ReadResult): number {
  const p = r.position;
  return Math.abs((p.topRight.x - p.topLeft.x) * (p.bottomLeft.y - p.topLeft.y));
}
