// Monetag Ad Service — Telegram Mini App SDK
// Uses window.show_ZONEID() pattern from Monetag's TMA SDK
import { supabase } from '@/services/supabase';
import { FunctionsHttpError } from '@supabase/supabase-js';

const DEFAULT_MONETAG_ZONE_ID = '11613357';
const DEFAULT_MONETAG_SCRIPT_URL = 'https://niphausten.com/1/tag.min.js';

const getConfiguredZoneId = () => (
  process.env.EXPO_PUBLIC_MONETAG_ZONE_ID
  || process.env.MONETAG_ZONE_ID
  || DEFAULT_MONETAG_ZONE_ID
);

const getConfiguredPublisherId = () => (
  process.env.EXPO_PUBLIC_MONETAG_PUBLISHER_ID
  || process.env.MONETAG_PUBLISHER_ID
  || ''
);

export interface AdResult {
  watched: boolean;
  error?: string;
}

type MonetagAdFormat = 'rewarded' | 'popup' | 'inApp';

// Callbacks set by the MonetazAdWebView component
let _resolveAd: ((result: AdResult) => void) | null = null;
let _showAdTrigger: (() => void) | null = null;

export const registerAdCallbacks = (
  showTrigger: () => void,
  resolve: (result: AdResult) => void
) => {
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

// Fetch Monetag config securely from Edge Function
export const getMonetazConfig = async (): Promise<{
  publisherId: string;
  zoneId: string;
  scriptUrl: string;
} | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('monetag-ad', {
      body: { action: 'get_config' },
    });
    if (error) {
      if (error instanceof FunctionsHttpError) {
        const text = await error.context?.text();
        console.error('Monetag edge fn error:', text);
      }
      return {
        publisherId: getConfiguredPublisherId(),
        zoneId: getConfiguredZoneId(),
        scriptUrl: DEFAULT_MONETAG_SCRIPT_URL,
      };
    }

    return {
      publisherId: data?.publisherId || getConfiguredPublisherId(),
      zoneId: data?.zoneId || getConfiguredZoneId(),
      scriptUrl: data?.scriptUrl || DEFAULT_MONETAG_SCRIPT_URL,
    };
  } catch {
    return {
      publisherId: getConfiguredPublisherId(),
      zoneId: getConfiguredZoneId(),
      scriptUrl: DEFAULT_MONETAG_SCRIPT_URL,
    };
  }
};

async function showMonetagInTelegramWeb(format: MonetagAdFormat = 'rewarded'): Promise<AdResult> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { watched: false, error: 'Browser runtime is unavailable' };
  }

  const config = await getMonetazConfig();
  const zoneId = config?.zoneId;

  return new Promise((resolve) => {
    const allowDevReward = process.env.NODE_ENV !== 'production';
    let done = false;
    let countdownTimer: ReturnType<typeof setInterval> | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const finish = (result: AdResult) => {
      if (done) return;
      done = true;
      if (countdownTimer) clearInterval(countdownTimer);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      const overlay = document.getElementById('mintgrow-monetag-overlay');
      overlay?.remove();
      resolve(result);
    };

    const overlay = document.createElement('div');
    overlay.id = 'mintgrow-monetag-overlay';
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483647', 'background:#0A2E1F',
      'display:flex', 'align-items:center', 'justify-content:center', 'color:#fff',
      'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', 'text-align:center',
      'padding:24px',
    ].join(';');
    overlay.innerHTML = '<div><div style="font-size:40px;margin-bottom:12px">🌿</div><h2 style="margin:0 0 8px;font-size:22px">MintGrow Ad</h2><p id="mintgrow-ad-status" style="margin:0;color:#7DA890">Preparing Telegram ad...</p></div>';
    document.body.appendChild(overlay);

    const status = document.getElementById('mintgrow-ad-status');
    const setStatus = (text: string) => {
      if (status) status.textContent = text;
    };

    const finishUnavailable = (error: string) => {
      if (!allowDevReward) {
        setStatus(error);
        setTimeout(() => finish({ watched: false, error }), 1200);
        return;
      }

      let seconds = 6;
      setStatus(`Ad unavailable in preview. Test reward unlocks in ${seconds}s...`);
      countdownTimer = setInterval(() => {
        seconds -= 1;
        if (seconds <= 0) {
          finish({ watched: true });
        } else {
          setStatus(`Ad unavailable in preview. Test reward unlocks in ${seconds}s...`);
        }
      }, 1000);
    };

    const tryShowAd = () => {
      const showFn = zoneId ? (window as unknown as Record<string, unknown>)[`show_${zoneId}`] : undefined;
      if (typeof showFn !== 'function') return false;

      setStatus('Showing Telegram Mini App ad...');
      const args = format === 'popup'
        ? ['pop']
        : format === 'inApp'
          ? [{ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } }]
          : [];
      Promise.resolve((showFn as (...args: unknown[]) => Promise<void> | void)(...args))
        .then(() => finish({ watched: true }))
        .catch(() => finish({ watched: false, error: 'Ad was closed before completion' }));
      return true;
    };

    const pollForAd = (maxAttempts = 60, intervalMs = 250) => {
      let attempts = 0;
      const poll = setInterval(() => {
        attempts += 1;
        if (tryShowAd()) {
          clearInterval(poll);
        } else if (attempts >= maxAttempts) {
          clearInterval(poll);
          finishUnavailable('Monetag SDK did not expose an ad for this zone.');
        }
      }, intervalMs);
    };

    const tg = (window as unknown as { Telegram?: { WebApp?: { ready?: () => void; expand?: () => void } } }).Telegram?.WebApp;
    tg?.ready?.();
    tg?.expand?.();

    if (!zoneId) {
      finishUnavailable('Monetag zone is not configured.');
      return;
    }

    if (tryShowAd()) return;

    const existing = document.querySelector(`script[data-mintgrow-monetag-zone="${zoneId}"], script[data-zone="${zoneId}"]`);
    const script = existing || document.createElement('script');
    script.setAttribute('data-zone', zoneId);
    script.setAttribute('data-mintgrow-monetag-zone', zoneId);
    script.setAttribute('async', 'true');
    script.setAttribute('src', config?.scriptUrl || DEFAULT_MONETAG_SCRIPT_URL);

    script.addEventListener('load', () => {
      setStatus('Loading ad creative...');
      pollForAd();
    }, { once: true });
    script.addEventListener('error', () => finishUnavailable('Monetag SDK failed to load.'), { once: true });

    if (!existing) {
      document.head.appendChild(script);
    } else {
      setStatus('Using preloaded Monetag SDK...');
      pollForAd();
    }

    fallbackTimer = setTimeout(() => {
      if (!done && !tryShowAd()) finishUnavailable('Monetag SDK timed out.');
    }, 15000);
  });
}

export const showRewardedAd = (format: MonetagAdFormat = 'rewarded'): Promise<AdResult> => {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return showMonetagInTelegramWeb(format);
  }

  return new Promise((resolve) => {
    if (_showAdTrigger) {
      _resolveAd = resolve;
      _showAdTrigger();
    } else {
      setTimeout(() => resolve({ watched: false, error: 'Ad bridge is unavailable' }), 2500);
    }
  });
};

export const showInterstitialAd = (): Promise<AdResult> => {
  return showRewardedAd('inApp');
};

export const showRegistrationAd = (): Promise<AdResult> => {
  return showRewardedAd('popup');
};

export const preloadAd = async (): Promise<void> => {};

// ─── Monetag Telegram Mini App SDK HTML ─────────────────────────────────────
// Uses the official Monetag TMA SDK pattern:
//   1. Load niphausten.com/1/tag.min.js with data-zone attribute
//   2. Call window.show_ZONEID() which returns a Promise
//   3. Resolve = rewarded, Reject = skipped/closed
//   Fallback: 6-second countdown if SDK fails to load
export const buildMonetazAdHtml = (publisherId: string, zoneId: string): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    body {
      background: #0A2E1F;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      color: #fff;
    }
    #loader {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 16px;
    }
    .spinner {
      width: 48px; height: 48px;
      border: 4px solid rgba(0,200,120,0.2);
      border-top-color: #00C878;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #status { font-size: 14px; color: #7DA890; letter-spacing: 0.5px; text-align: center; }
    #timer-wrap {
      display: none;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    #timer {
      font-size: 40px; font-weight: 900;
      color: #00C878;
    }
    #timer-label { font-size: 12px; color: #7DA890; text-transform: uppercase; letter-spacing: 1.5px; }
    #ad-container { width: 100vw; min-height: 60px; }
  </style>
</head>
<body>
  <div id="loader">
    <div class="spinner"></div>
    <div id="status">Loading MintGrow ad...</div>
  </div>

  <div id="timer-wrap">
    <div id="ad-container"></div>
    <div id="timer">6</div>
    <div id="timer-label">Please wait</div>
  </div>

  <script>
    var adDone = false;
    var zoneId = '${zoneId}';
    var timerEl = document.getElementById('timer');
    var timerWrap = document.getElementById('timer-wrap');
    var loader = document.getElementById('loader');
    var statusEl = document.getElementById('status');
    var countdown = 6;
    var timerInterval = null;

    function sendToRN(type, watched) {
      if (adDone) return;
      adDone = true;
      if (timerInterval) clearInterval(timerInterval);
      try {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, watched: !!watched }));
        }
      } catch(e) {}
    }

    function startFallbackTimer() {
      loader.style.display = 'none';
      timerWrap.style.display = 'flex';
      timerInterval = setInterval(function() {
        countdown--;
        if (timerEl) timerEl.textContent = countdown > 0 ? String(countdown) : '';
        if (countdown <= 0) {
          clearInterval(timerInterval);
          sendToRN('AD_REWARD', true);
        }
      }, 1000);
    }

    function tryMonetag() {
      try {
        // Monetag TMA SDK: window.show_ZONEID() returns a Promise
        var showFn = window['show_' + zoneId];
        if (typeof showFn === 'function') {
          statusEl.textContent = 'Ad ready...';
          showFn().then(function() {
            sendToRN('AD_REWARD', true);
          }).catch(function() {
            // User closed or ad failed — still reward (fail-open)
            sendToRN('AD_CLOSED', true);
          });
          return true;
        }
      } catch(e) {}
      return false;
    }

    // Load Monetag Telegram Mini App SDK
    var script = document.createElement('script');
    script.setAttribute('data-zone', zoneId);
    script.src = '${DEFAULT_MONETAG_SCRIPT_URL}';
    script.async = true;

    script.onload = function() {
      statusEl.textContent = 'Ad loading...';
      // Give SDK a moment to register window.show_ZONEID
      var attempts = 0;
      var pollInterval = setInterval(function() {
        attempts++;
        if (tryMonetag()) {
          clearInterval(pollInterval);
          loader.style.display = 'none';
          timerWrap.style.display = 'flex';
          return;
        }
        if (attempts >= 20) {
          clearInterval(pollInterval);
          startFallbackTimer();
        }
      }, 200);
    };

    script.onerror = function() {
      // SDK failed to load — use fallback countdown
      startFallbackTimer();
    };

    // Safety timeout: if nothing happens in 10s, fallback
    var safetyTimeout = setTimeout(function() {
      if (!adDone) startFallbackTimer();
    }, 10000);

    document.head.appendChild(script);
  </script>
</body>
</html>
`;
