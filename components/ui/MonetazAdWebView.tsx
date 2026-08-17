import React, { useRef, useEffect, useState } from 'react';
import { View, Modal, StyleSheet, Platform } from 'react-native';
import {
  buildMonetazAdHtml,
  registerAdCallbacks,
  resolveAdFromBridge,
  getMonetazConfig,
} from '@/services/monetag';

interface Props {
  onDismiss?: () => void;
}

export function MonetazAdWebView({ onDismiss }: Props) {
  const [showWebView, setShowWebView] = useState(false);
  const [adHtml, setAdHtml] = useState<string | null>(null);

  // Fetch real Monetag config from Edge Function on mount
  useEffect(() => {
    getMonetazConfig().then(config => {
      if (config) {
        setAdHtml(buildMonetazAdHtml(config.publisherId, config.zoneId));
      } else {
        // Fallback: use placeholder (will still show countdown)
        setAdHtml(buildMonetazAdHtml('__pub__', '__zone__'));
      }
    });
  }, []);

  useEffect(() => {
    registerAdCallbacks(
      () => setShowWebView(true),
      (result) => {
        setShowWebView(false);
        onDismiss?.();
        resolveAdFromBridge(result);
      }
    );
  }, [onDismiss]);

  // Web platform simulation
  if (Platform.OS === 'web') {
    useEffect(() => {
      if (!showWebView) return;
      const timer = setTimeout(() => {
        resolveAdFromBridge({ watched: true });
        setShowWebView(false);
      }, 3000);
      return () => clearTimeout(timer);
    }, [showWebView]);
    return null;
  }

  if (!showWebView || !adHtml) return null;

  const { WebView } = require('react-native-webview');

  return (
    <Modal visible={showWebView} transparent={false} animationType="slide">
      <View style={styles.container}>
        <WebView
          source={{ html: adHtml }}
          style={styles.webview}
          javaScriptEnabled
          originWhitelist={['*']}
          onMessage={(event: any) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === 'AD_REWARD' || data.type === 'AD_CLOSED') {
                resolveAdFromBridge({ watched: data.watched === true });
                setShowWebView(false);
              }
            } catch {}
          }}
          onError={() => {
            // Fail open — reward the user on ad error
            resolveAdFromBridge({ watched: true });
            setShowWebView(false);
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A2E1F' },
  webview: { flex: 1 },
});
