import { useIsDesktopLayout } from '@/hooks/useIsDesktopLayout';
import { Stack } from 'expo-router';

export default function SearchLayout() {
  const isDesktop = useIsDesktopLayout();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
        animation: isDesktop ? 'none' : 'default',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="conversation/[id]" />
    </Stack>
  );
}

// A failure in this section stays in this section.
export { RouteErrorBoundary as ErrorBoundary } from '@/components/RouteErrorBoundary';
