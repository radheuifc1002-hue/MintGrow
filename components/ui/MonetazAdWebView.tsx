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
        setAdHtml(buildMonetazAdHtml(config.zoneId));
      } else {
        setAdHtml(buildMonetazAdHtml());
      }
    });
  }, []);

  const handleShow = useCallback(() => {
    setShowWebView(true);
  }, []);

  const handleResolve = useCallback((result: { watched: boolean; error?: string }) => {
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
      onRequestClose={() => handleResolve({ watched: false, error: 'ad_closed' })}
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
                handleResolve({ watched: false, error: data.error || 'ad_rejected' });
              }
            } catch {
              handleResolve({ watched: false });
            }
          }}
          onError={() => handleResolve({ watched: false, error: 'sdk_load_error' })}
          onHttpError={() => handleResolve({ watched: false, error: 'network_error' })}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A2E1F' },
  webview: { flex: 1 },
});
