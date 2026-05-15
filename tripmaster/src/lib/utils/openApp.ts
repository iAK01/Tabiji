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

  if (!isMobile || !config.deepLink) {
    window.open(config.webUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  const storeUrl = isIOS ? config.iosStore : config.androidStore;

  if (storeUrl) {
    window.location.href = config.deepLink;
    const start = Date.now();
    setTimeout(() => {
      if (Date.now() - start < 2000) {
        window.location.href = storeUrl;
      }
    }, 800);
    return;
  }

  window.location.href = config.deepLink;
}
