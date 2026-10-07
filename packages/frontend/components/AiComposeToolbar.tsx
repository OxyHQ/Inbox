import { useTranslation } from '@/lib/i18n';
import { Button } from '@oxy.so/bloom/button';
import { Dialog, useDialogControl } from '@oxy.so/bloom/dialog';
import { TextFieldInput } from '@oxy.so/bloom/text-field';
/**
 * AI Compose Toolbar component.
 *
 * Provides AI-powered composition tools:
 * - ✨ Draft for me - Generate email from prompt
 * - Polish - Fix grammar and improve clarity
 * - Shorter/Longer - Adjust email length
 * - Tone dropdown - Professional, Casual, Friendly, Formal
 */

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
} from 'react';
import { View } from 'react-native';

import { useAiCompose, type ComposeTone } from '@/hooks/mutations/useAiCompose';

type MaterialCommunityIconName = ComponentProps<
  typeof MaterialCommunityIcons
>['name'];

interface AiComposeToolbarProps {
  body: string;
  onBodyChange: (text: string) => void;
  onSubjectSuggested?: (subject: string) => void;
}

const TONE_OPTIONS: {
  value: ComposeTone;
  label: string;
  icon: MaterialCommunityIconName;
}[] = [
  { value: 'professional', label: 'Professional', icon: 'briefcase-outline' },
  { value: 'casual', label: 'Casual', icon: 'coffee-outline' },
  { value: 'friendly', label: 'Friendly', icon: 'emoticon-happy-outline' },
  { value: 'formal', label: 'Formal', icon: 'file-document-outline' },
];

export function AiComposeToolbar({
  body,
  onBodyChange,
  onSubjectSuggested,
}: AiComposeToolbarProps) {
  const { t } = useTranslation();
  const {
    streamDraft,
    polish,
    changeTone,
    adjustLength,
    suggestSubject,
    isLoading,
  } = useAiCompose();
  const mountedRef = useRef(false);

  const draftControl = useDialogControl();
  const toneControl = useDialogControl();
  const [draftPrompt, setDraftPrompt] = useState('');
  const [selectedTone, setSelectedTone] = useState<ComposeTone>('professional');

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const hasBody = body.trim().length > 0;

  // Handler for "Draft for me" button
  const handleDraft = useCallback(() => {
    draftControl.open();
    setDraftPrompt('');
  }, [draftControl]);

  // Execute draft generation
  const executeDraft = useCallback(async () => {
    if (!draftPrompt.trim()) return;
    draftControl.close();

    try {
      // Use streaming for typewriter effect
      await streamDraft(draftPrompt, selectedTone, (text) => {
        onBodyChange(text);
      });
    } catch (error: unknown) {
      // A rejected/truncated stream is not a valid draft. Restore the exact
      // body that was present before generation instead of leaving partial AI
      // output in a sendable composer. An abort belongs to an unmounted or
      // superseded request and must not race a replacement draft.
      if (
        mountedRef.current &&
        (!(error instanceof Error) || error.name !== 'AbortError')
      ) {
        onBodyChange(body);
      }
    }
  }, [
    body,
    draftPrompt,
    selectedTone,
    streamDraft,
    onBodyChange,
    draftControl,
  ]);

  // Handler for "Polish" button
  const handlePolish = useCallback(async () => {
    if (!hasBody) return;
    try {
      const polished = await polish(body);
      onBodyChange(polished);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') return;
      // Error handled by hook
    }
  }, [body, hasBody, polish, onBodyChange]);

  // Handler for "Shorter" button
  const handleShorter = useCallback(async () => {
    if (!hasBody) return;
    try {
      const shorter = await adjustLength(body, 'shorter');
      onBodyChange(shorter);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') return;
      // Error handled by hook
    }
  }, [body, hasBody, adjustLength, onBodyChange]);

  // Handler for tone change
  const handleToneChange = useCallback(
    async (tone: ComposeTone) => {
      toneControl.close();
      setSelectedTone(tone);
      if (!hasBody) return;
      try {
        const rewritten = await changeTone(body, tone);
        onBodyChange(rewritten);
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') return;
        // Error handled by hook
      }
    },
    [body, hasBody, changeTone, onBodyChange, toneControl],
  );

  // Handler for subject suggestion
  const handleSuggestSubject = useCallback(async () => {
    if (!hasBody || !onSubjectSuggested) return;
    try {
      const subject = await suggestSubject(body);
      onSubjectSuggested(subject);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') return;
      // Error handled by hook
    }
  }, [body, hasBody, suggestSubject, onSubjectSuggested]);

  return (
    <View className="gap-2 px-4 py-2">
      <View className="flex-row flex-wrap gap-2">
        <Button
          appearance="subtle"
          onPress={handleDraft}
          disabled={isLoading}
        >
          {t('ai.toolbar.draft')}
        </Button>
        <Button
          appearance="subtle"
          onPress={handlePolish}
          disabled={isLoading || !hasBody}
        >
          {t('ai.toolbar.polish')}
        </Button>
        <Button
          appearance="subtle"
          onPress={handleShorter}
          disabled={isLoading || !hasBody}
        >
          {t('ai.toolbar.shorter')}
        </Button>
        <Button
          appearance="subtle"
          onPress={() => toneControl.open()}
          disabled={isLoading}
        >
          {t(`ai.tones.${selectedTone}`)}
        </Button>
        {hasBody && onSubjectSuggested && (
          <Button
            appearance="subtle"
            onPress={handleSuggestSubject}
            disabled={isLoading}
          >
            {t('ai.toolbar.suggestSubject')}
          </Button>
        )}
      </View>
      <Dialog
        control={draftControl}
        title="Draft with AI"
        description="Describe what you want to say, and AI will draft it for you."
      >
        <View style={{ gap: 16 }}>
          <TextFieldInput
            value={draftPrompt}
            onChangeText={setDraftPrompt}
            label="Draft instructions"
            placeholder="e.g., Decline the meeting politely, suggest next week instead"
            multiline
            autoFocus
          />
          <View className="flex-row flex-wrap gap-2">
            {TONE_OPTIONS.map((tone) => (
              <Button
                key={tone.value}
                appearance="subtle"
                pressed={selectedTone === tone.value}
                onPress={() => setSelectedTone(tone.value)}
              >
                {t(`ai.tones.${tone.value}`)}
              </Button>
            ))}
          </View>
          <Button
            onPress={executeDraft}
            disabled={!draftPrompt.trim() || isLoading}
            loading={isLoading}
          >
            Draft
          </Button>
        </View>
      </Dialog>
      <Dialog control={toneControl} title={t('ai.toneMenu.title')}>
        <View style={{ gap: 8 }}>
          {TONE_OPTIONS.map((tone) => (
            <Button
              key={tone.value}
              appearance="subtle"
              pressed={selectedTone === tone.value}
              onPress={() => handleToneChange(tone.value)}
            >
              {t(`ai.tones.${tone.value}`)}
            </Button>
          ))}
        </View>
      </Dialog>
    </View>
  );
}
