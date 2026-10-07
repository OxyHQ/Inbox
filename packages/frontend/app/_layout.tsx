import '../global.css';

import { Stack, ThemeProvider } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { OxyProvider, useOxy, RequireOxyAuth } from '@oxy.so/services';
import { toast } from '@oxy.so/bloom';
import { ImageResolverProvider } from '@oxy.so/bloom/image-resolver';
import type { ImageResolver } from '@oxy.so/bloom/image-resolver';
import { BloomProvider } from '@oxy.so/bloom/provider';
import { BloomScope } from '@oxy.so/bloom/appearance';
import { useNavigationTheme } from '@oxy.so/bloom/theme';
import type { ThemeMode } from '@oxy.so/bloom/theme';
import { PortalProvider, PortalOutlet } from '@oxy.so/bloom/portal';
import { ConnectionStatusToasts } from '@oxy.so/bloom/connection-status';
import { createStickersClient } from '@oxy.so/stickers';
import { StickersProvider } from '@oxy.so/stickers/react';

import {
  INBOX_ACCOUNT_QUERIES,
  queryClient,
} from '@/hooks/queries/queryClient';
import {
  ThemeProvider as AppThemeProvider,
  useThemeContext,
} from '@/contexts/theme-context';
import { InboxPrefsProvider } from '@/contexts/inbox-prefs-context';
import { LocaleProvider, useTranslation } from '@/lib/i18n';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useInboxSocket } from '@/hooks/useInboxSocket';
import { usePushRegistration } from '@/hooks/usePushRegistration';
import { useEmailPushNotifications } from '@/hooks/notifications/useEmailPushNotifications';
import { useForegroundNotificationHandler } from '@/hooks/notifications/useForegroundNotificationHandler';
import { useEmailStore } from '@/hooks/useEmail';
import { removeLegacyQueryCache } from '@/utils/removeLegacyQueryCache';
import { registerServiceWorker } from '@/utils/registerServiceWorker';
import { clearQueue } from '@/utils/offlineQueue';
import { OXY_CLIENT_ID, OXY_AUTH_REDIRECT_URI } from '@/constants/oxy';
import { configureLottieWeb } from '@/lib/lottieWeb';
import * as SplashScreen from 'expo-splash-screen';

configureLottieWeb();

SplashScreen.hideAsync().catch(() => {
  // Already hidden during a fast-refresh re-import.
});

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.oxy.so';

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <Head.Provider>
        <AppThemeProvider>
          <ThemedRoot />
        </AppThemeProvider>
      </Head.Provider>
    </ErrorBoundary>
  );
}

function ThemedRoot() {
  const { themePreference, colorPreset } = useThemeContext();
  const themeMode = themePreference as ThemeMode;
  return (
    <BloomProvider mode={themeMode} colorPreset={colorPreset}>
      <BloomScope size="md">
        <RootLayoutContent />
      </BloomScope>
    </BloomProvider>
  );
}

function RootLayoutContent() {
  const navTheme = useNavigationTheme();

  return (
    <KeyboardProvider>
      <OxyProvider
        baseURL={API_URL}
        clientId={OXY_CLIENT_ID}
        authRedirectUri={OXY_AUTH_REDIRECT_URI}
        queryClient={queryClient}
        accountQueries={INBOX_ACCOUNT_QUERIES}
      >
        <ScopedInboxPrefsProvider>
          <InboxMediaProvider>
            <LocaleProvider>
              <PortalProvider>
                <ThemeProvider value={navTheme}>
                  <ConnectionStatusToasts />
                  <RootEffects />
                  <GatedNavigator />
                  <StatusBar style="auto" />
                </ThemeProvider>
                <PortalOutlet />
              </PortalProvider>
            </LocaleProvider>
          </InboxMediaProvider>
        </ScopedInboxPrefsProvider>
      </OxyProvider>
    </KeyboardProvider>
  );
}

function GatedNavigator() {
  const { t } = useTranslation();
  return (
    <RequireOxyAuth
      prompt="hard"
      title={t('auth.gate.title')}
      subtitle={t('auth.gate.subtitle')}
    >
      <Stack
        screenOptions={{ contentStyle: { backgroundColor: 'transparent' } }}
      >
        <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" options={{ headerShown: false }} />
      </Stack>
    </RequireOxyAuth>
  );
}

function ScopedInboxPrefsProvider({ children }: { children: ReactNode }) {
  const { user } = useOxy();
  const scope = user?.id ?? null;

  // The selected mailbox and the email API belong to the account. Its cached
  // data is the SDK's to drop (`accountQueries`); this is the app's own state.
  const previousScope = useRef(scope);
  useEffect(() => {
    if (previousScope.current === scope) return;
    previousScope.current = scope;
    useEmailStore.getState().resetAccountScopedState();
  }, [scope]);

  return (
    <InboxPrefsProvider key={scope ?? 'anonymous'} scope={scope}>
      {children}
    </InboxPrefsProvider>
  );
}

function InboxMediaProvider({ children }: { children: ReactNode }) {
  const { oxyServices } = useOxy();
  const stickersClient = useMemo(
    () => createStickersClient(oxyServices),
    [oxyServices],
  );
  const resolve = useCallback<ImageResolver>(
    (id, variant) => oxyServices.assets.publicUrl(id, variant),
    [oxyServices],
  );
  return (
    <ImageResolverProvider value={resolve}>
      <StickersProvider client={stickersClient}>{children}</StickersProvider>
    </ImageResolverProvider>
  );
}

function RootEffects() {
  const { t } = useTranslation();
  const { canUsePrivateApi } = useOxy();

  useInboxSocket();
  usePushRegistration();
  useEmailPushNotifications(canUsePrivateApi);
  useForegroundNotificationHandler();
  useEffect(() => {
    void removeLegacyQueryCache();
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    registerServiceWorker(() => {
      toast.info(t('inbox.toast.newVersionAvailable'));
    });

    void clearQueue();
  }, [t]);

  return null;
}
