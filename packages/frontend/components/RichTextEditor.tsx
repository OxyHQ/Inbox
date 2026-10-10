import { Dialog, useDialogControl } from '@oxy.so/bloom/dialog';
import { TextFieldInput } from '@oxy.so/bloom/text-field';
import { Button } from '@oxy.so/bloom/button';
/**
 * Cross-platform rich text editor.
 *
 * Bloom owns controls; the editable document remains in the mail body slot.
 * Web: contentEditable with Bloom NoteEditorToolbar.
 * Native: Bloom Textarea plain-text fallback.
 */

import { NoteEditorToolbar } from '@oxy.so/bloom/note-editor';
import { Textarea } from '@oxy.so/bloom/textarea';
import { Text } from '@oxy.so/bloom/typography';
import {
  RiBold,
  RiItalic,
  RiUnderline,
  RiStrikethrough,
  RiListOrdered,
  RiListUnordered,
  RiLink,
  RiFormatClear,
} from '@oxy.so/bloom/icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { useColors } from '@/constants/theme';
import { useTranslation } from '@/lib/i18n';

export interface RichTextEditorProps {
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
  style?: object;
  autoFocus?: boolean;
}

/** Ref handle exposed via forwardRef for imperative control. */
export interface RichTextEditorHandle {
  /** Replace the entire editor content (HTML on web, plain text on native). */
  setContent: (content: string) => void;
  focus: () => void;
}

function isEditorContentEmpty(content: string): boolean {
  if (!content.trim()) return true;
  const textContent = content
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim();
  return !textContent && !/<img\b/i.test(content);
}

// ─── Web Implementation ──────────────────────────────────────────────

function WebRichTextEditor(
  { value, onChange, placeholder, style, autoFocus }: RichTextEditorProps,
  ref: React.Ref<RichTextEditorHandle>,
) {
  const { t } = useTranslation();
  const colors = useColors();
  const editorRef = useRef<HTMLDivElement | null>(null);
  const isComposing = useRef(false);
  const selectionRef = useRef<Range | null>(null);
  const linkControl = useDialogControl();
  const [linkUrl, setLinkUrl] = useState('');
  const isEmpty = isEditorContentEmpty(value);
  const setEditorRef = useCallback((element: HTMLDivElement | null) => {
    editorRef.current = element;
  }, []);

  // Track active formatting states
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());

  const updateActiveFormats = useCallback(() => {
    const formats = new Set<string>();
    if (document.queryCommandState('bold')) formats.add('bold');
    if (document.queryCommandState('italic')) formats.add('italic');
    if (document.queryCommandState('underline')) formats.add('underline');
    if (document.queryCommandState('strikeThrough'))
      formats.add('strikeThrough');
    if (document.queryCommandState('insertOrderedList'))
      formats.add('insertOrderedList');
    if (document.queryCommandState('insertUnorderedList'))
      formats.add('insertUnorderedList');
    setActiveFormats(formats);
  }, []);

  // Sync external value changes into the editor
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (el.innerHTML !== value) {
      el.innerHTML = value;
    }
  }, [value]);

  // Auto-focus
  useEffect(() => {
    if (autoFocus && editorRef.current) {
      editorRef.current.focus();
    }
  }, [autoFocus]);

  // Expose imperative handle
  React.useImperativeHandle(
    ref,
    () => ({
      setContent(content: string) {
        const el = editorRef.current;
        if (!el) return;
        el.innerHTML = content;
        onChange(content);
      },
      focus() {
        editorRef.current?.focus();
      },
    }),
    [onChange],
  );

  const emitChange = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML;
    // Treat <br> or empty tags as empty
    const textContent = el.textContent || '';
    const empty = !textContent.trim() && !html.includes('<img');
    onChange(empty ? '' : html);
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (isComposing.current) return;
    emitChange();
    updateActiveFormats();
  }, [emitChange, updateActiveFormats]);

  const handleCompositionStart = useCallback(() => {
    isComposing.current = true;
  }, []);

  const handleCompositionEnd = useCallback(() => {
    isComposing.current = false;
    emitChange();
  }, [emitChange]);

  // Plain-text paste by default; Shift+paste keeps formatting
  const handlePaste = useCallback((e: ClipboardEvent) => {
    // Check if Shift is held to allow rich paste (shiftKey exists on the native event)
    if ((e as unknown as KeyboardEvent).shiftKey) return;
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') ?? '';
    document.execCommand('insertText', false, text);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'b') {
        e.preventDefault();
        document.execCommand('bold');
        updateActiveFormats();
      } else if (mod && e.key === 'i') {
        e.preventDefault();
        document.execCommand('italic');
        updateActiveFormats();
      } else if (mod && e.key === 'u') {
        e.preventDefault();
        document.execCommand('underline');
        updateActiveFormats();
      }
    },
    [updateActiveFormats],
  );

  const handleSelectionChange = useCallback(() => {
    const selection = document.getSelection();
    if (
      !selection?.rangeCount ||
      !editorRef.current?.contains(selection.anchorNode)
    )
      return;
    selectionRef.current = selection.getRangeAt(0).cloneRange();
    updateActiveFormats();
  }, [updateActiveFormats]);

  // Attach native event listeners to the contentEditable div
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.addEventListener('input', handleInput);
    el.addEventListener('compositionstart', handleCompositionStart);
    el.addEventListener('compositionend', handleCompositionEnd);
    el.addEventListener('paste', handlePaste as EventListener);
    el.addEventListener('keydown', handleKeyDown as EventListener);
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      el.removeEventListener('input', handleInput);
      el.removeEventListener('compositionstart', handleCompositionStart);
      el.removeEventListener('compositionend', handleCompositionEnd);
      el.removeEventListener('paste', handlePaste as EventListener);
      el.removeEventListener('keydown', handleKeyDown as EventListener);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [
    handleInput,
    handleCompositionStart,
    handleCompositionEnd,
    handlePaste,
    handleKeyDown,
    handleSelectionChange,
  ]);

  // Toolbar commands
  const exec = useCallback(
    (command: string, argument?: string) => {
      editorRef.current?.focus();
      const selection = document.getSelection();
      if (
        selectionRef.current &&
        selection &&
        editorRef.current?.contains(
          selectionRef.current.commonAncestorContainer,
        )
      ) {
        selection.removeAllRanges();
        selection.addRange(selectionRef.current);
      }
      document.execCommand(command, false, argument);
      emitChange();
      updateActiveFormats();
    },
    [emitChange, updateActiveFormats],
  );

  const handleLink = useCallback(() => {
    setLinkUrl('');
    linkControl.open();
  }, [linkControl]);

  const insertLink = useCallback(() => {
    const url = linkUrl.trim();
    if (!url) return;
    linkControl.close();
    requestAnimationFrame(() => exec('createLink', url));
  }, [exec, linkControl, linkUrl]);

  const handleClearFormatting = useCallback(() => {
    exec('removeFormat');
    exec('unlink');
  }, [exec]);

  return (
    <View style={[webStyles.container, style]}>
      <Dialog control={linkControl} title={t('editor.insertLink')}>
        <View className="gap-3">
          <TextFieldInput
            label={t('editor.url')}
            placeholder="https://"
            value={linkUrl}
            onChangeText={setLinkUrl}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={insertLink}
          />
          <Button onPress={insertLink} disabled={!linkUrl.trim()}>
            {t('editor.insertLink')}
          </Button>
        </View>
      </Dialog>
      <NoteEditorToolbar
        accessibilityLabel={t('editor.formatting')}
        actions={[
          {
            key: 'bold',
            label: t('editor.bold'),
            icon: RiBold,
            active: activeFormats.has('bold'),
            onPress: () => exec('bold'),
          },
          {
            key: 'italic',
            label: t('editor.italic'),
            icon: RiItalic,
            active: activeFormats.has('italic'),
            onPress: () => exec('italic'),
          },
          {
            key: 'underline',
            label: t('editor.underline'),
            icon: RiUnderline,
            active: activeFormats.has('underline'),
            onPress: () => exec('underline'),
          },
          {
            key: 'strikeThrough',
            label: t('editor.strikethrough'),
            icon: RiStrikethrough,
            active: activeFormats.has('strikeThrough'),
            onPress: () => exec('strikeThrough'),
          },
          {
            key: 'insertUnorderedList',
            label: t('editor.bulletList'),
            icon: RiListUnordered,
            active: activeFormats.has('insertUnorderedList'),
            onPress: () => exec('insertUnorderedList'),
          },
          {
            key: 'insertOrderedList',
            label: t('editor.numberedList'),
            icon: RiListOrdered,
            active: activeFormats.has('insertOrderedList'),
            onPress: () => exec('insertOrderedList'),
          },
          {
            key: 'link',
            label: t('editor.insertLink'),
            icon: RiLink,
            onPress: handleLink,
          },
          {
            key: 'clear',
            label: t('editor.clearFormatting'),
            icon: RiFormatClear,
            onPress: handleClearFormatting,
          },
        ]}
      />

      {/* Editable area */}
      <View style={webStyles.editorWrapper}>
        {isEmpty && placeholder && (
          <Text
            style={[webStyles.placeholder, { color: colors.searchPlaceholder }]}
          >
            {placeholder}
          </Text>
        )}
        <div
          ref={setEditorRef}
          contentEditable
          suppressContentEditableWarning
          style={{
            flex: 1,
            minHeight: 200,
            padding: 16,
            fontSize: 15,
            lineHeight: '24px',
            color: colors.text,
            outline: 'none',
            overflowY: 'auto' as const,
            wordBreak: 'break-word' as const,
          }}
        />
      </View>
    </View>
  );
}

const WebEditor = React.forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  WebRichTextEditor,
);

// ─── Native Implementation ───────────────────────────────────────────

function NativeRichTextEditor(
  { value, onChange, placeholder, style, autoFocus }: RichTextEditorProps,
  ref: React.Ref<RichTextEditorHandle>,
) {
  const inputRef = useRef<TextInput>(null);

  React.useImperativeHandle(ref, () => ({
    setContent(content: string) {
      onChange(content);
    },
    focus() {
      inputRef.current?.focus();
    },
  }));

  return (
    <Textarea
      inputRef={inputRef}
      style={style}
      rows={10}
      autoResize
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      textAlignVertical="top"
      autoFocus={autoFocus}
    />
  );
}

const NativeEditor = React.forwardRef<
  RichTextEditorHandle,
  RichTextEditorProps
>(NativeRichTextEditor);

// ─── Exported component (platform switch) ────────────────────────────

export const RichTextEditor = React.forwardRef<
  RichTextEditorHandle,
  RichTextEditorProps
>((props, ref) => {
  if (Platform.OS === 'web') {
    return <WebEditor ref={ref} {...props} />;
  }
  return <NativeEditor ref={ref} {...props} />;
});

RichTextEditor.displayName = 'RichTextEditor';

// ─── Helper: strip HTML to plain text ────────────────────────────────

// ─── Styles ──────────────────────────────────────────────────────────

const webStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  editorWrapper: {
    flex: 1,
    position: 'relative',
  },
  placeholder: {
    position: 'absolute',
    top: 16,
    left: 16,
    fontSize: 15,
    pointerEvents: 'none',
  },
});
