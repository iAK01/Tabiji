// Client-side image compression — same technique already proven in FilesTab.tsx
// (resize + re-encode via canvas), extracted here so Expenses' several upload
// paths (quick capture, proof slots, generic receipt) can share one
// implementation instead of each re-inventing it.
//
// Governing rule: never lose the user's file. Every failure path here falls
// back to returning the original, untouched file rather than rejecting or
// dropping it — a failed compression is not a failed capture.
const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.85;

export function compressImageFile(file: File): Promise<File> {
  // Only images can be resized this way — PDFs and anything else pass through
  // completely untouched.
  if (!file.type.startsWith('image/')) return Promise.resolve(file);

  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.naturalWidth, h = img.naturalHeight;
      if (!w || !h) { resolve(file); return; }
      if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
        const r = Math.min(MAX_DIMENSION / w, MAX_DIMENSION / h);
        w = Math.round(w * r); h = Math.round(h * r);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => {
        if (!blob) { resolve(file); return; }
        const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
        resolve(new File([blob], `${base}.jpg`, { type: 'image/jpeg' }));
      }, 'image/jpeg', JPEG_QUALITY);
    };
    // Decode failure — most likely a HEIC file delivered by a non-WebKit browser
    // (Chrome/Firefox/Android can't decode HEIC; every iOS browser can, since
    // they're all WebKit under the hood, so this mainly matters off-iOS). Either
    // way: fall back to the original file rather than losing the capture.
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}
