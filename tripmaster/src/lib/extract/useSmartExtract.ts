'use client';

import { useCallback, useRef, useState } from 'react';
import type { ExtractedData } from '@/components/files/SmartExtractModal';

export interface SmartExtractSource {
  /** An existing TripFile (uploaded file OR saved note). */
  fileId?: string;
  /** A raw stored-file URL. */
  gcsUrl?: string;
  mimeType?: string;
  /** Pasted text / a note body typed in the editor. */
  text?: string;
  /** The traveller's one-line description of what the material is. */
  context?: string;
  /** Shown as the modal subtitle. */
  label?: string;
}

interface State {
  running: boolean;
  error:   string | null;
  result:  ExtractedData | null;
  label:   string;
}

const IDLE: State = { running: false, error: null, result: null, label: '' };

/**
 * Drives the Smart Extract flow from any entry point (file card, note card,
 * note editor, paste dialog).
 *
 *   const x = useSmartExtract(tripId);
 *   x.run(source);                       // kick it off
 *   {(x.running || x.error) && <SmartExtractProgress .../>}   // "AI is working" / failed
 *   {x.result && <SmartExtractModal .../>}                    // review + import
 */
export function useSmartExtract(tripId: string) {
  const [state, setState] = useState<State>(IDLE);
  const lastSource = useRef<SmartExtractSource | null>(null);

  const run = useCallback(async (source: SmartExtractSource) => {
    lastSource.current = source;
    setState({ ...IDLE, running: true, label: source.label ?? '' });
    try {
      const res = await fetch(`/api/trips/${tripId}/analyze-document`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          fileId:   source.fileId,
          gcsUrl:   source.gcsUrl,
          mimeType: source.mimeType,
          text:     source.text,
          context:  source.context,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Could not analyse that source.');
      setState({ running: false, error: null, result: data.extracted as ExtractedData, label: source.label ?? '' });
    } catch (err: any) {
      setState({ running: false, error: err?.message ?? 'Something went wrong.', result: null, label: source.label ?? '' });
    }
  }, [tripId]);

  const retry = useCallback(() => {
    if (lastSource.current) run(lastSource.current);
  }, [run]);

  const reset = useCallback(() => setState(IDLE), []);

  return { run, retry, reset, ...state };
}
