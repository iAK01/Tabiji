// Every write the user makes ends one of three ways: saved, queued offline (and shown as
// waiting to sync), or a visible error with their input kept. Never a silent drop — an
// item that looks saved and then vanishes costs more trust than any error message.

export class SaveError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'SaveError';
  }
}

/**
 * Reads a write's JSON response, throwing SaveError unless it's a 2xx with a body.
 * Route handlers without a try/catch answer an unhandled throw with an empty 500, and a
 * 4xx carries { error } instead of the data the caller expects — so neither res.json()
 * alone nor `data.x ?? …` is a safe check that the write landed.
 */
export async function readSaved<T = any>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (res.ok && body != null) return body as T;
  throw new SaveError(typeof body?.error === 'string' ? body.error : '', res.status);
}

/** Throws SaveError unless the response is a 2xx — for writes whose body the caller doesn't use. */
export function assertSaved(res: Response) {
  if (!res.ok) throw new SaveError('', res.status);
}

export const SAVE_FAILED_EVENT = 'tabiji:save-failed';

function reason(err: unknown): string {
  if (err instanceof SaveError) {
    if (err.status === 401) return 'You’ve been signed out — sign in again, then retry.';
    if (err.message)        return `${err.message}. Please try again.`;
  }
  return 'Please try again.';
}

/**
 * Shows the app-wide save-failed toast (SaveErrorToast, mounted in the root layout).
 * `what` names the thing that didn't save, e.g. `"Neck pillow"` or `your trip details`.
 */
export function reportSaveFailure(what: string, err?: unknown) {
  if (err) console.error(`[save failed] ${what}`, err);
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SAVE_FAILED_EVENT, {
    detail: `Couldn’t save ${what}. ${reason(err)}`,
  }));
}

/** For a change the app can't save at all — shown verbatim, nothing is changed on screen. */
export function reportCantSave(message: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SAVE_FAILED_EVENT, { detail: message }));
}

/** For a change queued offline that the server later rejected for good. */
export function reportSyncRejected(what: string, status: number) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SAVE_FAILED_EVENT, {
    detail: `A change you made offline couldn’t be saved: ${what}. The server rejected it (${status}) — please make it again.`,
  }));
}
