/** Inbox compose assistance through Oxy's bounded `/email/ai/compose` lane. */

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useOxyRuntime } from '@oxy.so/services/runtime';
import { useMutation } from '@tanstack/react-query';
import { toast } from '@oxy.so/bloom/toast';
import { useOxy } from '@oxy.so/services/ui/client';
import { useTranslation } from '@/lib/i18n';
import { runInboxCompose, streamInboxDraft } from '@/services/inboxInferenceApi';
import { aiKeys } from '@/hooks/queries/queryKeys';

export type ComposeTone = 'professional' | 'casual' | 'friendly' | 'formal';

type RewriteOwner = {
  isCurrent: () => boolean;
  signal: AbortSignal;
  dispose: () => void;
  accountId: string | null;
  sessionId: string | null;
  revision: number;
  epoch: number;
  bindingId: symbol | null;
};

type ComposeOperation =
  | { kind: 'draft'; prompt: string; tone: ComposeTone }
  | {
      kind: 'streamDraft';
      prompt: string;
      tone: ComposeTone;
      signal: AbortSignal;
      onChunk?: (text: string) => void;
    }
  | { kind: 'polish'; text: string; owner?: RewriteOwner }
  | { kind: 'changeTone'; text: string; tone: ComposeTone; owner?: RewriteOwner }
  | {
      kind: 'adjustLength';
      text: string;
      direction: 'shorter' | 'longer';
      owner?: RewriteOwner;
    }
  | { kind: 'suggestSubject'; body: string; owner?: RewriteOwner };

interface UseAiComposeReturn {
  draft: (prompt: string, tone?: ComposeTone) => Promise<string>;
  polish: (text: string, owner?: RewriteOwner) => Promise<string>;
  changeTone: (text: string, tone: ComposeTone, owner?: RewriteOwner) => Promise<string>;
  adjustLength: (
    text: string,
    direction: 'shorter' | 'longer',
    owner?: RewriteOwner,
  ) => Promise<string>;
  captureOwner: () => RewriteOwner;
  isOwnerVisible: (owner: RewriteOwner) => boolean;
  suggestSubject: (body: string, owner?: RewriteOwner) => Promise<string>;
  streamDraft: (
    prompt: string,
    tone?: ComposeTone,
    onChunk?: (chunk: string) => void,
    onComplete?: (text: string, isCurrent: () => boolean) => void,
  ) => Promise<string>;
  isLoading: boolean;
  isCurrentStream: boolean;
  error: Error | null;
}

function abortedStream(): Error {
  const error = new Error('Inbox AI compose was aborted.');
  error.name = 'AbortError';
  return error;
}

export function useAiCompose(): UseAiComposeReturn {
  const { t } = useTranslation();
  const { oxyServices, user } = useOxy();
  const runtime = useOxyRuntime();
  const http = oxyServices.http;
  const subjectId = user?.id ?? null;
  const renderBinding = useMemo(
    () => ({ id: Symbol(), runtime, http, subjectId }),
    [runtime, http, subjectId],
  );
  const subscribeToken = useCallback(
    (notify: () => void) => http.addTokenChangeListener(notify),
    [http],
  );
  const getEpoch = useCallback(() => http.getSessionEpoch(), [http]);
  const epoch = useSyncExternalStore(subscribeToken, getEpoch, getEpoch);
  const subscribeProjection = useCallback(
    (notify: () => void) => runtime.subscribe(notify),
    [runtime],
  );
  const getProjectionRevision = useCallback(() => runtime.getAccountSessionRevision(), [runtime]);
  const projectionRevision = useSyncExternalStore(
    subscribeProjection,
    getProjectionRevision,
    getProjectionRevision,
  );
  const projection = runtime.getAccountSessionIdentity();
  const mountedRef = useRef(false);
  const committedServicesRef = useRef<{
    runtime: typeof runtime;
    http: typeof http;
    subjectId: string | null;
    id: symbol;
  } | null>(null);
  const streamControllerRef = useRef<AbortController | null>(null);
  const streamCleanupRef = useRef<(() => void) | null>(null);
  const rewriteStopsRef = useRef(new Set<() => void>());
  const [visibleStream, setVisibleStream] = useState<{
    accountId: string | null;
    sessionId: string | null;
    revision: number;
    epoch: number;
    runtime: typeof runtime;
    http: typeof http;
    bindingId: symbol | null;
  } | null>(null);

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      streamControllerRef.current?.abort();
      streamControllerRef.current = null;
      streamCleanupRef.current?.();
      streamCleanupRef.current = null;
      for (const stop of rewriteStopsRef.current) stop();
    };
  }, []);

  useLayoutEffect(() => {
    const binding = renderBinding;
    committedServicesRef.current = binding;
    return () => {
      if (committedServicesRef.current !== binding) return;
      committedServicesRef.current = null;
      streamControllerRef.current?.abort();
      streamCleanupRef.current?.();
      for (const stop of rewriteStopsRef.current) stop();
    };
  }, [renderBinding]);

  const mutation = useMutation<string, Error, ComposeOperation>({
    mutationKey: aiKeys.compose,
    mutationFn: async (operation) => {
      const http = oxyServices.http;
      const owner = 'owner' in operation ? operation.owner : undefined;
      if (owner && (!owner.isCurrent() || owner.signal.aborted)) throw abortedStream();
      const requireCurrent = (text: string) => {
        if (owner && (!owner.isCurrent() || owner.signal.aborted)) throw abortedStream();
        return text;
      };
      switch (operation.kind) {
        case 'draft':
          return (
            await runInboxCompose(http, {
              operation: 'draft',
              prompt: operation.prompt,
              tone: operation.tone,
            })
          ).text.trim();
        case 'streamDraft': {
          let fullText = '';
          try {
            for await (const chunk of streamInboxDraft(
              http,
              { operation: 'draft', prompt: operation.prompt, tone: operation.tone },
              operation.signal,
            )) {
              if (operation.signal.aborted) throw abortedStream();
              fullText += chunk;
              if (mountedRef.current) operation.onChunk?.(fullText);
            }
            if (operation.signal.aborted) throw abortedStream();
            return fullText.trim();
          } catch (error) {
            if (operation.signal.aborted) throw abortedStream();
            throw error;
          }
        }
        case 'polish':
          return requireCurrent(
            (
              await runInboxCompose(
                http,
                { operation: 'polish', text: operation.text },
                owner?.signal,
              )
            ).text.trim(),
          );
        case 'changeTone':
          return requireCurrent(
            (
              await runInboxCompose(
                http,
                { operation: 'change_tone', text: operation.text, tone: operation.tone },
                owner?.signal,
              )
            ).text.trim(),
          );
        case 'adjustLength':
          return requireCurrent(
            (
              await runInboxCompose(
                http,
                {
                  operation: 'adjust_length',
                  text: operation.text,
                  direction: operation.direction,
                },
                owner?.signal,
              )
            ).text.trim(),
          );
        case 'suggestSubject':
          return requireCurrent(
            (
              await runInboxCompose(
                http,
                { operation: 'suggest_subject', body: operation.body },
                owner?.signal,
              )
            ).text
              .trim()
              .replace(/^["']|["']$/g, ''),
          );
      }
    },
    // The toolbar leaves the text as it was on failure; this says why nothing
    // happened. An abort is a superseded or unmounted request, not a failure.
    onError: (error, operation) => {
      if (
        error.name === 'AbortError' ||
        ('owner' in operation &&
          operation.owner &&
          (operation.owner.signal.aborted || !operation.owner.isCurrent())) ||
        (operation.kind === 'streamDraft' && operation.signal.aborted) ||
        !mountedRef.current
      )
        return;
      toast.error(t('ai.toast.failed'));
    },
  });

  const { mutateAsync } = mutation;
  const draft = useCallback(
    (prompt: string, tone: ComposeTone = 'professional') =>
      mutateAsync({ kind: 'draft', prompt, tone }),
    [mutateAsync],
  );
  const captureOwner = useCallback(() => {
    const binding = committedServicesRef.current;
    const controller = new AbortController();
    const captured = {
      accountId: subjectId,
      sessionId: projection.sessionId,
      revision: projectionRevision,
    };
    const isCurrent = () => {
      const identity = runtime.getAccountSessionIdentity();
      const knownSubject = oxyServices.session.userId;
      if (
        !mountedRef.current ||
        committedServicesRef.current !== binding ||
        committedServicesRef.current?.runtime !== runtime ||
        committedServicesRef.current?.http !== http ||
        committedServicesRef.current?.subjectId !== captured.accountId ||
        captured.accountId === null ||
        identity.accountId !== captured.accountId ||
        http.getSessionEpoch() !== epoch ||
        !oxyServices.session.isAuthenticated ||
        (knownSubject !== null && knownSubject !== captured.accountId)
      )
        return false;
      if (identity.revision === captured.revision && identity.sessionId === captured.sessionId)
        return true;
      if (
        captured.sessionId === null &&
        identity.sessionId !== null &&
        identity.revision === captured.revision + 1
      ) {
        captured.sessionId = identity.sessionId;
        captured.revision = identity.revision;
        return true;
      }
      return false;
    };
    const initiallyCurrent = isCurrent();
    if (
      !initiallyCurrent &&
      mountedRef.current &&
      committedServicesRef.current?.runtime === runtime &&
      committedServicesRef.current?.http === http &&
      committedServicesRef.current?.subjectId === subjectId &&
      runtime.getAccountSessionRevision() === projectionRevision &&
      http.getSessionEpoch() === epoch
    )
      toast.error(t('ai.toast.failed'));
    let unsubscribeToken = () => {};
    let unsubscribeProjection = () => {};
    let disposed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      unsubscribeToken();
      unsubscribeProjection();
      rewriteStopsRef.current.delete(stop);
    };
    const stop = () => {
      controller.abort();
      dispose();
    };
    const check = () => {
      if (!isCurrent()) stop();
    };
    if (initiallyCurrent) {
      unsubscribeToken = http.addTokenChangeListener(check);
      unsubscribeProjection = runtime.subscribe(check);
      rewriteStopsRef.current.add(stop);
      check();
    } else {
      stop();
    }
    return {
      isCurrent,
      signal: controller.signal,
      dispose,
      accountId: subjectId,
      sessionId: projection.sessionId,
      revision: projectionRevision,
      epoch,
      bindingId: binding?.id ?? null,
    };
  }, [subjectId, projection.sessionId, projectionRevision, runtime, http, epoch, oxyServices, t]);
  const streamDraft = useCallback(
    async (
      prompt: string,
      tone: ComposeTone = 'professional',
      onChunk?: (chunk: string) => void,
      onComplete?: (text: string, isCurrent: () => boolean) => void,
    ) => {
      if (!mountedRef.current) throw abortedStream();
      streamControllerRef.current?.abort();
      streamCleanupRef.current?.();
      const controller = new AbortController();
      const binding = committedServicesRef.current;
      const captured = {
        accountId: subjectId,
        sessionId: projection.sessionId,
        revision: projectionRevision,
      };
      const current = (advance: boolean) => {
        const identity = runtime.getAccountSessionIdentity();
        const knownSubject = oxyServices.session.userId;
        if (
          !mountedRef.current ||
          committedServicesRef.current !== binding ||
          committedServicesRef.current?.runtime !== runtime ||
          committedServicesRef.current?.http !== http ||
          committedServicesRef.current?.subjectId !== captured.accountId ||
          captured.accountId === null ||
          identity.accountId !== captured.accountId ||
          http.getSessionEpoch() !== epoch ||
          !oxyServices.session.isAuthenticated ||
          (knownSubject !== null && knownSubject !== captured.accountId)
        )
          return false;
        if (identity.revision === captured.revision && identity.sessionId === captured.sessionId)
          return true;
        if (
          captured.sessionId === null &&
          identity.sessionId !== null &&
          identity.revision === captured.revision + 1
        ) {
          if (advance) {
            captured.sessionId = identity.sessionId;
            captured.revision = identity.revision;
          }
          return true;
        }
        return false;
      };
      if (!current(true)) {
        const identity = runtime.getAccountSessionIdentity();
        if (identity.revision === projectionRevision && http.getSessionEpoch() === epoch)
          toast.error(t('ai.toast.failed'));
        throw abortedStream();
      }
      streamControllerRef.current = controller;
      const visibleOwner = { ...captured, epoch, runtime, http, bindingId: binding?.id ?? null };
      setVisibleStream(visibleOwner);
      let cleanup = () => {};
      const check = () => {
        if (!current(true)) {
          controller.abort();
          cleanup();
        }
      };
      const unsubscribeToken = http.addTokenChangeListener(check);
      const unsubscribeProjection = runtime.subscribe(check);
      let cleaned = false;
      cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        unsubscribeToken();
        unsubscribeProjection();
      };
      streamCleanupRef.current = cleanup;
      check();
      try {
        const result = await mutateAsync({
          kind: 'streamDraft',
          prompt,
          tone,
          signal: controller.signal,
          onChunk: (chunk) => {
            if (!current(true)) controller.abort();
            if (!controller.signal.aborted) onChunk?.(chunk);
          },
        });
        if (!current(true) || controller.signal.aborted) throw abortedStream();
        onComplete?.(result, () => !controller.signal.aborted && current(false));
        return result;
      } finally {
        cleanup();
        if (streamControllerRef.current === controller) {
          streamControllerRef.current = null;
          streamCleanupRef.current = null;
          if (mountedRef.current)
            setVisibleStream((value) => (value === visibleOwner ? null : value));
        }
      }
    },
    [
      mutateAsync,
      subjectId,
      projection.sessionId,
      projectionRevision,
      runtime,
      http,
      epoch,
      oxyServices,
      t,
    ],
  );
  const polish = useCallback(
    (text: string, owner?: RewriteOwner) => mutateAsync({ kind: 'polish', text, owner }),
    [mutateAsync],
  );
  const changeTone = useCallback(
    (text: string, tone: ComposeTone, owner?: RewriteOwner) =>
      mutateAsync({ kind: 'changeTone', text, tone, owner }),
    [mutateAsync],
  );
  const adjustLength = useCallback(
    (text: string, direction: 'shorter' | 'longer', owner?: RewriteOwner) =>
      mutateAsync({ kind: 'adjustLength', text, direction, owner }),
    [mutateAsync],
  );
  const suggestSubject = useCallback(
    (body: string, owner?: RewriteOwner) => mutateAsync({ kind: 'suggestSubject', body, owner }),
    [mutateAsync],
  );

  const visibleProjectionMatches =
    visibleStream &&
    projection.accountId === visibleStream.accountId &&
    ((projection.revision === visibleStream.revision &&
      projection.sessionId === visibleStream.sessionId) ||
      (visibleStream.sessionId === null &&
        projection.sessionId !== null &&
        projection.revision === visibleStream.revision + 1));
  const isCurrentStream = Boolean(
    visibleStream &&
      visibleStream.accountId !== null &&
      visibleStream.accountId === subjectId &&
      visibleStream.runtime === runtime &&
      visibleStream.http === http &&
      visibleStream.bindingId === renderBinding.id &&
      visibleStream.epoch === epoch &&
      visibleProjectionMatches &&
      oxyServices.session.isAuthenticated &&
      (oxyServices.session.userId === null ||
        oxyServices.session.userId === visibleStream.accountId),
  );
  const mutationOwner =
    mutation.variables && 'owner' in mutation.variables ? mutation.variables.owner : undefined;
  const isOwnerVisible = (owner: RewriteOwner) =>
    Boolean(
      !owner.signal.aborted &&
        owner.accountId !== null &&
        owner.accountId === subjectId &&
        owner.bindingId === renderBinding.id &&
        owner.epoch === epoch &&
        projection.accountId === owner.accountId &&
        ((projection.revision === owner.revision && projection.sessionId === owner.sessionId) ||
          (owner.sessionId === null &&
            projection.sessionId !== null &&
            projection.revision === owner.revision + 1)) &&
        oxyServices.session.isAuthenticated &&
        (oxyServices.session.userId === null || oxyServices.session.userId === owner.accountId),
    );
  const isCurrentRewrite = !mutationOwner || isOwnerVisible(mutationOwner);
  return {
    draft,
    captureOwner,
    isOwnerVisible,
    streamDraft,
    polish,
    changeTone,
    adjustLength,
    suggestSubject,
    isLoading:
      mutation.isPending &&
      (mutation.variables?.kind === 'streamDraft' ? isCurrentStream : isCurrentRewrite),
    isCurrentStream,
    error: mutation.error,
  };
}
