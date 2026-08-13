import { Stack } from 'expo-router';

export default function MainLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="story/[id]" options={{ headerShown: true, title: 'Story' }} />
      <Stack.Screen name="story/edit/[id]" options={{ headerShown: true, title: 'Edit Story' }} />
    </Stack>
  );
}
