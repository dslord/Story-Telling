import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  resolvedTheme: 'light' | 'dark';
  loading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const ASYNC_STORAGE_KEY = 'theme_preference';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadSavedTheme() {
      try {
        const savedMode = await AsyncStorage.getItem(ASYNC_STORAGE_KEY);
        if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') {
          setThemeModeState(savedMode);
        }
      } catch (error) {
        console.error('Failed to load theme preference:', error);
      } finally {
        setLoading(false);
      }
    }
    loadSavedTheme();
  }, []);

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      setThemeModeState(mode);
      await AsyncStorage.setItem(ASYNC_STORAGE_KEY, mode);
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  };

  const resolvedTheme = themeMode === 'system'
    ? (systemScheme === 'dark' ? 'dark' : 'light')
    : themeMode;

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, resolvedTheme, loading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
}
