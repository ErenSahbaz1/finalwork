import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../src/constants/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding/index" />
        <Stack.Screen name="onboarding/permissions" />
        <Stack.Screen name="onboarding/profile" />
        <Stack.Screen name="onboarding/privacy" />
        <Stack.Screen name="convoy/create" />
        <Stack.Screen name="convoy/join" />
        <Stack.Screen name="convoy/[id]/lobby" />
        <Stack.Screen name="convoy/[id]/map" />
        <Stack.Screen name="convoy/[id]/stops" />
        <Stack.Screen name="settings/index" />
      </Stack>
    </>
  );
}
