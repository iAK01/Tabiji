'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
export type NavApp  = 'apple_maps' | 'google_maps' | 'waze';
export type NavMode = 'walking' | 'driving' | 'transit';

export interface NavigationDestination {
  name?:        string;
  address?:     string;
  coordinates?: { lat: number; lng: number } | null;
}

export interface NavPreferences {
  walking:       NavApp;
  driving:       NavApp;
  transit:       NavApp;
  setupComplete: boolean;
}

const DEFAULTS: NavPreferences = {
  walking:       'google_maps',
  driving:       'google_maps',
  transit:       'google_maps',
  setupComplete: false,
};

// ─── Module-level cache so multiple NavigateButtons on the same page
//     only trigger one API call per session ─────────────────────────────────
let _cachedPrefs: NavPreferences | null = null;
let _fetchPromise: Promise<NavPreferences> | null = null;

async function fetchPreferences(): Promise<NavPreferences> {
  if (_cachedPrefs) return _cachedPrefs;
  if (!_fetchPromise) {
    _fetchPromise = fetch('/api/user/navigation-preferences')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        _cachedPrefs = { ...DEFAULTS, ...(data?.preferences ?? {}) };
        return _cachedPrefs!;
      })
      .catch(() => {
        _fetchPromise = null; // allow retry on error
        return DEFAULTS;
      });
  }
  return _fetchPromise;
}

function invalidateCache() {
  _cachedPrefs   = null;
  _fetchPromise  = null;
}

// ─── Platform detection ───────────────────────────────────────────────────────
export function detectPlatform(): 'ios' | 'android' | 'desktop' {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua))          return 'android';
  return 'desktop';
}

// ─── URL builder ──────────────────────────────────────────────────────────────
// Strategy:
//   - Apple Maps:  native URL scheme on iOS; web fallback otherwise
//   - Waze:        native scheme on iOS/Android if coords available; web fallback
//   - Google Maps: always use universal https:// — redirects to app if installed,
//                  opens in browser if not. Avoids the "app not installed" dead end.
export function buildNavigationUrl(
  dest: NavigationDestination,
  app:  NavApp,
  mode: NavMode,
): string {
  const platform   = detectPlatform();
  const hasCoords  = !!(dest.coordinates?.lat != null && dest.coordinates?.lng != null);
  const lat        = dest.coordinates?.lat ?? 0;
  const lng        = dest.coordinates?.lng ?? 0;
  const query      = dest.address ?? dest.name ?? '';
  const encoded    = encodeURIComponent(query);

  // ── Apple Maps ─────────────────────────────────────────────────────────────
  if (app === 'apple_maps') {
    const dirflag   = mode === 'walking' ? 'w' : mode === 'transit' ? 'r' : 'd';
    const destParam = hasCoords ? `${lat},${lng}` : encoded;
    if (platform === 'ios') {
      return `maps://?daddr=${destParam}&dirflg=${dirflag}`;
    }
    // Non-iOS: Apple Maps web (good enough for desktop browsing)
    return `https://maps.apple.com/?daddr=${destParam}&dirflg=${dirflag}`;
  }

  // ── Waze ───────────────────────────────────────────────────────────────────
  if (app === 'waze') {
    if (hasCoords && (platform === 'ios' || platform === 'android')) {
      return `waze://?ll=${lat},${lng}&navigate=yes`;
    }
    if (hasCoords) {
      return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
    }
    return `https://waze.com/ul?q=${encoded}`;
  }

  // ── Google Maps (universal) ────────────────────────────────────────────────
  const travelmode = mode; // google accepts 'walking', 'driving', 'transit' as-is
  if (hasCoords) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=${travelmode}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=${travelmode}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useNavigation() {
  const [preferences, setPreferences] = useState<NavPreferences>(DEFAULTS);
  const [loading,     setLoading]     = useState(true);
  const [setupOpen,   setSetupOpen]   = useState(false);

  useEffect(() => {
    fetchPreferences().then(prefs => {
      setPreferences(prefs);
      setLoading(false);
    });
  }, []);

  const savePreferences = useCallback(async (incoming: Partial<NavPreferences>) => {
    const updated: NavPreferences = { ...preferences, ...incoming, setupComplete: true };
    setPreferences(updated);
    invalidateCache();
    _cachedPrefs = updated; // optimistically populate cache with new values
    await fetch('/api/user/navigation-preferences', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(updated),
    });
  }, [preferences]);

  const navigate = useCallback((dest: NavigationDestination, mode: NavMode = 'driving') => {
    if (!dest.address && !dest.coordinates) return;

    if (!preferences.setupComplete) {
      // Store intent so setup can navigate immediately on completion
      sessionStorage.setItem(
        '__nav_intent__',
        JSON.stringify({ dest, mode }),
      );
      setSetupOpen(true);
      return;
    }

    const app = preferences[mode];
    const url = buildNavigationUrl(dest, app, mode);
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [preferences]);

  // Called by NavigationPreferencesSetup after saving — fulfils deferred intent
  const onSetupComplete = useCallback((prefs: NavPreferences) => {
    setSetupOpen(false);
    const raw = sessionStorage.getItem('__nav_intent__');
    if (raw) {
      sessionStorage.removeItem('__nav_intent__');
      try {
        const { dest, mode } = JSON.parse(raw) as { dest: NavigationDestination; mode: NavMode };
        const app = prefs[mode];
        const url = buildNavigationUrl(dest, app, mode);
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch { /* ignore parse errors */ }
    }
  }, []);

  const canNavigate = useCallback((dest: NavigationDestination): boolean => {
    return !!(dest.address || dest.coordinates);
  }, []);

  return {
    navigate,
    canNavigate,
    preferences,
    savePreferences,
    loading,
    needsSetup:    !preferences.setupComplete,
    setupOpen,
    setSetupOpen,
    onSetupComplete,
    detectPlatform,
  };
}