// Monetag Ad Service — Telegram Mini App SDK
// Uses window.show_ZONEID() pattern from Monetag's TMA SDK
import { supabase } from '@/services/supabase';
import { FunctionsHttpError } from '@supabase/supabase-js';

export interface AdResult {
  watched: boolean;
  error?: string;
}

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
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

export const showRewardedAd = (): Promise<AdResult> => {
  return new Promise((resolve) => {
    if (_showAdTrigger) {
      _resolveAd = resolve;
      _showAdTrigger();
    } else {
      // Fallback simulation when WebView not mounted
      setTimeout(() => resolve({ watched: true }), 2500);
    }
  });
};

export const showInterstitialAd = (): Promise<AdResult> => {
  return showRewardedAd();
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
    script.src = 'https://niphausten.com/1/tag.min.js';
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
