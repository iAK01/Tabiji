'use client';

import { createContext, useContext, useState } from 'react';
import { useSearchParams } from 'next/navigation';

// The trip page keeps every tab you've opened loaded, hidden while you're on
// another one. False inside a hidden tab; true everywhere else.
export const TabActiveContext = createContext(true);

export function useTabActive(): boolean {
  return useContext(TabActiveContext);
}

// useSearchParams for a tab. While it's hidden it sees the address as it was when
// you left it: another tab's ?day or ?view isn't its own and mustn't move it.
// Back on screen, it sees the address as it is.
export function useTabSearchParams() {
  const live   = useSearchParams();
  const active = useTabActive();
  const [held, setHeld] = useState({ active, params: live });
  if (held.active !== active) setHeld({ active, params: live });
  return active ? live : held.params;
}
