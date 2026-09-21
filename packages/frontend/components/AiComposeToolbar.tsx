import { Dialog, useDialogControl } from '@oxy.so/bloom/dialog';
import { Button } from '@oxy.so/bloom/button';
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

import React, { useState, useCallback, useEffect, useRef, type ComponentProps } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  AiBeautifyIcon,
  TextWrapIcon,
  ArrowShrink02Icon,
  SmileIcon,
} from '@hugeicons/core-free-icons';

import { useColors } from '@/constants/theme';
import { useAiCompose, type ComposeTone } from '@/hooks/mutations/useAiCompose';

type MaterialCommunityIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface AiComposeToolbarProps {
  body: string;
  onBodyChange: (text: string) => void;
  onSubjectSuggested?: (subject: string) => void;
}

const TONE_OPTIONS: { value: ComposeTone; label: string; icon: MaterialCommunityIconName }[] = [
  { value: 'professional', label: 'Professional', icon: 'briefcase-outline' },
  { value: 'casual', label: 'Casual', icon: 'coffee-outline' },
  { value: 'friendly', label: 'Friendly', icon: 'emoticon-happy-outline' },
  { value: 'formal', label: 'Formal', icon: 'file-document-outline' },
];

export function AiComposeToolbar({ body, onBodyChange, onSubjectSuggested }: AiComposeToolbarProps) {
  const colors = useColors();
  const { streamDraft, polish, changeTone, adjustLength, suggestSubject, isLoading } = useAiCompose();
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
      if (mountedRef.current && (!(error instanceof Error) || error.name !== 'AbortError')) {
        onBodyChange(body);
      }
    }
  }, [body, draftPrompt, selectedTone, streamDraft, onBodyChange, draftControl]);

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
  const handleToneChange = useCallback(async (tone: ComposeTone) => {
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
  }, [body, hasBody, changeTone, onBodyChange, toneControl]);

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

  const currentTone = TONE_OPTIONS.find((t) => t.value === selectedTone);

  return (
    <View style={[styles.container, { borderTopColor: colors.border }]}>
      <View style={styles.toolbar}>
        {/* Draft button */}
        <TouchableOpacity
          style={[styles.button, styles.primaryButton, { backgroundColor: colors.primaryContainer }]}
          onPress={handleDraft}
          disabled={isLoading}
          activeOpacity={0.7}
        >
          {Platform.OS === 'web' ? (
            <HugeiconsIcon icon={AiBeautifyIcon as unknown as IconSvgElement} size={16} color={colors.primary} />
          ) : (
            <MaterialCommunityIcons name="creation" size={16} color={colors.primary} />
          )}
          <Text style={[styles.buttonText, { color: colors.primary }]}>Draft</Text>
        </TouchableOpacity>

        {/* Polish button */}
        <TouchableOpacity
          style={[styles.button, { borderColor: colors.border }, !hasBody && styles.buttonDisabled]}
          onPress={handlePolish}
          disabled={isLoading || !hasBody}
          activeOpacity={0.7}
        >
          {Platform.OS === 'web' ? (
            <HugeiconsIcon icon={TextWrapIcon as unknown as IconSvgElement} size={16} color={hasBody ? colors.icon : colors.secondaryText} />
          ) : (
            <MaterialCommunityIcons name="auto-fix" size={16} color={hasBody ? colors.icon : colors.secondaryText} />
          )}
          <Text style={[styles.buttonText, { color: hasBody ? colors.text : colors.secondaryText }]}>Polish</Text>
        </TouchableOpacity>

        {/* Shorter button */}
        <TouchableOpacity
          style={[styles.button, { borderColor: colors.border }, !hasBody && styles.buttonDisabled]}
          onPress={handleShorter}
          disabled={isLoading || !hasBody}
          activeOpacity={0.7}
        >
          {Platform.OS === 'web' ? (
            <HugeiconsIcon icon={ArrowShrink02Icon as unknown as IconSvgElement} size={16} color={hasBody ? colors.icon : colors.secondaryText} />
          ) : (
            <MaterialCommunityIcons name="arrow-collapse-vertical" size={16} color={hasBody ? colors.icon : colors.secondaryText} />
          )}
          <Text style={[styles.buttonText, { color: hasBody ? colors.text : colors.secondaryText }]}>Shorter</Text>
        </TouchableOpacity>

        {/* Tone dropdown */}
        <TouchableOpacity
          style={[styles.button, { borderColor: colors.border }]}
          onPress={() => toneControl.open()}
          disabled={isLoading}
          activeOpacity={0.7}
        >
          {Platform.OS === 'web' ? (
            <HugeiconsIcon icon={SmileIcon as unknown as IconSvgElement} size={16} color={colors.icon} />
          ) : (
            <MaterialCommunityIcons name={currentTone?.icon ?? 'emoticon-outline'} size={16} color={colors.icon} />
          )}
          <Text style={[styles.buttonText, { color: colors.text }]}>{currentTone?.label || 'Tone'}</Text>
          <MaterialCommunityIcons name="chevron-down" size={14} color={colors.secondaryText} />
        </TouchableOpacity>

        {/* Loading indicator */}
        {isLoading && (
          <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
        )}
      </View>

      {/* Subject suggestion - only show when body exists and onSubjectSuggested is provided */}
      {hasBody && onSubjectSuggested && (
        <TouchableOpacity
          style={styles.subjectHint}
          onPress={handleSuggestSubject}
          disabled={isLoading}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="lightbulb-outline" size={14} color={colors.primary} />
          <Text style={[styles.subjectHintText, { color: colors.primary }]}>Suggest subject line</Text>
        </TouchableOpacity>
      )}

      <Dialog control={draftControl} title="Draft with AI" description="Describe what you want to say, and AI will draft it for you.">
        <View style={{ gap: 16 }}>
          <TextFieldInput value={draftPrompt} onChangeText={setDraftPrompt} label="Draft instructions" placeholder="e.g., Decline the meeting politely, suggest next week instead" multiline autoFocus />
          <View style={styles.toneOptions}>
            {TONE_OPTIONS.map(tone => <Button key={tone.value} appearance="subtle" pressed={selectedTone === tone.value} onPress={() => setSelectedTone(tone.value)}>{tone.label}</Button>)}
          </View>
          <Button onPress={executeDraft} disabled={!draftPrompt.trim() || isLoading} loading={isLoading}>Draft</Button>
        </View>
      </Dialog>
      <Dialog control={toneControl} title="Change tone to...">
        <View style={{ gap: 8 }}>
          {TONE_OPTIONS.map(tone => <Button key={tone.value} appearance="subtle" pressed={selectedTone === tone.value} onPress={() => handleToneChange(tone.value)}>{tone.label}</Button>)}
        </View>
      </Dialog>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  primaryButton: {
    borderWidth: 0,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  loader: {
    marginLeft: 8,
  },
  subjectHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingVertical: 4,
  },
  subjectHintText: {
    fontSize: 12,
    fontWeight: '500',
  },
  toneOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

});
