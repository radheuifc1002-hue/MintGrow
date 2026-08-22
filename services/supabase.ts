import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const createStorageAdapter = () => {
  if (Platform.OS === 'web') {
    return {
      getItem: (key: string) => {
        if (typeof window !== 'undefined' && window.localStorage) {
          return Promise.resolve(window.localStorage.getItem(key));
        }
        return Promise.resolve(null);
      },
      setItem: (key: string, value: string) => {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
        }
        return Promise.resolve();
      },
      removeItem: (key: string) => {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
        return Promise.resolve();
      },
    };
  }
  return AsyncStorage;
};

let _supabase: ReturnType<typeof createClient> | null = null;

export const getSupabaseClient = () => {
  if (!_supabase) {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error('Supabase environment variables are not configured. Check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
    }
    _supabase = createClient(url, key, {
      auth: {
        storage: createStorageAdapter() as any,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return _supabase;
};

// Lazy accessor — do not initialise at module load time to avoid SSR crashes
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    return (getSupabaseClient() as any)[prop];
  },
});
