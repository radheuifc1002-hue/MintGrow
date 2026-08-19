import React, { useCallback, useEffect, useState } from 'react';
import { View, Modal, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
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

  useEffect(() => {
    if (Platform.OS === 'web') return;

    getMonetazConfig().then(config => {
      if (config) {
        setAdHtml(buildMonetazAdHtml(config.publisherId, config.zoneId));
      } else {
        setAdHtml(buildMonetazAdHtml('0', '0'));
      }
    });
  }, []);

  const handleShow = useCallback(() => {
    setShowWebView(true);
  }, []);

  const handleResolve = useCallback((result: { watched: boolean }) => {
    setShowWebView(false);
    onDismiss?.();
    resolveAdFromBridge(result);
  }, [onDismiss]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    registerAdCallbacks(handleShow, handleResolve);
  }, [handleShow, handleResolve]);

  if (Platform.OS === 'web' || !adHtml) return null;

  return (
    <Modal
      visible={showWebView}
      transparent={false}
      animationType="slide"
      onRequestClose={() => handleResolve({ watched: true })}
    >
      <View style={styles.container}>
        <WebView
          source={{ html: adHtml }}
          style={styles.webview}
          javaScriptEnabled
          originWhitelist={['*']}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mixedContentMode="always"
          onMessage={(event: any) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === 'AD_REWARD') {
                handleResolve({ watched: true });
              } else if (data.type === 'AD_CLOSED') {
                handleResolve({ watched: false });
              }
            } catch {
              handleResolve({ watched: false });
            }
          }}
          onError={() => handleResolve({ watched: true })}
          onHttpError={() => handleResolve({ watched: true })}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A2E1F' },
  webview: { flex: 1 },
});
