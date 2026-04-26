import { putPinnedFile, getPinnedFile, deletePinnedFile, getPinnedFileIdsByTrip } from './db';

export type { PinnedFile } from './db';

export async function cacheFile(file: {
  _id:      string;
  tripId:   string;
  name:     string;
  type:     string;
  mimeType?: string;
  gcsUrl:   string;
}): Promise<void> {
  try {
    const resp = await fetch(file.gcsUrl);
    if (!resp.ok) return;
    const blob = await resp.blob();
    await putPinnedFile({
      id:       file._id,
      tripId:   file.tripId,
      name:     file.name,
      type:     file.type,
      mimeType: file.mimeType ?? blob.type,
      blob,
      cachedAt: Date.now(),
    });
  } catch {
    // Fail silently — offline or fetch error
  }
}

export async function uncacheFile(id: string): Promise<void> {
  await deletePinnedFile(id);
}

export async function getFileUrl(
  id: string,
  fallbackUrl: string,
): Promise<{ url: string; isOffline: boolean }> {
  const pinned = await getPinnedFile(id);
  if (pinned) {
    return { url: URL.createObjectURL(pinned.blob), isOffline: true };
  }
  return { url: fallbackUrl, isOffline: false };
}

export async function isFileCached(id: string): Promise<boolean> {
  const pinned = await getPinnedFile(id);
  return !!pinned;
}

export async function autoCacheTripFiles(
  tripId: string,
  files: Array<{ _id: string; resourceType: string; name: string; type: string; mimeType?: string; gcsUrl?: string }>,
): Promise<void> {
  const existing = await getPinnedFileIdsByTrip(tripId);
  const toCache  = files.filter(
    f => f.resourceType === 'file' && f.gcsUrl && !existing.has(f._id),
  );
  // Fire-and-forget in parallel, ignore failures
  await Promise.allSettled(
    toCache.map(f => cacheFile({ ...f, tripId, gcsUrl: f.gcsUrl! })),
  );
}
