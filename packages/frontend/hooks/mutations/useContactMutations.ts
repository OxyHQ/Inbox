import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  assertMessageOwner,
  ownsMessageOperation,
  useGuardedMessageMutation,
} from '@/hooks/mutations/guardedMessageMutation';
import { toast } from '@oxy.so/bloom/toast';
import { useEmailStore } from '@/hooks/useEmail';
import { emailKeys } from '@/hooks/queries/queryKeys';
import type { Contact } from '@/services/emailApi';
import type { ContactsInfinite } from '@/hooks/queries/useContacts';
import { useTranslation } from '@/lib/i18n';

type ContactsSnapshot = [readonly unknown[], unknown][];

/**
 * Apply `updater` to one cached contacts list. The list is an infinite query
 * (`{ pages: [{ data, pagination }] }`); the updater runs over every page's
 * rows, and a prepend (`create`) lands on the first page only. Anything else
 * under the `contacts` root — an entry restored from before the list was
 * paginated — is left alone rather than reshaped.
 */
function applyToContacts(
  old: unknown,
  updater: (prev: Contact[], pageIndex: number) => Contact[],
): unknown {
  const cache = old as ContactsInfinite | undefined;
  if (!cache || !Array.isArray(cache.pages)) return old;
  return {
    ...cache,
    pages: cache.pages.map((page, index) => ({ ...page, data: updater(page.data, index) })),
  };
}

/**
 * Apply an optimistic updater across every cached `['contacts', …]` variant
 * (the list is keyed by search query) and return the snapshot for rollback.
 */
async function optimisticContacts(
  queryClient: ReturnType<typeof useQueryClient>,
  variables: object,
  updater: (prev: Contact[], pageIndex: number) => Contact[],
): Promise<{ prev: ContactsSnapshot }> {
  await queryClient.cancelQueries({ queryKey: emailKeys.contacts.root });
  assertMessageOwner(variables);
  const prev = queryClient.getQueriesData<unknown>({ queryKey: emailKeys.contacts.root });
  for (const [key] of prev) {
    assertMessageOwner(variables);
    queryClient.setQueryData<unknown>(key, (old: unknown) => applyToContacts(old, updater));
  }
  return { prev };
}

function restoreContacts(
  queryClient: ReturnType<typeof useQueryClient>,
  prev: ContactsSnapshot,
  variables: object,
) {
  for (const [key, data] of prev) {
    if (!ownsMessageOperation(variables)) return;
    queryClient.setQueryData(key, data);
  }
}

export function useCreateContact() {
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const onUnavailable = useCallback(() => toast.error(t('contacts.toast.sessionUnavailable')), [t]);

  return useGuardedMessageMutation(
    {
      mutationFn: async (data: {
        name: string;
        email: string;
        company?: string;
        notes?: string;
        starred?: boolean;
      }) => {
        if (!api) throw new Error('Email API not initialized');
        return api.createContact(data);
      },
      onMutate: async (data) => {
        const now = new Date().toISOString();
        const tempId = `optimistic:${Date.now()}`;
        const optimistic: Contact = {
          _id: tempId,
          id: tempId,
          userId: '',
          name: data.name,
          email: data.email,
          company: data.company ?? null,
          notes: data.notes ?? null,
          lastContactedAt: null,
          starred: data.starred ?? false,
          autoCollected: false,
          createdAt: now,
          updatedAt: now,
        };
        const { prev } = await optimisticContacts(queryClient, data, (contacts, page) =>
          page === 0 ? [optimistic, ...contacts] : contacts,
        );
        return { prev };
      },
      onError: (err: Error, variables, context) => {
        if (context?.prev) restoreContacts(queryClient, context.prev, variables);
        if (!ownsMessageOperation(variables)) return;
        toast.error(err.message || t('ui.mutations.contactCreateFailed'));
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: emailKeys.contacts.root });
      },
    },
    onUnavailable,
  );
}

export function useUpdateContact() {
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const onUnavailable = useCallback(() => toast.error(t('contacts.toast.sessionUnavailable')), [t]);

  return useGuardedMessageMutation(
    {
      mutationFn: async ({
        contactId,
        ...updates
      }: {
        contactId: string;
        name?: string;
        email?: string;
        company?: string;
        notes?: string;
        starred?: boolean;
      }) => {
        if (!api) throw new Error('Email API not initialized');
        return api.updateContact(contactId, updates);
      },
      onMutate: async (variables) => {
        const { contactId, ...updates } = variables;
        const { prev } = await optimisticContacts(queryClient, variables, (contacts) =>
          contacts.map((c) => (c._id === contactId ? { ...c, ...updates } : c)),
        );
        return { prev };
      },
      onError: (err: Error, variables, context) => {
        if (context?.prev) restoreContacts(queryClient, context.prev, variables);
        if (!ownsMessageOperation(variables)) return;
        toast.error(err.message || t('ui.mutations.contactUpdateFailed'));
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: emailKeys.contacts.root });
      },
    },
    onUnavailable,
  );
}

export function useDeleteContact() {
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const onUnavailable = useCallback(() => toast.error(t('contacts.toast.sessionUnavailable')), [t]);

  return useGuardedMessageMutation(
    {
      mutationFn: async ({ contactId }: { contactId: string }) => {
        if (!api) throw new Error('Email API not initialized');
        return api.deleteContact(contactId);
      },
      onMutate: async (variables) => {
        const { contactId } = variables;
        const { prev } = await optimisticContacts(queryClient, variables, (contacts) =>
          contacts.filter((c) => c._id !== contactId),
        );
        return { prev };
      },
      onError: (_err, variables, context) => {
        if (context?.prev) restoreContacts(queryClient, context.prev, variables);
        if (!ownsMessageOperation(variables)) return;
        toast.error(t('ui.mutations.contactDeleteFailed'));
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: emailKeys.contacts.root });
      },
    },
    onUnavailable,
  );
}
