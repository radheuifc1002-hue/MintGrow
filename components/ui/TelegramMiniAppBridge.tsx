import { useEffect } from 'react';
import { Platform } from 'react-native';
import { preloadAd } from '@/services/monetag';

type TelegramWebAppWithControls = {
  ready?: () => void;
  expand?: () => void;
  disableVerticalSwipes?: () => void;
  initData?: string;
};

const TELEGRAM_WEB_APP_SCRIPT_ID = 'telegram-web-app-sdk';
const TELEGRAM_WAIT_TIMEOUT_MS = 8000;

let resolveTelegramReady: (webApp: TelegramWebAppWithControls) => void;
let rejectTelegramReady: (error: Error) => void;

// GameProvider and verifiedApi both depend on the same initialization barrier.
export const telegramWebAppReady: Promise<TelegramWebAppWithControls> = new Promise((resolve, reject) => {
  resolveTelegramReady = resolve;
  rejectTelegramReady = reject;
});

export const waitForTelegramWebApp = async (): Promise<TelegramWebAppWithControls> => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    throw new Error('Telegram Mini App is only available on the web.');
  }

  const existing = window.Telegram?.WebApp as TelegramWebAppWithControls | undefined;
  if (existing?.initData) {
    existing.ready?.();
    existing.expand?.();
    return existing;
  }

  return Promise.race([
    telegramWebAppReady,
    new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error('Telegram Mini App identity is unavailable. Open MintGrow inside Telegram.')),
        TELEGRAM_WAIT_TIMEOUT_MS,
      );
    }),
  ]);
};

export function TelegramMiniAppBridge() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const initializeTelegram = () => {
      const webApp = window.Telegram?.WebApp as TelegramWebAppWithControls | undefined;
      if (!webApp) {
        rejectTelegramReady(new Error('Telegram Mini App SDK failed to initialize.'));
        return;
      }

      webApp.ready?.();
      webApp.expand?.();
      webApp.disableVerticalSwipes?.();

      if (!webApp.initData) {
        rejectTelegramReady(new Error('Telegram Mini App identity is unavailable. Open MintGrow inside Telegram.'));
        return;
      }

      resolveTelegramReady(webApp);
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
    script.addEventListener('error', () => rejectTelegramReady(new Error('Unable to load the Telegram Mini App SDK.')), { once: true });
    document.head.appendChild(script);
  }, []);

  return null;
}
