import type { MutateOptions, UseMutationResult } from '@tanstack/react-query';
import { useOxy } from '@oxy.so/services/ui/client';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
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
  session: OxyServices['session'];
  subjectId: string | null;
  checkKnownSubject: boolean;
  epoch: number;
};
export type EmailMutationContext = undefined;
const mutationOwners = new WeakMap<object, EmailMutationOwner>();

/**
 * Capture the SDK session epoch for callbacks from this render. When requested,
 * reject a known bearer subject that differs from the visible user; an opaque
 * bearer has no subject to compare and retains the existing epoch guard.
 */
export function useEmailMutationOwner(checkKnownSubject = false): EmailMutationOwner {
  const api = useEmailStore((s) => s._api);
  const { oxyServices, user } = useOxy();
  const http = oxyServices.http;
  const subscribe = useCallback(
    (notify: () => void) => http.addTokenChangeListener(notify),
    [http],
  );
  const snapshot = useCallback(() => http.getSessionEpoch(), [http]);
  const epoch = useSyncExternalStore(subscribe, snapshot, snapshot);
  return {
    api,
    http,
    session: oxyServices.session,
    subjectId: user?.id ?? null,
    checkKnownSubject,
    epoch,
  };
}

export function ownsEmailMutation<T>(variables: OwnedVariables<T>): boolean {
  const owner = mutationOwners.get(variables);
  return (
    owner?.api != null &&
    isCurrentApi(owner.api) &&
    owner.http.getSessionEpoch() === owner.epoch &&
    (!owner.checkKnownSubject ||
      (owner.subjectId !== null &&
        Boolean(owner.http.getAccessToken()) &&
        (owner.session.userId === null || owner.session.userId === owner.subjectId)))
  );
}

/** Both values are immutable snapshots from the corresponding React renders. */
function matchesRenderOwner<T>(variables: OwnedVariables<T>, current: EmailMutationOwner): boolean {
  const initial = mutationOwners.get(variables);
  return (
    initial?.api != null &&
    initial.api === current.api &&
    initial.http === current.http &&
    initial.checkKnownSubject === current.checkKnownSubject &&
    (!initial.checkKnownSubject ||
      (initial.session === current.session && initial.subjectId === current.subjectId)) &&
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

function ownedEmailMutationActions<TData, TVariables>(
  owner: EmailMutationOwner,
  mutate: UseMutationResult<
    TData,
    Error,
    OwnedVariables<TVariables>,
    EmailMutationContext
  >['mutate'],
  mutateAsync: UseMutationResult<
    TData,
    Error,
    OwnedVariables<TVariables>,
    EmailMutationContext
  >['mutateAsync'],
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
  return {
    mutate: (input: TVariables, options?: PublicOptions) => {
      const prepared = prepare(input, options);
      mutate(prepared.variables, prepared.options);
    },
    mutateAsync: (input: TVariables, options?: PublicOptions) => {
      const prepared = prepare(input, options);
      return mutateAsync(prepared.variables, prepared.options).then(
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

/** Bind each invocation to the API from its originating render, including per-call callbacks. */
export function exposeOwnedEmailMutation<TData, TVariables>(
  owner: EmailMutationOwner,
  mutation: UseMutationResult<TData, Error, OwnedVariables<TVariables>, EmailMutationContext>,
) {
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
    ...ownedEmailMutationActions(owner, mutation.mutate, mutation.mutateAsync),
  };
}

/** Stable actions avoid restarting effects while keeping their original session owner. */
export function useStableOwnedEmailMutation<TData, TVariables>(
  owner: EmailMutationOwner,
  mutation: UseMutationResult<TData, Error, OwnedVariables<TVariables>, EmailMutationContext>,
) {
  const { api, http, session, subjectId, checkKnownSubject, epoch } = owner;
  const { mutate, mutateAsync } = mutation;
  const actions = useMemo(
    () =>
      ownedEmailMutationActions(
        { api, http, session, subjectId, checkKnownSubject, epoch },
        mutate,
        mutateAsync,
      ),
    [api, http, session, subjectId, checkKnownSubject, epoch, mutate, mutateAsync],
  );
  return { ...exposeOwnedEmailMutation(owner, mutation), ...actions };
}
