/**
 * What a section shows when something in it fails to render — instead of the
 * whole app. Expo Router mounts it for a route that exports it as
 * `ErrorBoundary`, inside every provider, so the drawer, the tabs and anything
 * unsaved elsewhere survive; `retry` re-renders the section.
 *
 * The app had one boundary, at the root and outside every provider: one bad
 * render anywhere unmounted everything, compose state included, and its Retry
 * remounted the same tree into the same error.
 */

import { EmptyState } from '@oxy.so/bloom/empty-state';
import type { ErrorBoundaryProps } from 'expo-router';
import { EmptyStateSticker } from '@/components/EmptyStateSticker';

import { useTranslation } from '@/lib/i18n';
import { Embed, VStack, toElement } from '@oxy.so/bloom-language';

export function RouteErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  return toElement(
    VStack(
      Embed(
        <EmptyState
          illustration={<EmptyStateSticker name="loadError" />}
          title={t('ui.error.title')}
          description={__DEV__ ? error.message : t('ui.error.description')}
          action={{ label: t('common.retry'), onPress: () => void retry() }}
        />,
      ),
    ).flex('1'),
  );
}
