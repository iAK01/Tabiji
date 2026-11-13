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

/** A fixed starting point (your hotel) instead of where you are — the app shows the whole route. */
export interface NavOrigin {
  name:         string;
  address?:     string;
  coordinates?: { lat: number; lng: number } | null;
}

/** Waze only ever routes from where you are. */
export const takesOrigin = (app: NavApp) => app !== 'waze';

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

/** Has a map point. Map apps only ever route to one — text makes them guess. */
export const isPinned = (dest: NavigationDestination) => !!latLng(dest);

/** What to search a map app for when a place has no pin: its name, then the address. */
export function searchText(dest: NavigationDestination): string {
  const name    = (dest.name ?? '').replace(/[\p{Extended_Pictographic}️‍]/gu, '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  const address = dest.address?.trim() ?? '';
  if (!name || address.toLowerCase().includes(name.toLowerCase())) return address || name;
  return address ? `${name}, ${address}` : name;
}

/** A search, never a route: the app shows what it found, for you to check before setting off. */
export function searchLink(dest: NavigationDestination, app: Exclude<NavApp, 'waze'>, platform: Platform): string {
  const q = encodeURIComponent(searchText(dest));
  if (app === 'apple_maps') return `${platform === 'ios' ? 'maps://' : 'https://maps.apple.com/'}?q=${q}`;
  return platform === 'ios' ? `comgooglemaps://?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`;
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
  origin?:  NavOrigin | null,
): string {
  const where = latLng(dest);
  const ios   = platform === 'ios';
  // No pin: a search the person checks, never a route to wherever the app guesses
  if (!where) {
    return app === 'waze'
      ? `${ios ? 'waze://' : 'https://waze.com/ul'}?q=${encodeURIComponent(searchText(dest))}`
      : searchLink(dest, app, platform);
  }
  // Directions from a set place (your hotel) rather than from where you are — only from its pin
  const from = intent === 'directions' && origin ? latLng(origin) : null;

  if (app === 'apple_maps') {
    const base = ios ? 'maps://' : 'https://maps.apple.com/';
    if (intent === 'view') return `${base}?ll=${where}&q=${encodeURIComponent(dest.name || dest.address || '')}`;
    return `${base}?${from ? `saddr=${from}&` : ''}daddr=${where}&dirflg=${APPLE_DIRFLG[mode]}`;
  }

  // Waze only drives, whatever mode is picked.
  if (app === 'waze') {
    const base = ios ? 'waze://' : 'https://waze.com/ul';
    return `${base}?ll=${where}${intent === 'directions' ? '&navigate=yes' : ''}`;
  }

  if (ios) {
    return intent === 'view'
      ? `comgooglemaps://?q=${where}`
      : `comgooglemaps://?${from ? `saddr=${from}&` : ''}daddr=${where}&directionsmode=${mode}`;
  }
  if (intent === 'view') return `https://www.google.com/maps/search/?api=1&query=${where}`;
  // From a set place: the route laid out to look over
  if (from) return `https://www.google.com/maps/dir/?api=1&origin=${from}&destination=${where}&travelmode=${mode}`;
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

// ─── Ride apps ────────────────────────────────────────────────────────────────
// Only Uber publishes a link that fills in the trip (developer.uber.com, deep links).
// The others just open, so the picker copies the address for pasting.

/** A pickup that isn't where you are now — null means "my location". */
export interface RidePickup { name?: string; coordinates: { lat: number; lng: number } }

const enc = encodeURIComponent;

export function uberLink(dest: NavigationDestination, pickup: RidePickup | null, platform: Platform): string {
  const c = latLng(dest) ? dest.coordinates! : null;

  if (platform !== 'desktop') {
    const q = ['action=setPickup'];
    if (pickup) {
      q.push(`pickup[latitude]=${pickup.coordinates.lat}`, `pickup[longitude]=${pickup.coordinates.lng}`);
      if (pickup.name) q.push(`pickup[nickname]=${enc(pickup.name)}`);
    } else {
      q.push('pickup=my_location');
    }
    if (c) q.push(`dropoff[latitude]=${c.lat}`, `dropoff[longitude]=${c.lng}`);
    if (dest.name)    q.push(`dropoff[nickname]=${enc(dest.name)}`);
    if (dest.address) q.push(`dropoff[formatted_address]=${enc(dest.address)}`);
    return `uber://?${q.join('&')}`;
  }

  // Uber's website (desktop, or the app isn't installed): places as JSON.
  const place = (p: { lat: number; lng: number }, line1?: string, line2?: string) =>
    enc(JSON.stringify({ latitude: p.lat, longitude: p.lng, addressLine1: line1 ?? '', addressLine2: line2 ?? '' }));
  const q: string[] = [];
  if (pickup) q.push(`pickup=${place(pickup.coordinates, pickup.name)}`);
  if (c)      q.push(`drop[0]=${place(c, dest.name, dest.address)}`);
  return `https://m.uber.com/looking${q.length ? `?${q.join('&')}` : ''}`;
}
