import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { Colors } from '@/constants/theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.select({ ios: insets.bottom, android: insets.bottom, default: 0 }) || 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: bottomInset + 62,
          paddingTop: 5,
          paddingBottom: bottomInset + 4,
          paddingHorizontal: 5,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          elevation: 12,
        },
        tabBarItemStyle: { borderRadius: 16, marginHorizontal: 2, marginVertical: 3 },
        tabBarActiveBackgroundColor: '#E5FFF0',
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', marginTop: -1 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Play', tabBarIcon: ({ color, size }) => <MaterialIcons name="games" size={size} color={color} /> }} />
      <Tabs.Screen name="rewards" options={{ title: 'Rewards', tabBarIcon: ({ color, size }) => <MaterialIcons name="account-balance-wallet" size={size} color={color} /> }} />
      <Tabs.Screen name="referral" options={{ title: 'Referral', tabBarIcon: ({ color, size }) => <MaterialIcons name="group-add" size={size} color={color} /> }} />
      <Tabs.Screen name="leaderboard" options={{ title: 'Levels', tabBarIcon: ({ color, size }) => <MaterialIcons name="military-tech" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <MaterialIcons name="person-outline" size={size} color={color} /> }} />
    </Tabs>
  );
}
