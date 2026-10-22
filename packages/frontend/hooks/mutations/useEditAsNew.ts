import { toast } from '@oxy.so/bloom/toast';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { useSaveDraft } from '@/hooks/mutations/useMessageMutations';
import { useTranslation } from '@/lib/i18n';
import type { Message } from '@/schemas/emailSchemas';
import { draftFromMessage } from '@/utils/delivery';

/**
 * Reopen a message that was not delivered as a new draft, and open it in the
 * composer. A draft, not route params: params cannot carry Bcc, attachments or
 * threading, and Edit as new must not quietly drop any of them.
 */
export function useEditAsNew() {
  const router = useRouter();
  const { t } = useTranslation();
  const saveDraft = useSaveDraft();
  const { mutate } = saveDraft;

  const editAsNew = useCallback(
    (message: Message) =>
      mutate(draftFromMessage(message), {
        onSuccess: (draft) => router.push({ pathname: '/compose', params: { draftId: draft._id } }),
        onError: () => toast.error(t('delivery.editAsNewError')),
      }),
    [mutate, router, t],
  );

  return { editAsNew, isPending: saveDraft.isPending };
}
