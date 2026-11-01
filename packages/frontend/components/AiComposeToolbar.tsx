import { useTranslation } from '@/lib/i18n';
import { Button } from '@oxy.so/bloom/button';
import { Dialog, useDialogControl } from '@oxy.so/bloom/dialog';
import { toast } from '@oxy.so/bloom/toast';
import { TextFieldInput } from '@oxy.so/bloom/text-field';
import { Text } from '@oxy.so/bloom/typography';
/**
 * AI Compose Toolbar component.
 *
 * Provides AI-powered composition tools:
 * - ✨ Draft for me - Generate email from prompt
 * - Polish - Fix grammar and improve clarity
 * - Shorter/Longer - Adjust email length
 * - Tone dropdown - Professional, Casual, Friendly, Formal
 */

import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useCallback, useLayoutEffect, useRef, useState, type ComponentProps } from 'react';
import { ScrollView, View } from 'react-native';

import { useAiCompose, type ComposeTone } from '@/hooks/mutations/useAiCompose';

type MaterialCommunityIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/**
 * The toolbar reads and rewrites the user's OWN text only — plain text, the
 * signature excluded — and the composer owns what that means for the body.
 * Streaming previews stay separate from the editor until an unchanged body
 * and the originating session are checked at completion.
 */
interface AiComposeToolbarProps {
  /** The user's own text, as plain text, without the signature. */
  text: string;
  /** Current editor revision, including edits not yet rendered. */
  getBodyRevision: () => number;
  /** Raw body, plain text and revision from the same editor state. */
  getAiBodySnapshot: () => { body: string; text: string; revision: number };
  /** Whether web input is in an uncommitted IME composition. */
  isBodyComposing: () => boolean;
  /** An operation is committing; remember the body as it is. */
  onBegin: () => void;
  /** The result: replace the user's text with it. */
  onCommit: (text: string, isCurrent?: () => boolean) => void;
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
  getBodyRevision,
  getAiBodySnapshot,
  isBodyComposing,
  onBegin,
  onCommit,
  onSubjectSuggested,
}: AiComposeToolbarProps) {
  const { t } = useTranslation();
  const {
    streamDraft,
    captureOwner,
    polish,
    changeTone,
    adjustLength,
    suggestSubject,
    isLoading,
    isCurrentStream,
  } = useAiCompose();
  const mountedRef = useRef(false);

  const draftControl = useDialogControl();
  const toneControl = useDialogControl();
  const [draftPrompt, setDraftPrompt] = useState('');
  const [draftPreview, setDraftPreview] = useState<string | null>(null);
  const draftSequence = useRef(0);
  const [selectedTone, setSelectedTone] = useState<ComposeTone>('professional');

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const hasBody = body.trim().length > 0;

  /**
   * Preserve later editor changes even if the plain text returns to its former
   * value or only the formatting changed.
   */
  const rewrite = useCallback(
    async (run: (input: string, owner: ReturnType<typeof captureOwner>) => Promise<string>) => {
      const { text: input, revision } = getAiBodySnapshot();
      const owner = captureOwner();
      const { isCurrent } = owner;
      if (!isCurrent()) {
        owner.dispose();
        return;
      }
      try {
        const result = await run(input, owner);
        if (!mountedRef.current || !isCurrent()) return;
        if (getBodyRevision() !== revision || isBodyComposing()) {
          toast(t('ai.toast.keptYourEdits'));
          return;
        }
        onBegin();
        if (isCurrent() && getBodyRevision() === revision && !isBodyComposing())
          onCommit(result, isCurrent);
      } catch {
        // Errors are reported by the hook; an abort belongs to an unmounted or
        // superseded request.
      } finally {
        owner.dispose();
      }
    },
    [getAiBodySnapshot, getBodyRevision, isBodyComposing, captureOwner, onBegin, onCommit, t],
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
    const sequence = ++draftSequence.current;
    const revision = getBodyRevision();
    setDraftPreview('');
    try {
      await streamDraft(
        draftPrompt,
        selectedTone,
        (partial) => {
          if (mountedRef.current && draftSequence.current === sequence) setDraftPreview(partial);
        },
        (text, isCurrent) => {
          if (!mountedRef.current || draftSequence.current !== sequence || !isCurrent()) return;
          if (getBodyRevision() !== revision || isBodyComposing()) {
            toast(t('ai.toast.keptYourEdits'));
            return;
          }
          onBegin();
          if (isCurrent() && getBodyRevision() === revision && !isBodyComposing())
            onCommit(text, isCurrent);
        },
      );
    } catch {
      // The hook reports failures. An aborted request leaves the editor untouched.
    } finally {
      if (mountedRef.current && draftSequence.current === sequence) setDraftPreview(null);
    }
  }, [
    draftPrompt,
    selectedTone,
    streamDraft,
    getBodyRevision,
    isBodyComposing,
    onBegin,
    onCommit,
    draftControl,
    t,
  ]);

  // Handler for "Polish" button
  const handlePolish = useCallback(() => {
    if (hasBody) void rewrite(polish);
  }, [hasBody, rewrite, polish]);

  // Handler for "Shorter" button
  const handleShorter = useCallback(() => {
    if (hasBody) void rewrite((input, owner) => adjustLength(input, 'shorter', owner));
  }, [hasBody, rewrite, adjustLength]);

  // Handler for tone change
  const handleToneChange = useCallback(
    (tone: ComposeTone) => {
      toneControl.close();
      setSelectedTone(tone);
      if (hasBody) void rewrite((input, owner) => changeTone(input, tone, owner));
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
      {isCurrentStream && draftPreview ? (
        <View>
          <Text>{t('ai.draftDialog.preview')}</Text>
          <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
            <Text selectable>{draftPreview}</Text>
          </ScrollView>
        </View>
      ) : null}
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
