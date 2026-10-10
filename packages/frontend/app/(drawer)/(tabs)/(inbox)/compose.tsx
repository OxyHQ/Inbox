import { useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';

import { ComposeForm } from '@/components/ComposeForm';
import { useTranslation } from '@/lib/i18n';

export default function ComposeRoute() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    draftId?: string;
    replyTo?: string;
    forward?: string;
    to?: string;
    cc?: string;
    subject?: string;
    body?: string;
  }>();

  const pageTitle = params.subject
    ? t('compose.headTitleWithSubject', { subject: params.subject })
    : t('compose.headTitleCompose');

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
      </Head>
      {/* Keyed so opening another draft or reply starts a new session. */}
      <ComposeForm
        key={params.draftId ?? params.replyTo ?? params.forward ?? 'new'}
        draftId={params.draftId}
        replyTo={params.replyTo}
        forward={params.forward}
        to={params.to}
        cc={params.cc}
        subject={params.subject}
        body={params.body}
      />
    </>
  );
}
