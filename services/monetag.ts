// Monetag Ad Service — WebView Bridge Integration
// Replace these with your actual Monetag credentials
export const MONETAG_PUBLISHER_ID = 'YOUR_MONETAG_PUBLISHER_ID';
export const MONETAG_REWARDED_ZONE_ID = 'YOUR_REWARDED_ZONE_ID';
export const MONETAG_INTERSTITIAL_ZONE_ID = 'YOUR_INTERSTITIAL_ZONE_ID';

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

export const getMontagScriptUrl = () =>
  `https://a.monetag.com/tag/?pub=${MONETAG_PUBLISHER_ID}`;

// HTML for Monetag WebView — injected with SDK + postMessage bridge
export const buildMonetazAdHtml = (publisherId: string, zoneId: string): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; background: #000; display:flex; align-items:center; justify-content:center; height:100vh; }
    #ad-container { width: 100%; max-width: 400px; }
    #status { color: #fff; font-family: sans-serif; text-align: center; padding: 20px; }
  </style>
</head>
<body>
  <div id="ad-container"><div id="status">Loading ad...</div></div>
  <script>
    // Monetag SDK Integration
    (function(d, z, s) {
      s.src = 'https://'+d+'/'+z;
      try { (document.body || document.documentElement).appendChild(s) } catch(e) {}
    })('a.monetag.com', '${zoneId}', document.createElement('script'));

    // Listen for Monetag reward events
    window.monetagRewardCallback = function(result) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'AD_REWARD',
          watched: true
        }));
      }
    };

    window.monetagAdClosed = function() {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'AD_CLOSED',
          watched: false
        }));
      }
    };

    // Fallback: if ad loads but no explicit reward, resolve after 6s
    setTimeout(function() {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'AD_REWARD',
          watched: true
        }));
      }
    }, 6000);
  </script>
</body>
</html>
`;
