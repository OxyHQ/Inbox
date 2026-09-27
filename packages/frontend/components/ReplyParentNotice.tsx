/**
 * Why a reply's Send button is disabled, when the reason is its parent.
 *
 * A reply waits for the message it answers so it can carry that message's
 * threading headers (see `useReplyParent`). While it loads, Send shows its
 * loading label; if it fails, this says so and offers a retry — the reply is
 * never sent unthreaded instead.
 */

import React from 'react';
import {
  AdmonitionButton,
  AdmonitionContent,
  AdmonitionIcon,
  AdmonitionRoot,
  AdmonitionRow,
  AdmonitionText,
} from '@oxy.so/bloom/admonition';

import { useTranslation } from '@/lib/i18n';
import type { ReplyParentState } from '@/hooks/useReplyParent';

export function ReplyParentNotice({ state }: { state: Pick<ReplyParentState, 'status' | 'retry'> }) {
  const { t } = useTranslation();
  if (state.status !== 'error') return null;

  return (
    <AdmonitionRoot type="error">
      <AdmonitionRow>
        <AdmonitionIcon />
        <AdmonitionContent>
          <AdmonitionText>{t('compose.replyParentError')}</AdmonitionText>
        </AdmonitionContent>
        <AdmonitionButton onPress={state.retry}>{t('common.retry')}</AdmonitionButton>
      </AdmonitionRow>
    </AdmonitionRoot>
  );
}
