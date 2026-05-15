export interface AppLaunchConfig {
  deepLink?:     string;
  iosStore?:     string;
  androidStore?: string;
  webUrl:        string;
}

export function openApp(config: AppLaunchConfig): void {
  const ua        = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS     = /iPhone|iPad|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isMobile  = isIOS || isAndroid;

  // Desktop: open in new tab, no deep link logic needed
  if (!isMobile) {
    window.open(config.webUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  // Mobile with a confirmed deep link: just fire it. No fallback timer — detecting
  // whether the app opened is unreliable across iOS versions and PWA contexts, and
  // the user has explicitly selected this app so it should be installed.
  if (config.deepLink) {
    window.location.href = config.deepLink;
    return;
  }

  // Mobile with no deep link: go to the store page if available.
  // App Store / Play Store shows an "Open" button when the app is installed.
  const storeUrl = isIOS ? config.iosStore : config.androidStore;
  window.location.href = storeUrl ?? config.webUrl;
}
