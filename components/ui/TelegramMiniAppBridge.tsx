import { useEffect } from 'react';
import { Platform } from 'react-native';

type TelegramWebAppWithControls = {
  ready?: () => void;
  expand?: () => void;
  disableVerticalSwipes?: () => void;
};

const TELEGRAM_WEB_APP_SCRIPT_ID = 'telegram-web-app-sdk';
const MONETAG_SDK_SCRIPT_ID = 'monetag-tma-sdk';
const MONETAG_ZONE_ID = process.env.EXPO_PUBLIC_MONETAG_ZONE_ID || '11613357';

export function TelegramMiniAppBridge() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const initializeTelegram = () => {
      const webApp = window.Telegram?.WebApp as TelegramWebAppWithControls | undefined;
      webApp?.ready?.();
      webApp?.expand?.();
      webApp?.disableVerticalSwipes?.();
    };

    if (!document.getElementById(MONETAG_SDK_SCRIPT_ID) && MONETAG_ZONE_ID) {
      const monetagScript = document.createElement('script');
      monetagScript.id = MONETAG_SDK_SCRIPT_ID;
      monetagScript.src = 'https://niphausten.com/1/tag.min.js';
      monetagScript.async = true;
      monetagScript.setAttribute('data-zone', MONETAG_ZONE_ID);
      document.head.appendChild(monetagScript);
    }

    if (document.getElementById(TELEGRAM_WEB_APP_SCRIPT_ID)) {
      initializeTelegram();
      return;
    }

    const script = document.createElement('script');
    script.id = TELEGRAM_WEB_APP_SCRIPT_ID;
    script.src = 'https://telegram.org/js/telegram-web-app.js';
    script.async = true;
    script.addEventListener('load', initializeTelegram, { once: true });
    document.head.appendChild(script);
  }, []);

  return null;
}
