import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@oxy.so/bloom/toast';
import { emailKeys } from '@/hooks/queries/queryKeys';
import type { EmailTemplate } from '@/services/emailApi';
import { useTranslation } from '@/lib/i18n';
import {
  type OwnedVariables,
  type EmailMutationContext,
  useEmailMutationOwner,
  ownsEmailMutation,
  emailMutationApi,
  exposeOwnedEmailMutation,
} from '@/hooks/mutations/ownedEmailMutation';

const TEMPLATES_KEY = emailKeys.templates;
const rollbackSnapshots = new WeakMap<object, EmailTemplate[] | undefined>();

async function optimisticTemplates<T>(
  queryClient: ReturnType<typeof useQueryClient>,
  variables: OwnedVariables<T>,
  updater: (prev: EmailTemplate[]) => EmailTemplate[],
): Promise<undefined> {
  if (!ownsEmailMutation(variables)) return undefined;
  await queryClient.cancelQueries({ queryKey: TEMPLATES_KEY });
  if (!ownsEmailMutation(variables)) return undefined;
  const prev = queryClient.getQueryData<EmailTemplate[]>(TEMPLATES_KEY);
  rollbackSnapshots.set(variables, prev);
  queryClient.setQueryData<EmailTemplate[]>(TEMPLATES_KEY, (old) => updater(old ?? []));
  return undefined;
}

function rollbackTemplates<T>(
  queryClient: ReturnType<typeof useQueryClient>,
  variables: OwnedVariables<T>,
) {
  const prev = rollbackSnapshots.get(variables);
  if (prev) queryClient.setQueryData(TEMPLATES_KEY, prev);
}

export function useCreateTemplate() {
  const owner = useEmailMutationOwner();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  type Input = { name: string; subject?: string; body: string };
  const mutation = useMutation<EmailTemplate, Error, OwnedVariables<Input>, EmailMutationContext>({
    mutationFn: async (variables) => emailMutationApi(variables).createTemplate(variables.input),
    onMutate: async (variables) => {
      const data = variables.input;
      const now = new Date().toISOString();
      const optimistic: EmailTemplate = {
        _id: `optimistic:${Date.now()}`,
        userId: '',
        name: data.name,
        subject: data.subject ?? '',
        body: data.body,
        order: Number.MAX_SAFE_INTEGER,
        createdAt: now,
        updatedAt: now,
      };
      return optimisticTemplates(queryClient, variables, (templates) => [...templates, optimistic]);
    },
    onError: (_err, variables) => {
      if (!ownsEmailMutation(variables)) return;
      rollbackTemplates(queryClient, variables);
      toast.error(t('ui.mutations.templateCreateFailed'));
    },
    onSettled: (_data, _error, variables) => {
      if (ownsEmailMutation(variables))
        void queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY });
    },
  });
  return exposeOwnedEmailMutation(owner, mutation);
}

export function useUpdateTemplate() {
  const owner = useEmailMutationOwner();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  type Input = { templateId: string; name?: string; subject?: string; body?: string };
  const mutation = useMutation<EmailTemplate, Error, OwnedVariables<Input>, EmailMutationContext>({
    mutationFn: async (variables) => {
      const { templateId, ...updates } = variables.input;
      return emailMutationApi(variables).updateTemplate(templateId, updates);
    },
    onMutate: async (variables) => {
      const { templateId, ...updates } = variables.input;
      return optimisticTemplates(queryClient, variables, (templates) =>
        templates.map((template) =>
          template._id === templateId ? { ...template, ...updates } : template,
        ),
      );
    },
    onError: (_err, variables) => {
      if (!ownsEmailMutation(variables)) return;
      rollbackTemplates(queryClient, variables);
      toast.error(t('ui.mutations.templateUpdateFailed'));
    },
    onSettled: (_data, _error, variables) => {
      if (ownsEmailMutation(variables))
        void queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY });
    },
  });
  return exposeOwnedEmailMutation(owner, mutation);
}

export function useDeleteTemplate() {
  const owner = useEmailMutationOwner();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const mutation = useMutation<void, Error, OwnedVariables<string>, EmailMutationContext>({
    mutationFn: async (variables) => emailMutationApi(variables).deleteTemplate(variables.input),
    onMutate: async (variables) =>
      optimisticTemplates(queryClient, variables, (templates) =>
        templates.filter((template) => template._id !== variables.input),
      ),
    onError: (_err, variables) => {
      if (!ownsEmailMutation(variables)) return;
      rollbackTemplates(queryClient, variables);
      toast.error(t('ui.mutations.templateDeleteFailed'));
    },
    onSettled: (_data, _error, variables) => {
      if (ownsEmailMutation(variables))
        void queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY });
    },
  });
  return exposeOwnedEmailMutation(owner, mutation);
}
