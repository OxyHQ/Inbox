import { useIsDesktopLayout } from '@/hooks/useIsDesktopLayout';
/**
 * Dynamic route for label views — /label/<name>.
 *
 * Syncs the URL label name into the email store (Zustand) so `InboxList`
 * fetches messages filtered by the matching label.
 *
 * The shell owns the filtered list on wide screens; this route owns it on phones.
 *
 * When the URL points to a label that doesn't exist (no match on
 * lowercased name), we surface the empty-detail component with a "not
 * found" page title rather than 404'ing — the user can pick another
 * label from the drawer.
 */

import { useIsFocused, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useMemo } from 'react';

import { InboxList } from '@/components/InboxList';
import { MessageDetailEmpty } from '@/components/MessageDetailEmpty';
import { useLabels } from '@/hooks/queries/useLabels';
import { useTranslation } from '@/lib/i18n';
import { useEmailStore } from '@/hooks/useEmail';

export default function LabelViewRoute() {
  const isDesktop = useIsDesktopLayout();
  const { name } = useLocalSearchParams<{ name: string }>();
  const { data: labels = [] } = useLabels();

  const selectLabel = useEmailStore((s) => s.selectLabel);

  const label = useMemo(() => {
    if (!name) return null;
    const target = name.toLowerCase();
    return labels.find((l) => l.name.toLowerCase() === target) ?? null;
  }, [name, labels]);

  const { t } = useTranslation();
  const pageTitle = useMemo(() => {
    const suffix = t('app.titleSuffix');
    if (label) return `${label.name} ${suffix}`;
    return `${t('label.notFound')} ${suffix}`;
  }, [label, t]);

  // Sync URL → Zustand once we have a resolved label. While labels are still
  // loading we skip so we don't blow away another view's selection.
  // Only while on screen: see MailboxView. Coming back here re-selects it.
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!isFocused || !label) return;
    selectLabel(label._id, label.name);
  }, [isFocused, label, selectLabel]);

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
      </Head>
      {label && !isDesktop ? <InboxList /> : <MessageDetailEmpty />}
    </>
  );
}
