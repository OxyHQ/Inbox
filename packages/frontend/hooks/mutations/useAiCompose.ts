/** Inbox compose assistance through Oxy's bounded `/email/ai/compose` lane. */

import { useCallback, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useOxy } from '@oxy.so/services';
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
  streamDraft: (prompt: string, tone?: ComposeTone, onChunk?: (chunk: string) => void) => Promise<string>;
  isLoading: boolean;
  error: Error | null;
}

export function useAiCompose(): UseAiComposeReturn {
  const { oxyServices } = useOxy();
  const mountedRef = useRef(false);
  const streamControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      streamControllerRef.current?.abort();
      streamControllerRef.current = null;
    };
  }, []);

  const mutation = useMutation<string, Error, ComposeOperation>({
    mutationKey: aiKeys.compose,
    mutationFn: async (operation) => {
      const http = oxyServices.httpService;
      switch (operation.kind) {
        case 'draft':
          return (await runInboxCompose(http, {
            operation: 'draft',
            prompt: operation.prompt,
            tone: operation.tone,
          })).text.trim();
        case 'streamDraft': {
          let fullText = '';
          for await (const chunk of streamInboxDraft(http, {
            operation: 'draft',
            prompt: operation.prompt,
            tone: operation.tone,
          }, operation.signal)) {
            if (operation.signal.aborted) {
              const error = new Error('Inbox AI compose was aborted.');
              error.name = 'AbortError';
              throw error;
            }
            fullText += chunk;
            if (mountedRef.current) operation.onChunk?.(fullText);
          }
          return fullText.trim();
        }
        case 'polish':
          return (await runInboxCompose(http, {
            operation: 'polish',
            text: operation.text,
          })).text.trim();
        case 'changeTone':
          return (await runInboxCompose(http, {
            operation: 'change_tone',
            text: operation.text,
            tone: operation.tone,
          })).text.trim();
        case 'adjustLength':
          return (await runInboxCompose(http, {
            operation: 'adjust_length',
            text: operation.text,
            direction: operation.direction,
          })).text.trim();
        case 'suggestSubject':
          return (await runInboxCompose(http, {
            operation: 'suggest_subject',
            body: operation.body,
          })).text.trim().replace(/^["']|["']$/g, '');
      }
    },
  });

  const { mutateAsync } = mutation;
  const draft = useCallback(
    (prompt: string, tone: ComposeTone = 'professional') =>
      mutateAsync({ kind: 'draft', prompt, tone }),
    [mutateAsync],
  );
  const streamDraft = useCallback(
    async (prompt: string, tone: ComposeTone = 'professional', onChunk?: (chunk: string) => void) => {
      streamControllerRef.current?.abort();
      const controller = new AbortController();
      streamControllerRef.current = controller;
      try {
        return await mutateAsync({ kind: 'streamDraft', prompt, tone, signal: controller.signal, onChunk });
      } finally {
        if (streamControllerRef.current === controller) streamControllerRef.current = null;
      }
    },
    [mutateAsync],
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

  return {
    draft,
    streamDraft,
    polish,
    changeTone,
    adjustLength,
    suggestSubject,
    isLoading: mutation.isPending,
    error: mutation.error,
  };
}
