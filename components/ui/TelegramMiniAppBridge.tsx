import { useEffect } from 'react';
import { Platform } from 'react-native';

type TelegramWebApp = {
  ready?: () => void;
  expand?: () => void;
  disableVerticalSwipes?: () => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

const TELEGRAM_WEB_APP_SCRIPT_ID = 'telegram-web-app-sdk';

export function TelegramMiniAppBridge() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const initializeTelegram = () => {
      const webApp = window.Telegram?.WebApp;
      webApp?.ready?.();
      webApp?.expand?.();
      webApp?.disableVerticalSwipes?.();
    };

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
