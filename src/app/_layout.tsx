import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider, Stack, useRouter, useSegments } from 'expo-router';
import { useColorScheme, ActivityIndicator, View } from 'react-native';

import { AuthProvider, useAuth } from '@/services/auth/auth-provider';
import { ThemeProvider as AppThemeProvider, useThemeContext } from '@/context/theme-context';
import { Colors } from '@/constants/theme';

function NavigationThemeWrapper({ children }: { children: React.ReactNode }) {
  const { resolvedTheme, loading: themeLoading } = useThemeContext();
  const systemScheme = useColorScheme();

  // Customize React Navigation themes to match our centralized theme colors
  const customLightTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: Colors.light.background,
      card: Colors.light.background,
      text: Colors.light.text,
      border: Colors.light.border,
      notification: Colors.light.tint,
      primary: Colors.light.tint,
    },
  };

  const customDarkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: Colors.dark.background,
      card: Colors.dark.background,
      text: Colors.dark.text,
      border: Colors.dark.border,
      notification: Colors.dark.tint,
      primary: Colors.dark.tint,
    },
  };

  // Prevent flash by displaying a neutral, system-matching splash while theme preferences are loading
  if (themeLoading) {
    const loadingBgColor = systemScheme === 'dark' ? '#000000' : '#ffffff';
    const loadingSpinnerColor = systemScheme === 'dark' ? '#ffffff' : '#000000';
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: loadingBgColor }}>
        <ActivityIndicator size="large" color={loadingSpinnerColor} />
      </View>
    );
  }

  return (
    <ThemeProvider value={resolvedTheme === 'dark' ? customDarkTheme : customLightTheme}>
      {children}
    </ThemeProvider>
  );
}

function InitialLayout() {
  const { authenticated, loading: authLoading } = useAuth();
  const { resolvedTheme } = useThemeContext();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!authenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (authenticated && inAuthGroup) {
      router.replace('/(main)/(tabs)');
    }
  }, [authenticated, authLoading, segments]);

  if (authLoading) {
    const currentTheme = Colors[resolvedTheme];
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: currentTheme.background }}>
        <ActivityIndicator size="large" color={currentTheme.text} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(main)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppThemeProvider>
        <NavigationThemeWrapper>
          <InitialLayout />
        </NavigationThemeWrapper>
      </AppThemeProvider>
    </AuthProvider>
  );
}
