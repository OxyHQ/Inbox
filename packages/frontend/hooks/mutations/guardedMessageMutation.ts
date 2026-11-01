import { useLayoutEffect, useMemo, useRef } from 'react';
import { useOxyRuntime } from '@oxy.so/services/runtime';
import { useEmailStore } from '@/hooks/useEmail';
import {
  useMutation,
  useQueryClient,
  type MutateOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';
import { isCurrentEmailOwner, useEmailMutationOwner } from '@/hooks/mutations/ownedEmailMutation';

class MessageOwnerChangedError extends Error {
  constructor() {
    super('Email account changed');
  }
}

type Owner = ReturnType<typeof useEmailMutationOwner>;
const owners = new WeakMap<object, Owner>();

export function ownsMessageOperation(variables: object): boolean {
  return isCurrentEmailOwner(owners.get(variables));
}
export function assertMessageOwner(variables: object): void {
  if (!ownsMessageOperation(variables)) throw new MessageOwnerChangedError();
}

/** Guards live operations; persisted mutations still use the registered replay defaults. */
export function useGuardedMessageMutation<TData, TVariables extends object, TContext>(
  options: UseMutationOptions<TData, Error, TVariables, TContext>,
  onUnavailable?: (options: { quiet?: boolean } | undefined, variables: TVariables) => void,
) {
  const owner = useEmailMutationOwner(true);
  const runtime = useOxyRuntime();
  const projection = runtime.getAccountSessionIdentity();
  const feedbackScope = useRef<{ runtime: typeof runtime; mounted: boolean } | null>(null);
  useLayoutEffect(() => {
    const scope = { runtime, mounted: true };
    feedbackScope.current = scope;
    return () => {
      scope.mounted = false;
    };
  }, [runtime]);
  const queryClient = useQueryClient();
  const inheritedRetry =
    options.retry ??
    (options.mutationKey
      ? queryClient.getMutationDefaults(options.mutationKey).retry
      : undefined) ??
    queryClient.getDefaultOptions().mutations?.retry ??
    0;
  const mutation = useMutation<TData, Error, TVariables, TContext>({
    ...options,
    retry: (failureCount, error) => {
      if (error instanceof MessageOwnerChangedError) return false;
      if (typeof inheritedRetry === 'function') return inheritedRetry(failureCount, error);
      return (
        inheritedRetry === true ||
        (typeof inheritedRetry === 'number' && failureCount < inheritedRetry)
      );
    },
    mutationFn: async (variables, context) => {
      assertMessageOwner(variables);
      if (!options.mutationFn) throw new Error('Message mutation function is missing');
      const data = await options.mutationFn(variables, context);
      assertMessageOwner(variables);
      return data;
    },
    onMutate: async (variables, context) => {
      assertMessageOwner(variables);
      if (!options.onMutate) throw new Error('Message mutation preparation is missing');
      return await options.onMutate(variables, context);
    },
    onSuccess: (data, variables, result, context) => {
      if (ownsMessageOperation(variables))
        return options.onSuccess?.(data, variables, result, context);
    },
    onError: (error, variables, result, context) => {
      if (ownsMessageOperation(variables))
        return options.onError?.(error, variables, result, context);
    },
    onSettled: (data, error, variables, result, context) => {
      if (ownsMessageOperation(variables))
        return options.onSettled?.(data, error, variables, result, context);
    },
  });
  const { api, http, session, subjectId, checkKnownSubject, epoch } = owner;
  const { mutate, mutateAsync } = mutation;
  const actions = useMemo(() => {
    const captured: Owner = { api, http, session, subjectId, checkKnownSubject, epoch };
    function prepare(
      variables: TVariables,
      callbacks?: MutateOptions<TData, Error, TVariables, TContext>,
      feedback?: { quiet?: boolean },
    ) {
      const copy = { ...variables } as TVariables;
      owners.set(copy, captured);
      /* Report only an unavailable action in the same observed UI context. This
       * projection is not an authorization check and does not identify actors. */
      if (
        !isCurrentEmailOwner(captured) &&
        feedbackScope.current?.mounted === true &&
        feedbackScope.current.runtime === runtime &&
        captured.api === useEmailStore.getState()._api &&
        captured.http.getSessionEpoch() === captured.epoch &&
        runtime.getAccountSessionRevision() === projection.revision
      ) {
        onUnavailable?.(feedback, copy);
      }
      const wrapped: MutateOptions<TData, Error, TVariables, TContext> | undefined = callbacks && {
        onSuccess: (data, value, result, context) => {
          if (ownsMessageOperation(value)) callbacks.onSuccess?.(data, value, result, context);
        },
        onError: (error, value, result, context) => {
          if (ownsMessageOperation(value)) callbacks.onError?.(error, value, result, context);
        },
        onSettled: (data, error, value, result, context) => {
          if (ownsMessageOperation(value))
            callbacks.onSettled?.(data, error, value, result, context);
        },
      };
      return { copy, wrapped };
    }
    return {
      mutate: (
        variables: TVariables,
        callbacks?: MutateOptions<TData, Error, TVariables, TContext>,
        feedback?: { quiet?: boolean },
      ) => {
        const { copy, wrapped } = prepare(variables, callbacks, feedback);
        mutate(copy, wrapped);
      },
      mutateAsync: (
        variables: TVariables,
        callbacks?: MutateOptions<TData, Error, TVariables, TContext>,
        feedback?: { quiet?: boolean },
      ) => {
        const { copy, wrapped } = prepare(variables, callbacks, feedback);
        return mutateAsync(copy, wrapped).then(
          (data) => {
            assertMessageOwner(copy);
            return data;
          },
          (error: unknown) => {
            assertMessageOwner(copy);
            throw error;
          },
        );
      },
    };
  }, [
    api,
    http,
    session,
    subjectId,
    checkKnownSubject,
    epoch,
    mutate,
    mutateAsync,
    runtime,
    projection.revision,
    onUnavailable,
  ]);
  const pendingOwner = mutation.variables ? owners.get(mutation.variables) : undefined;
  const visible =
    !mutation.variables ||
    Boolean(
      pendingOwner &&
        isCurrentEmailOwner(pendingOwner) &&
        pendingOwner.api === owner.api &&
        pendingOwner.http === owner.http &&
        pendingOwner.session === owner.session &&
        pendingOwner.subjectId === owner.subjectId &&
        pendingOwner.epoch === owner.epoch,
    );
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
          variables: undefined,
        }
      : {}),
    ...actions,
  };
}
