import '../global.css';

import { Stack, ThemeProvider } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Platform, View } from 'react-native';
import 'react-native-reanimated';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { OxyProvider, useOxy, RequireOxyAuth } from '@oxy.so/services';
import { toast } from '@oxy.so/bloom';
import { ImageResolverProvider } from '@oxy.so/bloom/image-resolver';
import type { ImageResolver } from '@oxy.so/bloom/image-resolver';
import { BloomProvider } from '@oxy.so/bloom/provider';
import { useNavigationTheme } from '@oxy.so/bloom/theme';
import type { ThemeMode } from '@oxy.so/bloom/theme';
import { PortalProvider, PortalOutlet } from '@oxy.so/bloom/portal';
import { ConnectionStatusToasts } from '@oxy.so/bloom/connection-status';

import { activateInboxQueryScope, queryClient } from '@/hooks/queries/queryClient';
import { ThemeProvider as AppThemeProvider, useThemeContext } from '@/contexts/theme-context';
import { InboxPrefsProvider } from '@/contexts/inbox-prefs-context';
import { LocaleProvider, useTranslation } from '@/lib/i18n';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useInboxSocket } from '@/hooks/useInboxSocket';
import { usePushRegistration } from '@/hooks/usePushRegistration';
import { useEmailPushNotifications } from '@/hooks/notifications/useEmailPushNotifications';
import { useForegroundNotificationHandler } from '@/hooks/notifications/useForegroundNotificationHandler';
import { useEmailStore } from '@/hooks/useEmail';
import { registerServiceWorker } from '@/utils/registerServiceWorker';
import { clearQueue } from '@/utils/offlineQueue';
import { OXY_CLIENT_ID, OXY_AUTH_REDIRECT_URI } from '@/constants/oxy';
import * as SplashScreen from 'expo-splash-screen';

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
      <RootLayoutContent />
    </BloomProvider>
  );
}

function RootLayoutContent() {
  const navTheme = useNavigationTheme();

  return (
    <KeyboardProvider>
      <OxyProvider baseURL={API_URL} clientId={OXY_CLIENT_ID} authRedirectUri={OXY_AUTH_REDIRECT_URI} queryClient={queryClient}>
        <InboxCacheRestoreGate>
          <BloomImageResolver>
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
          </BloomImageResolver>
        </InboxCacheRestoreGate>
      </OxyProvider>
    </KeyboardProvider>
  );
}

function GatedNavigator() {
  const { t } = useTranslation();
  return (
    <RequireOxyAuth prompt="hard" title={t('auth.gate.title')} subtitle={t('auth.gate.subtitle')}>
      <Stack>
        <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" options={{ headerShown: false }} />
      </Stack>
    </RequireOxyAuth>
  );
}

function InboxCacheRestoreGate({ children }: { children: ReactNode }) {
  const { activeSessionId, isAuthResolved, user } = useOxy();
  const [ready, setReady] = useState(false);
  const [readyScope, setReadyScope] = useState<string | null>(null);
  const initializedScopeRef = useRef<string | null | undefined>(undefined);
  const scope = isAuthResolved ? activeSessionId ?? user?.id ?? null : null;

  useEffect(() => {
    if (!isAuthResolved) return;

    let cancelled = false;
    const previousScope = initializedScopeRef.current;
    const isInitialScope = previousScope === undefined;
    initializedScopeRef.current = scope;

    void activateInboxQueryScope(scope, !isInitialScope && previousScope !== null).then(() => {
      if (cancelled) return;
      if (!isInitialScope) {
        useEmailStore.getState().resetAccountScopedState();
      }
      setReadyScope(scope);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthResolved, scope]);

  if (!isAuthResolved || !ready || readyScope !== scope) {
    return <View style={{ flex: 1, backgroundColor: '#ffffff' }} />;
  }

  return <ScopedInboxPrefsProvider>{children}</ScopedInboxPrefsProvider>;
}

function ScopedInboxPrefsProvider({ children }: { children: ReactNode }) {
  const { user } = useOxy();
  const scope = user?.id ?? null;
  return (
    <InboxPrefsProvider key={scope ?? 'anonymous'} scope={scope}>
      {children}
    </InboxPrefsProvider>
  );
}

function BloomImageResolver({ children }: { children: ReactNode }) {
  const { oxyServices } = useOxy();
  const resolve = useCallback<ImageResolver>(
    (id, variant) => oxyServices.getFileDownloadUrl(id, variant),
    [oxyServices],
  );
  return <ImageResolverProvider value={resolve}>{children}</ImageResolverProvider>;
}

function RootEffects() {
  const { t } = useTranslation();
  const { canUsePrivateApi } = useOxy();

  useInboxSocket({ baseURL: API_URL });
  usePushRegistration();
  useEmailPushNotifications(canUsePrivateApi);
  useForegroundNotificationHandler();
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    registerServiceWorker(() => {
      toast.info(t('inbox.toast.newVersionAvailable'));
    });

    void clearQueue();
  }, [t]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const head = document.head;
    if (!head) return;
    const style = document.createElement('style');
    style.textContent = [
      '@keyframes bloomDialogFadeIn { from { opacity: 0; } to { opacity: 1; } }',
      '@keyframes bloomDialogFadeOut { from { opacity: 1; } to { opacity: 0; } }',
      '@keyframes bloomDialogZoomFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }',
      '@keyframes bloomDialogZoomFadeOut { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.95); } }',
    ].join('\n');
    head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  return null;
}
