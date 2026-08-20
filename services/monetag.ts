// Monetag Ad Service — Telegram Mini App SDK
// Current publisher snippet:
// <script src='//libtl.com/sdk.js' data-zone='11613357' data-sdk='show_11613357'></script>
import { supabase } from '@/services/supabase';

export const MONETAG_ZONE_ID = process.env.EXPO_PUBLIC_MONETAG_ZONE_ID || '11613357';
export const MONETAG_SDK_FUNCTION = `show_${MONETAG_ZONE_ID}`;
export const MONETAG_SCRIPT_URL = 'https://libtl.com/sdk.js';

const MONETAG_SCRIPT_ID = 'mintgrow-monetag-tma-sdk';
const SDK_LOAD_TIMEOUT_MS = 15000;
const SDK_READY_TIMEOUT_MS = 5000;
const SDK_POLL_INTERVAL_MS = 250;

type MonetagAdFormat = 'rewarded' | 'popup' | 'inApp';
type MonetagShowFunction = (...args: unknown[]) => Promise<unknown> | unknown;
type MonetagErrorReason =
  | 'browser_unavailable'
  | 'telegram_webview_required'
  | 'zone_not_configured'
  | 'sdk_unavailable'
  | 'sdk_load_error'
  | 'sdk_timeout'
  | 'show_function_missing'
  | 'ad_rejected'
  | 'ad_unavailable'
  | 'ad_bridge_unavailable';

export interface AdResult {
  watched: boolean;
  error?: string;
  reason?: MonetagErrorReason;
}

export interface MonetagConfig {
  zoneId: string;
  sdkFunction: string;
  scriptUrl: string;
}

export interface MonetagLoadResult {
  success: boolean;
  config: MonetagConfig;
  reason?: MonetagErrorReason;
  error?: string;
}

export interface MonetagShowResult extends AdResult {
  success: boolean;
}

// Callbacks set by the MonetazAdWebView component for non-web/native fallback only.
let _resolveAd: ((result: AdResult) => void) | null = null;
let _showAdTrigger: (() => void) | null = null;
let monetagSdkPromise: Promise<MonetagLoadResult> | null = null;
let monetagSdkFailed = false;

const getConfig = (): MonetagConfig => ({
  zoneId: MONETAG_ZONE_ID,
  sdkFunction: MONETAG_SDK_FUNCTION,
  scriptUrl: MONETAG_SCRIPT_URL,
});

const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';

const getWindowRecord = (): Record<string, unknown> | null => (
  typeof window === 'undefined' ? null : window as unknown as Record<string, unknown>
);

const getShowFunction = (): MonetagShowFunction | null => {
  const win = getWindowRecord();
  const showFn = win?.[MONETAG_SDK_FUNCTION];
  return typeof showFn === 'function' ? showFn as MonetagShowFunction : null;
};

const isTelegramWebView = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean((window as unknown as { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp);
};

const findExistingScript = (): HTMLScriptElement | null => {
  if (!isBrowser()) return null;
  return document.getElementById(MONETAG_SCRIPT_ID) as HTMLScriptElement | null
    || document.querySelector(`script[src*="libtl.com/sdk.js"][data-zone="${MONETAG_ZONE_ID}"]`) as HTMLScriptElement | null
    || document.querySelector(`script[data-sdk="${MONETAG_SDK_FUNCTION}"]`) as HTMLScriptElement | null;
};

const waitForShowFunction = (timeoutMs: number): Promise<boolean> => new Promise((resolve) => {
  if (getShowFunction()) {
    resolve(true);
    return;
  }

  const startedAt = Date.now();
  const interval = setInterval(() => {
    if (getShowFunction()) {
      clearInterval(interval);
      resolve(true);
      return;
    }

    if (Date.now() - startedAt >= timeoutMs) {
      clearInterval(interval);
      resolve(false);
    }
  }, SDK_POLL_INTERVAL_MS);
});

export const isMonetagAvailable = (): boolean => isBrowser() && Boolean(getShowFunction());

export const loadMonetagSdk = async (options: { requireTelegramWebView?: boolean; retry?: boolean } = {}): Promise<MonetagLoadResult> => {
  const config = getConfig();

  if (!isBrowser()) {
    return { success: false, config, reason: 'browser_unavailable', error: 'Browser runtime is unavailable.' };
  }

  if (!config.zoneId) {
    return { success: false, config, reason: 'zone_not_configured', error: 'Monetag zone is not configured.' };
  }

  if (options.requireTelegramWebView && !isTelegramWebView()) {
    return { success: false, config, reason: 'telegram_webview_required', error: 'Telegram WebView is required for Monetag TMA ads.' };
  }

  if (getShowFunction()) {
    return { success: true, config };
  }

  if (monetagSdkPromise && !(options.retry && monetagSdkFailed)) {
    return monetagSdkPromise;
  }

  monetagSdkFailed = false;
  monetagSdkPromise = new Promise<MonetagLoadResult>((resolve) => {
    const existingScript = findExistingScript();
    const script = existingScript || document.createElement('script');
    let settled = false;

    const settle = (result: MonetagLoadResult) => {
      if (settled) return;
      settled = true;
      if (!result.success) monetagSdkFailed = true;
      resolve(result);
    };

    const timeout = setTimeout(() => {
      settle({ success: false, config, reason: 'sdk_timeout', error: 'Monetag SDK timed out while loading.' });
    }, SDK_LOAD_TIMEOUT_MS);

    const checkReady = async () => {
      const ready = await waitForShowFunction(SDK_READY_TIMEOUT_MS);
      clearTimeout(timeout);
      settle(ready
        ? { success: true, config }
        : { success: false, config, reason: 'show_function_missing', error: `Monetag SDK did not expose ${config.sdkFunction}.` });
    };

    script.id = script.id || MONETAG_SCRIPT_ID;
    script.src = config.scriptUrl;
    script.async = true;
    script.setAttribute('data-zone', config.zoneId);
    script.setAttribute('data-sdk', config.sdkFunction);
    script.setAttribute('data-mintgrow-monetag', 'true');

    script.addEventListener('load', checkReady, { once: true });
    script.addEventListener('error', () => {
      clearTimeout(timeout);
      settle({ success: false, config, reason: 'sdk_load_error', error: 'Monetag SDK failed to load.' });
    }, { once: true });

    if (existingScript) {
      void checkReady();
    } else {
      document.head.appendChild(script);
    }
  });

  return monetagSdkPromise;
};

const getAdArgs = (format: MonetagAdFormat): unknown[] => {
  if (format === 'popup') return ['pop'];
  if (format === 'inApp') return [{ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } }];
  return [];
};

export const showMonetagAd = async (format: MonetagAdFormat = 'rewarded'): Promise<MonetagShowResult> => {
  const loaded = await loadMonetagSdk({ requireTelegramWebView: true });
  if (!loaded.success) {
    return { success: false, watched: false, reason: loaded.reason, error: loaded.error };
  }

  const showFn = getShowFunction();
  if (!showFn) {
    return { success: false, watched: false, reason: 'show_function_missing', error: `Monetag function ${loaded.config.sdkFunction} is unavailable.` };
  }

  try {
    await Promise.resolve(showFn(...getAdArgs(format)));
    return { success: true, watched: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ad was closed or rejected by the SDK.';
    return { success: false, watched: false, reason: 'ad_rejected', error: message };
  }
};

export const registerAdCallbacks = (showTrigger: () => void, resolve: (result: AdResult) => void) => {
  _showAdTrigger = showTrigger;
  _resolveAd = resolve;
};

export const resolveAdFromBridge = (result: AdResult) => {
  if (_resolveAd) {
    _resolveAd(result);
    _resolveAd = null;
    _showAdTrigger = null;
  }
};

// Retained for existing native WebView callers; the TMA SDK does not require a publisher ID.
export const getMonetazConfig = async (): Promise<MonetagConfig> => getConfig();

export const showRewardedAd = (format: MonetagAdFormat = 'rewarded'): Promise<AdResult> => {
  if (isBrowser()) {
    return showMonetagAd(format);
  }

  return new Promise((resolve) => {
    if (_showAdTrigger) {
      _resolveAd = resolve;
      _showAdTrigger();
    } else {
      setTimeout(() => resolve({ watched: false, reason: 'ad_bridge_unavailable', error: 'Ad bridge is unavailable' }), 2500);
    }
  });
};

export const recordAdEvent = async (placement: string, result: AdResult, rewardTokens = 0, telegramId?: string): Promise<void> => {
  try {
    await supabase.from('ad_events').insert({
      telegram_id: telegramId ?? null,
      placement,
      provider: 'monetag',
      watched: result.watched,
      error: result.error || result.reason || null,
      reward_tokens: rewardTokens,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Failed to record ad event:', error);
    }
  }
};

export const showInterstitialAd = (): Promise<AdResult> => showRewardedAd('inApp');
export const showRegistrationAd = (): Promise<AdResult> => showRewardedAd('popup');
export const preloadAd = async (): Promise<void> => { await loadMonetagSdk(); };

export const buildMonetazAdHtml = (zoneId: string = MONETAG_ZONE_ID): string => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no"></head>
<body style="margin:0;background:#0A2E1F;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center">
  <div><div style="font-size:40px;margin-bottom:12px">🌿</div><div id="status">Loading MintGrow ad...</div></div>
  <script src="${MONETAG_SCRIPT_URL}" data-zone="${zoneId}" data-sdk="show_${zoneId}"></script>
  <script>
    var adDone = false;
    function send(type, watched, error) {
      if (adDone) return; adDone = true;
      try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type:type, watched:!!watched, error:error || null })); } catch(e) {}
    }
    function run() {
      var fn = window['show_${zoneId}'];
      if (typeof fn !== 'function') return false;
      Promise.resolve(fn()).then(function(){ send('AD_REWARD', true); }).catch(function(e){ send('AD_CLOSED', false, e && e.message ? e.message : 'ad_rejected'); });
      return true;
    }
    var attempts = 0;
    var poll = setInterval(function(){ attempts++; if (run() || attempts >= 60) { clearInterval(poll); if (attempts >= 60) send('AD_CLOSED', false, 'sdk_timeout'); } }, 250);
  </script>
</body>
</html>`;
