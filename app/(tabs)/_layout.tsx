import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { Colors } from '@/constants/theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  const tabBarStyle = {
    height: Platform.select({ ios: insets.bottom + 58, android: insets.bottom + 58, default: 66 }),
    paddingTop: 6,
    paddingBottom: Platform.select({ ios: insets.bottom + 6, android: insets.bottom + 6, default: 6 }),
    paddingHorizontal: 4,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1.5,
    borderTopColor: Colors.border,
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
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
