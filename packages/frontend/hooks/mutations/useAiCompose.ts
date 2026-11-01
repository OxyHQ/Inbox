/** Inbox compose assistance through Oxy's bounded `/email/ai/compose` lane. */

import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useOxyRuntime } from '@oxy.so/services/runtime';
import { useMutation } from '@tanstack/react-query';
import { toast } from '@oxy.so/bloom/toast';
import { useOxy } from '@oxy.so/services/ui/client';
import { useTranslation } from '@/lib/i18n';
import { runInboxCompose, streamInboxDraft } from '@/services/inboxInferenceApi';
import { aiKeys } from '@/hooks/queries/queryKeys';

export type ComposeTone = 'professional' | 'casual' | 'friendly' | 'formal';

type ComposeOperation =
  | { kind: 'draft'; prompt: string; tone: ComposeTone }
  | {
      kind: 'streamDraft';
      prompt: string;
      tone: ComposeTone;
      signal: AbortSignal;
      onChunk?: (text: string) => void;
    }
  | { kind: 'polish'; text: string }
  | { kind: 'changeTone'; text: string; tone: ComposeTone }
  | { kind: 'adjustLength'; text: string; direction: 'shorter' | 'longer' }
  | { kind: 'suggestSubject'; body: string };

interface UseAiComposeReturn {
  draft: (prompt: string, tone?: ComposeTone) => Promise<string>;
  polish: (text: string) => Promise<string>;
  changeTone: (text: string, tone: ComposeTone) => Promise<string>;
  adjustLength: (text: string, direction: 'shorter' | 'longer') => Promise<string>;
  suggestSubject: (body: string) => Promise<string>;
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
  } | null>(null);
  const streamControllerRef = useRef<AbortController | null>(null);
  const streamCleanupRef = useRef<(() => void) | null>(null);
  const [visibleStream, setVisibleStream] = useState<{
    accountId: string | null;
    sessionId: string | null;
    revision: number;
    epoch: number;
    runtime: typeof runtime;
    http: typeof http;
  } | null>(null);

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      streamControllerRef.current?.abort();
      streamControllerRef.current = null;
      streamCleanupRef.current?.();
      streamCleanupRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const binding = { runtime, http, subjectId };
    committedServicesRef.current = binding;
    return () => {
      if (committedServicesRef.current !== binding) return;
      committedServicesRef.current = null;
      streamControllerRef.current?.abort();
      streamCleanupRef.current?.();
    };
  }, [runtime, http, subjectId]);

  const mutation = useMutation<string, Error, ComposeOperation>({
    mutationKey: aiKeys.compose,
    mutationFn: async (operation) => {
      const http = oxyServices.http;
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
          return (
            await runInboxCompose(http, {
              operation: 'polish',
              text: operation.text,
            })
          ).text.trim();
        case 'changeTone':
          return (
            await runInboxCompose(http, {
              operation: 'change_tone',
              text: operation.text,
              tone: operation.tone,
            })
          ).text.trim();
        case 'adjustLength':
          return (
            await runInboxCompose(http, {
              operation: 'adjust_length',
              text: operation.text,
              direction: operation.direction,
            })
          ).text.trim();
        case 'suggestSubject':
          return (
            await runInboxCompose(http, {
              operation: 'suggest_subject',
              body: operation.body,
            })
          ).text
            .trim()
            .replace(/^["']|["']$/g, '');
      }
    },
    // The toolbar leaves the text as it was on failure; this says why nothing
    // happened. An abort is a superseded or unmounted request, not a failure.
    onError: (error, operation) => {
      if (
        error.name === 'AbortError' ||
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
      const visibleOwner = { ...captured, epoch, runtime, http };
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
    (text: string) => mutateAsync({ kind: 'polish', text }),
    [mutateAsync],
  );
  const changeTone = useCallback(
    (text: string, tone: ComposeTone) => mutateAsync({ kind: 'changeTone', text, tone }),
    [mutateAsync],
  );
  const adjustLength = useCallback(
    (text: string, direction: 'shorter' | 'longer') =>
      mutateAsync({ kind: 'adjustLength', text, direction }),
    [mutateAsync],
  );
  const suggestSubject = useCallback(
    (body: string) => mutateAsync({ kind: 'suggestSubject', body }),
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
      visibleStream.epoch === epoch &&
      visibleProjectionMatches &&
      oxyServices.session.isAuthenticated &&
      (oxyServices.session.userId === null ||
        oxyServices.session.userId === visibleStream.accountId),
  );
  return {
    draft,
    streamDraft,
    polish,
    changeTone,
    adjustLength,
    suggestSubject,
    isLoading:
      mutation.isPending && (mutation.variables?.kind !== 'streamDraft' || isCurrentStream),
    isCurrentStream,
    error: mutation.error,
  };
}
