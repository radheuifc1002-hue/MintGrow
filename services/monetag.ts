// Monetag Ad Service — Server-Side Credentials via Edge Function
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
export const getMonetazConfig = async (): Promise<{ publisherId: string; zoneId: string; scriptUrl: string } | null> => {
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
  } catch { return null; }
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

// HTML for Monetag WebView — uses config fetched from Edge Function
export const buildMonetazAdHtml = (publisherId: string, zoneId: string): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0A2E1F; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: -apple-system, sans-serif; }
    #status { color: #00A86B; font-size: 14px; text-align: center; padding: 20px; }
    #timer { color: #fff; font-size: 24px; font-weight: bold; margin-bottom: 8px; }
    #label { color: #7DA890; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; }
    #ad-wrap { width: 100%; max-width: 400px; min-height: 250px; display: flex; align-items: center; justify-content: center; }
  </style>
</head>
<body>
  <div id="status">Loading ad...</div>
  <div id="ad-wrap" id="ad-container"></div>
  <div id="timer"></div>
  <div id="label">Please watch the full ad</div>

  <script>
    var adDone = false;
    var countdown = 6;

    function notifyReward() {
      if (adDone) return;
      adDone = true;
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'AD_REWARD', watched: true }));
      }
    }

    function notifyClosed() {
      if (adDone) return;
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'AD_CLOSED', watched: false }));
      }
    }

    // Monetag SDK
    (function(d, z, s) {
      s.src = 'https://' + d + '/' + z;
      s.onload = function() {
        document.getElementById('status').style.display = 'none';
      };
      try { (document.body || document.documentElement).appendChild(s); } catch(e) {}
    })('a.monetag.com', '${zoneId}', document.createElement('script'));

    // Override Monetag callbacks
    window.monetagRewardCallback = notifyReward;
    window.monetagAdClosed = notifyClosed;

    // Timer countdown
    var timerEl = document.getElementById('timer');
    var timerInterval = setInterval(function() {
      countdown--;
      timerEl.textContent = countdown > 0 ? countdown + 's' : '';
      if (countdown <= 0) {
        clearInterval(timerInterval);
        notifyReward();
      }
    }, 1000);
  </script>
</body>
</html>
`;
