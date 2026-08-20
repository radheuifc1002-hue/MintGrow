import { useEffect } from 'react';
import { Platform } from 'react-native';
import { preloadAd } from '@/services/monetag';

type TelegramWebAppWithControls = {
  ready?: () => void;
  expand?: () => void;
  disableVerticalSwipes?: () => void;
};

const TELEGRAM_WEB_APP_SCRIPT_ID = 'telegram-web-app-sdk';

export function TelegramMiniAppBridge() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const initializeTelegram = () => {
      const webApp = window.Telegram?.WebApp as TelegramWebAppWithControls | undefined;
      webApp?.ready?.();
      webApp?.expand?.();
      webApp?.disableVerticalSwipes?.();
    };

    void preloadAd();

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
