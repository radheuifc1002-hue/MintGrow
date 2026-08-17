import React, { useRef, useEffect, useState } from 'react';
import { View, Modal, StyleSheet, Platform } from 'react-native';
import { buildMonetazAdHtml, MONETAG_PUBLISHER_ID, MONETAG_REWARDED_ZONE_ID, registerAdCallbacks, resolveAdFromBridge } from '@/services/monetag';

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export function MonetazAdWebView({ visible, onDismiss }: Props) {
  const [showWebView, setShowWebView] = useState(false);

  useEffect(() => {
    // Register show trigger
    registerAdCallbacks(
      () => setShowWebView(true),
      (result) => {
        setShowWebView(false);
        onDismiss();
        resolveAdFromBridge(result);
      }
    );
  }, [onDismiss]);

  if (!showWebView) return null;

  // Only load WebView on native — web uses simulation
  if (Platform.OS === 'web') {
    // Simulate ad on web platform
    useEffect(() => {
      const timer = setTimeout(() => {
        resolveAdFromBridge({ watched: true });
        setShowWebView(false);
      }, 3000);
      return () => clearTimeout(timer);
    }, []);
    return null;
  }

  // Lazy require WebView so it doesn't crash on web
  const { WebView } = require('react-native-webview');
  const html = buildMonetazAdHtml(MONETAG_PUBLISHER_ID, MONETAG_REWARDED_ZONE_ID);

  return (
    <Modal visible={showWebView} transparent={false} animationType="slide">
      <View style={styles.container}>
        <WebView
          source={{ html }}
          style={styles.webview}
          javaScriptEnabled
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
            resolveAdFromBridge({ watched: true }); // fail-open
            setShowWebView(false);
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1 },
});
