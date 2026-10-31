import type { MutateOptions, UseMutationResult } from '@tanstack/react-query';
import { useOxy } from '@oxy.so/services/ui/client';
import { useCallback, useSyncExternalStore } from 'react';
import type { OxyServices } from '@oxy.so/core';
import { useEmailStore } from '@/hooks/useEmail';
import type { EmailApiInstance } from '@/services/emailApi';

/** The store replaces the API whenever the active account is reset. */
function isCurrentApi(api: EmailApiInstance | null): boolean {
  return useEmailStore.getState()._api === api;
}

/**
 * The API remains in memory: mutation variables may be dehydrated by older SDKs.
 * A deserialized operation has no owner and must never run under a new account.
 */
export type OwnedVariables<T> = { input: T };
type EmailMutationOwner = {
  api: EmailApiInstance | null;
  http: OxyServices['http'];
  epoch: number;
};
export type EmailMutationContext = undefined;
const mutationOwners = new WeakMap<object, EmailMutationOwner>();

/** Capture the SDK's session epoch as a React snapshot for callbacks from this render. */
export function useEmailMutationOwner(): EmailMutationOwner {
  const api = useEmailStore((s) => s._api);
  const { oxyServices } = useOxy();
  const http = oxyServices.http;
  const subscribe = useCallback(
    (notify: () => void) => http.addTokenChangeListener(notify),
    [http],
  );
  const snapshot = useCallback(() => http.getSessionEpoch(), [http]);
  const epoch = useSyncExternalStore(subscribe, snapshot, snapshot);
  return { api, http, epoch };
}

export function ownsEmailMutation<T>(variables: OwnedVariables<T>): boolean {
  const owner = mutationOwners.get(variables);
  return (
    owner?.api != null && isCurrentApi(owner.api) && owner.http.getSessionEpoch() === owner.epoch
  );
}

/** Both values are immutable snapshots from the corresponding React renders. */
function matchesRenderOwner<T>(variables: OwnedVariables<T>, current: EmailMutationOwner): boolean {
  const initial = mutationOwners.get(variables);
  return (
    initial?.api != null &&
    initial.api === current.api &&
    initial.http === current.http &&
    initial.epoch === current.epoch
  );
}

export function emailMutationApi<T>(variables: OwnedVariables<T>): EmailApiInstance {
  if (!mutationOwners.has(variables)) throw new Error('Email account changed');
  const owner = mutationOwners.get(variables);
  if (!owner?.api) throw new Error('Email API not initialized');
  if (!ownsEmailMutation(variables)) throw new Error('Email account changed');
  return owner.api;
}

/** Bind each invocation to the API from its originating render, including per-call callbacks. */
export function exposeOwnedEmailMutation<TData, TVariables>(
  owner: EmailMutationOwner,
  mutation: UseMutationResult<TData, Error, OwnedVariables<TVariables>, EmailMutationContext>,
) {
  type PublicOptions = MutateOptions<TData, Error, TVariables, EmailMutationContext>;
  const prepare = (input: TVariables, options?: PublicOptions) => {
    const variables: OwnedVariables<TVariables> = { input };
    mutationOwners.set(variables, owner);
    const adapted:
      | MutateOptions<TData, Error, OwnedVariables<TVariables>, EmailMutationContext>
      | undefined = options && {
      onSuccess: (data, owned, context, mutationContext) => {
        if (ownsEmailMutation(owned))
          options.onSuccess?.(data, owned.input, context, mutationContext);
      },
      onError: (error, owned, context, mutationContext) => {
        if (ownsEmailMutation(owned))
          options.onError?.(error, owned.input, context, mutationContext);
      },
      onSettled: (data, error, owned, context, mutationContext) => {
        if (ownsEmailMutation(owned))
          options.onSettled?.(data, error, owned.input, context, mutationContext);
      },
    };
    return { variables, options: adapted };
  };
  const visible = !mutation.variables || matchesRenderOwner(mutation.variables, owner);
  return {
    ...mutation,
    ...(!visible
      ? {
          context: undefined,
          data: undefined,
          error: null,
          failureCount: 0,
          failureReason: null,
          isError: false,
          isIdle: true,
          isPaused: false,
          isPending: false,
          isSuccess: false,
          status: 'idle' as const,
          submittedAt: 0,
        }
      : {}),
    variables: visible ? mutation.variables?.input : undefined,
    mutate: (input: TVariables, options?: PublicOptions) => {
      const prepared = prepare(input, options);
      mutation.mutate(prepared.variables, prepared.options);
    },
    mutateAsync: (input: TVariables, options?: PublicOptions) => {
      const prepared = prepare(input, options);
      return mutation.mutateAsync(prepared.variables, prepared.options).then(
        (data) => {
          if (!ownsEmailMutation(prepared.variables)) throw new Error('Email account changed');
          return data;
        },
        (error: unknown) => {
          if (!ownsEmailMutation(prepared.variables)) throw new Error('Email account changed');
          throw error;
        },
      );
    },
  };
}
