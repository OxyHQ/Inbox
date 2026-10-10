import { useTranslation } from '@/lib/i18n';
import { Button } from '@oxy.so/bloom/button';
import { Dialog, useDialogControl } from '@oxy.so/bloom/dialog';
import { toast } from '@oxy.so/bloom';
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
import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { View } from 'react-native';

import { useAiCompose, type ComposeTone } from '@/hooks/mutations/useAiCompose';

type MaterialCommunityIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/**
 * The toolbar reads and rewrites the user's OWN text only — plain text, the
 * signature excluded — and the composer owns what that means for the body.
 *
 * It used to read the editor's HTML as text and write the result over the
 * whole body: "Draft for me" replaced what the user had written and the
 * signature, a rewrite dropped formatting and links, and a failed draft
 * "restored" the plain-text copy. Now every operation is bracketed — `onBegin`
 * before, then `onCommit` (or `onAbort` to put the body back exactly) — so the
 * composer can restore the original and offer Undo.
 */
interface AiComposeToolbarProps {
  /** The user's own text, as plain text, without the signature. */
  text: string;
  /** An operation is starting; remember the body as it is. */
  onBegin: () => void;
  /** A draft streaming in: show it, nothing is final yet. */
  onPreview: (text: string) => void;
  /** The result: replace the user's text with it. */
  onCommit: (text: string) => void;
  /** The operation failed or was overtaken: put the body back as it was. */
  onAbort: () => void;
  onSubjectSuggested?: (subject: string) => void;
}

// Labels come from `ai.tones.<value>`.
const TONE_OPTIONS: {
  value: ComposeTone;
  icon: MaterialCommunityIconName;
}[] = [
  { value: 'professional', icon: 'briefcase-outline' },
  { value: 'casual', icon: 'coffee-outline' },
  { value: 'friendly', icon: 'emoticon-happy-outline' },
  { value: 'formal', icon: 'file-document-outline' },
];

export function AiComposeToolbar({
  text: body,
  onBegin,
  onPreview,
  onCommit,
  onAbort,
  onSubjectSuggested,
}: AiComposeToolbarProps) {
  const { t } = useTranslation();
  const { streamDraft, polish, changeTone, adjustLength, suggestSubject, isLoading } =
    useAiCompose();
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

  // The text as it is NOW, for an answer that arrives after the user typed on.
  const latestText = useRef(body);
  useEffect(() => {
    latestText.current = body;
  }, [body]);

  /**
   * Run a rewrite of the current text. Its answer is applied only if the text
   * is still what was sent: typing while it ran used to be overwritten.
   */
  const rewrite = useCallback(
    async (run: (input: string) => Promise<string>) => {
      const input = body;
      try {
        const result = await run(input);
        if (!mountedRef.current) return;
        if (latestText.current !== input) {
          toast(t('ai.toast.keptYourEdits'));
          return;
        }
        onBegin();
        onCommit(result);
      } catch {
        // Errors are reported by the hook; an abort belongs to an unmounted or
        // superseded request.
      }
    },
    [body, onBegin, onCommit, t],
  );

  // Handler for "Draft for me" button
  const handleDraft = useCallback(() => {
    draftControl.open();
    setDraftPrompt('');
  }, [draftControl]);

  // Execute draft generation
  const executeDraft = useCallback(async () => {
    if (!draftPrompt.trim()) return;
    draftControl.close();

    onBegin();
    try {
      // Use streaming for typewriter effect
      const text = await streamDraft(draftPrompt, selectedTone, (partial) => {
        if (mountedRef.current) onPreview(partial);
      });
      if (mountedRef.current) onCommit(text);
    } catch (error: unknown) {
      // A rejected/truncated stream is not a valid draft: put back exactly what
      // was there, formatting and signature included. An abort belongs to an
      // unmounted or superseded request and must not race a replacement draft.
      if (mountedRef.current && (!(error instanceof Error) || error.name !== 'AbortError')) {
        onAbort();
      }
    }
  }, [draftPrompt, selectedTone, streamDraft, onBegin, onPreview, onCommit, onAbort, draftControl]);

  // Handler for "Polish" button
  const handlePolish = useCallback(() => {
    if (hasBody) void rewrite(polish);
  }, [hasBody, rewrite, polish]);

  // Handler for "Shorter" button
  const handleShorter = useCallback(() => {
    if (hasBody) void rewrite((input) => adjustLength(input, 'shorter'));
  }, [hasBody, rewrite, adjustLength]);

  // Handler for tone change
  const handleToneChange = useCallback(
    (tone: ComposeTone) => {
      toneControl.close();
      setSelectedTone(tone);
      if (hasBody) void rewrite((input) => changeTone(input, tone));
    },
    [hasBody, rewrite, changeTone, toneControl],
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
        <Button appearance="subtle" onPress={handleDraft} disabled={isLoading}>
          {t('ai.toolbar.draft')}
        </Button>
        <Button appearance="subtle" onPress={handlePolish} disabled={isLoading || !hasBody}>
          {t('ai.toolbar.polish')}
        </Button>
        <Button appearance="subtle" onPress={handleShorter} disabled={isLoading || !hasBody}>
          {t('ai.toolbar.shorter')}
        </Button>
        <Button appearance="subtle" onPress={() => toneControl.open()} disabled={isLoading}>
          {t(`ai.tones.${selectedTone}`)}
        </Button>
        {hasBody && onSubjectSuggested && (
          <Button appearance="subtle" onPress={handleSuggestSubject} disabled={isLoading}>
            {t('ai.toolbar.suggestSubject')}
          </Button>
        )}
      </View>
      <Dialog
        control={draftControl}
        title={t('ai.draftDialog.title')}
        description={t('ai.draftDialog.description')}
      >
        <View style={{ gap: 16 }}>
          <TextFieldInput
            value={draftPrompt}
            onChangeText={setDraftPrompt}
            label={t('ai.draftDialog.label')}
            placeholder={t('ai.draftDialog.placeholder')}
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
            {t('ai.toolbar.draft')}
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
