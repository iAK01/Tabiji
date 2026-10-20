// ─── Map-app links ────────────────────────────────────────────────────────────
// Every Navigate button asks which app to use (NavigateOptions); notification buttons
// can't show a menu, so they open the same picker on /navigate.
//
// iPhone: each app opens through its own URL scheme — the one thing that reliably
// leaves a home-screen web app for the native app. Android: the apps' https links
// open the app when it's installed, the website when not. Desktop: the websites.

export type NavApp    = 'google_maps' | 'apple_maps' | 'waze';
export type NavMode   = 'walking' | 'driving' | 'transit';
/** 'directions' = route from where you are; 'view' = just show the place */
export type NavIntent = 'directions' | 'view';
export type Platform  = 'ios' | 'android' | 'desktop';

export interface NavigationDestination {
  name?:        string;
  address?:     string;
  coordinates?: { lat: number; lng: number } | null;
}

export const NAV_APP_LABEL: Record<NavApp, string> = {
  google_maps: 'Google Maps',
  apple_maps:  'Apple Maps',
  waze:        'Waze',
};

const APPLE_DIRFLG: Record<NavMode, string> = { walking: 'w', driving: 'd', transit: 'r' };

export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'ios';   // iPadOS reports itself as a Mac
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

/** Apple Maps has no Android app. */
export function navAppsFor(platform: Platform): NavApp[] {
  return platform === 'android' ? ['google_maps', 'waze'] : ['google_maps', 'apple_maps', 'waze'];
}

function latLng(dest: NavigationDestination): string | null {
  const c = dest.coordinates;
  return c && Number.isFinite(c.lat) && Number.isFinite(c.lng) ? `${c.lat},${c.lng}` : null;
}

export function canNavigate(dest: NavigationDestination, intent: NavIntent = 'directions'): boolean {
  return !!(latLng(dest) || dest.address || (intent === 'view' && dest.name));
}

/** What "Copy" puts on the clipboard: coordinates when we have them, else the address. */
export function copyableLocation(dest: NavigationDestination): { kind: 'coordinates' | 'address'; text: string } | null {
  const c = dest.coordinates;
  if (c && latLng(dest)) return { kind: 'coordinates', text: `${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}` };
  if (dest.address)      return { kind: 'address', text: dest.address };
  return null;
}

/** True when the link is an app URL scheme rather than a web page. */
export const isAppScheme = (href: string) => !/^https?:/.test(href);

export function navLink(
  dest:     NavigationDestination,
  app:      NavApp,
  mode:     NavMode,
  intent:   NavIntent,
  platform: Platform,
): string {
  const ll    = latLng(dest);
  const query = encodeURIComponent(dest.address || dest.name || '');
  const where = ll ?? query;
  const ios   = platform === 'ios';

  if (app === 'apple_maps') {
    const base = ios ? 'maps://' : 'https://maps.apple.com/';
    if (intent === 'view') return ll ? `${base}?ll=${ll}&q=${encodeURIComponent(dest.name || dest.address || '')}` : `${base}?q=${query}`;
    return `${base}?daddr=${where}&dirflg=${APPLE_DIRFLG[mode]}`;
  }

  // Waze only drives, whatever mode is picked.
  if (app === 'waze') {
    const base = ios ? 'waze://' : 'https://waze.com/ul';
    return `${base}?${ll ? `ll=${ll}` : `q=${query}`}${intent === 'directions' ? '&navigate=yes' : ''}`;
  }

  if (ios) {
    return intent === 'view'
      ? `comgooglemaps://?q=${where}`
      : `comgooglemaps://?daddr=${where}&directionsmode=${mode}`;
  }
  if (intent === 'view') return `https://www.google.com/maps/search/?api=1&query=${where}`;
  // dir_action=navigate goes straight into turn-by-turn; Google has none for transit.
  return `https://www.google.com/maps/dir/?api=1&destination=${where}&travelmode=${mode}${mode === 'transit' ? '' : '&dir_action=navigate'}`;
}

// ─── /navigate page ───────────────────────────────────────────────────────────

export function navigatePagePath(dest: NavigationDestination, mode: NavMode, tripId?: string): string {
  const p  = new URLSearchParams();
  const ll = latLng(dest);
  if (dest.name)    p.set('name', dest.name);
  if (dest.address) p.set('address', dest.address);
  if (ll)           p.set('ll', ll);
  p.set('mode', mode);
  if (tripId)       p.set('trip', tripId);
  return `/navigate?${p}`;
}

export function navigatePageParams(p: URLSearchParams): { destination: NavigationDestination; mode: NavMode; tripId: string | null } {
  const [lat, lng] = (p.get('ll') ?? '').split(',').map(Number);
  const mode       = p.get('mode');
  return {
    destination: {
      name:        p.get('name') ?? undefined,
      address:     p.get('address') ?? undefined,
      coordinates: Number.isFinite(lat) && Number.isFinite(lng) && p.get('ll') ? { lat, lng } : null,
    },
    mode:   mode === 'walking' || mode === 'transit' ? mode : 'driving',
    tripId: p.get('trip'),
  };
}
