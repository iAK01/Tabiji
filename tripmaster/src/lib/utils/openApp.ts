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

  // Mobile with a confirmed deep link scheme
  if (config.deepLink) {
    const storeUrl = isIOS ? config.iosStore : config.androidStore;
    window.location.href = config.deepLink;

    if (storeUrl) {
      let appOpened = false;
      const markOpened = () => { appOpened = true; };
      // window.blur fires the moment iOS hands focus to the opened app — more
      // reliable than document.hidden for custom URL scheme redirects.
      window.addEventListener('blur', markOpened, { once: true });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) markOpened();
      }, { once: true });

      setTimeout(() => {
        window.removeEventListener('blur', markOpened);
        if (!appOpened) window.location.href = storeUrl;
      }, 800);
    }
    return;
  }

  // Mobile with no deep link: go to the store page if available.
  // The App Store / Play Store shows an "Open" button when the app is already installed,
  // which launches it directly. Better than opening the website in a browser.
  const storeUrl = isIOS ? config.iosStore : config.androidStore;
  window.location.href = storeUrl ?? config.webUrl;
}
