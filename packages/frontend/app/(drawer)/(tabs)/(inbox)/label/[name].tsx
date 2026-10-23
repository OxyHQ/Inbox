/**
 * Dynamic route for label views — /label/<name>.
 *
 * Syncs the URL label name into the email store (Zustand) so `InboxList`
 * fetches messages filtered by the matching label.
 *
 * The shell owns the filtered list at every width.
 *
 * Once the account's labels resolve, an unknown label returns to Inbox.
 * Never keep showing the previous mailbox under an invalid label URL.
 */

import { Redirect, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useOxy } from '@oxy.so/services/ui/client';
import Head from 'expo-router/head';
import { useEffect, useMemo } from 'react';

import { MessageDetailEmpty } from '@/components/MessageDetailEmpty';
import { useLabels } from '@/hooks/queries/useLabels';
import { useTranslation } from '@/lib/i18n';
import { useEmailStore } from '@/hooks/useEmail';

export default function LabelViewRoute() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const { data: labels, isSuccess } = useLabels();
  const { canUsePrivateApi, isAccountCacheReady } = useOxy();
  const accountReady = canUsePrivateApi && isAccountCacheReady;

  const selectLabel = useEmailStore((s) => s.selectLabel);

  const label = useMemo(() => {
    if (!name) return null;
    const target = name.toLowerCase();
    return labels?.find((l) => l.name.toLowerCase() === target) ?? null;
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

  if (isFocused && accountReady && isSuccess && labels && !label) return <Redirect href="/" />;

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
      </Head>
      <MessageDetailEmpty />
    </>
  );
}
