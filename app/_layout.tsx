import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GameProvider } from '@/contexts/GameContext';
import { MonetazAdWebView } from '@/components/ui/MonetazAdWebView';
import { RegistrationGate } from '@/components/ui/RegistrationGate';
import { TelegramMiniAppBridge } from '@/components/ui/TelegramMiniAppBridge';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <GameProvider>
        <StatusBar style="dark" />
        <TelegramMiniAppBridge />
        {/* Global Monetag WebView bridge — must be inside GameProvider */}
        <MonetazAdWebView />
        {/* Registration ad gate — shows once for new users */}
        <RegistrationGate />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#F5FBF7' },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="admin" options={{ headerShown: false }} />
        </Stack>
      </GameProvider>
    </SafeAreaProvider>
  );
}
