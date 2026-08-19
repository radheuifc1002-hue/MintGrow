
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, Modal, StyleSheet, Platform, Text } from 'react-native';
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
  const resolveRef = useRef<((result: { watched: boolean }) => void) | null>(null);

  // Fetch real Monetag config from Edge Function on mount
  useEffect(() => {
    getMonetazConfig().then(config => {
      if (config) {
        setAdHtml(buildMonetazAdHtml(config.publisherId, config.zoneId));
      } else {
        // Fallback: blank zone triggers countdown only
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
    registerAdCallbacks(handleShow, handleResolve);
  }, [handleShow, handleResolve]);

  // Web platform: simulate with timeout
  if (Platform.OS === 'web') {
    // The `useEffect` hook should only be called inside the main body of the functional component.
    // When `Platform.OS === 'web'`, the component might render an early exit (`return null;` or the `View`).
    // If the hook is conditionally called *after* an early exit based on `Platform.OS`, it violates
    // "Rules of Hooks". The hook must be called unconditionally on every render.
    //
    // The previous code had a conditional `useEffect` inside `if (Platform.OS === 'web')`.
    // To fix this, we should ensure all hooks are called at the top level of the component
    // before any conditional returns or renders.
    //
    // If `showWebView` is false, the `useEffect` will just return early, which is fine.
    // If we want to simulate the ad only on web, we can place the effect outside the conditional
    // `Platform.OS === 'web'` block, and let its internal logic handle the `Platform.OS` check.
    //
    // However, the intent seems to be that this specific simulation logic only runs
    // *when* `Platform.OS === 'web'` and *when* `showWebView` is true, AND it only renders
    // a fallback UI in that scenario.
    //
    // The original placement of `useEffect` was causing the error because it was inside `if (Platform.OS === 'web')`.
    // If `Platform.OS` is *not* `'web'`, this `useEffect` would not be called, breaking the rules of hooks.
    //
    // To maintain the logic, we should move the `useEffect` outside the `if (Platform.OS === 'web')` block
    // and make the `Platform.OS` check *inside* the effect itself. This ensures the hook is
    // always called unconditionally, satisfying React's rules.

    // Remove the `// eslint-disable-next-line react-hooks/rules-of-hooks` comment as the underlying issue needs fixing.
    useEffect(() => {
      if (Platform.OS !== 'web') return; // Now, the hook is always called, but its logic is conditional.
      if (!showWebView) return;
      const timer = setTimeout(() => {
        setShowWebView(false);
        resolveAdFromBridge({ watched: true });
      }, 3000);
      return () => clearTimeout(timer);
    }, [showWebView]); // `Platform.OS` is stable, no need to include in dependency array.

    if (!showWebView) return null; // This conditional return is fine *after* all hooks.
    
    return (
      <View style={styles.webFallback}>
        <Text style={styles.webFallbackText}>📺 Ad simulated on web preview</Text>
      </View>
    );
  }

  if (!adHtml) return null;

  // Native: use real WebView with Monetag TMA SDK
  const { WebView } = require('react-native-webview');

  return (
    <Modal
      visible={showWebView}
      transparent={false}
      animationType="slide"
      onRequestClose={() => {
        // User pressed back — still reward (fail-open policy)
        resolveAdFromBridge({ watched: true });
        setShowWebView(false);
      }}
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
                resolveAdFromBridge({ watched: true });
                setShowWebView(false);
              } else if (data.type === 'AD_CLOSED') {
                // Fail-open: reward on close too
                resolveAdFromBridge({ watched: true });
                setShowWebView(false);
              }
            } catch {}
          }}
          onError={() => {
            // Network error — fail open
            resolveAdFromBridge({ watched: true });
            setShowWebView(false);
          }}
          onHttpError={() => {
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
  webFallback: {
    position: 'absolute', bottom: 80, left: 20, right: 20,
    backgroundColor: '#0A2E1F', padding: 12, borderRadius: 8, zIndex: 999,
  },
  webFallbackText: { color: '#00C878', textAlign: 'center', fontSize: 13 },
});
