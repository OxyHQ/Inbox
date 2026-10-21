/**
 * Keyboard shortcuts hook for web.
 *
 * Gmail-like keyboard shortcuts:
 * - c: Compose new email
 * - r: Reply to selected email
 * - a: Reply all to selected email
 * - f: Forward selected email
 * - e: Archive selected email
 * - #: Delete selected email
 * - j: Next email
 * - k: Previous email
 * - s: Star/unstar selected email
 * - u: Mark as unread
 * - /: Focus search
 * - ?: Show keyboard shortcut help
 */

import { useEffect, useCallback } from 'react';
import { Platform } from 'react-native';

interface KeyboardShortcutsConfig {
  onCompose?: () => void;
  onReply?: () => void;
  onReplyAll?: () => void;
  onForward?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onNextMessage?: () => void;
  onPrevMessage?: () => void;
  onToggleStar?: () => void;
  onMarkUnread?: () => void;
  onFocusSearch?: () => void;
  onShowHelp?: () => void;
  enabled?: boolean;
}

/** Something open over the list that keys belong to: a menu, a listbox, a popover. */
const OVERLAY = '[role="menu"], [role="listbox"], [data-radix-popper-content-wrapper]';

function isShown(element: Element): boolean {
  // A closed panel may stay mounted, hidden. Where the browser cannot say, it counts as open.
  return typeof element.checkVisibility === 'function' ? element.checkVisibility() : true;
}

/** Held down, a key repeats: only moving through the list may. */
const REPEATABLE = new Set(['j', 'k']);

export function useKeyboardShortcuts(config: KeyboardShortcutsConfig) {
  const {
    onCompose,
    onReply,
    onReplyAll,
    onForward,
    onArchive,
    onDelete,
    onNextMessage,
    onPrevMessage,
    onToggleStar,
    onMarkUnread,
    onFocusSearch,
    onShowHelp,
    enabled = true,
  } = config;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      // Nothing behind an open dialog: with Settings or the AI draft dialog
      // open and a button focused, `#` deleted the message selected behind it.
      // Nor behind an open menu or popover, whose own keys (type-ahead `e`,
      // `s`) archived or starred the message behind it.
      if (
        target.closest?.(`[role="dialog"], [aria-modal="true"], ${OVERLAY}`) ||
        document.querySelector('[aria-modal="true"]') ||
        [...document.querySelectorAll(OVERLAY)].some(isShown)
      ) {
        return;
      }

      // A held key repeats: holding `e` archived conversation after
      // conversation, `#` deleted them, `c` opened a composer per repeat.
      if (event.repeat && !REPEATABLE.has(event.key.toLowerCase())) return;

      // Don't trigger shortcuts with modifier keys (except shift for some)
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case 'c':
          event.preventDefault();
          onCompose?.();
          break;

        case 'r':
          event.preventDefault();
          if (event.shiftKey) {
            // Shift+R = Reply All (alternative)
            onReplyAll?.();
          } else {
            onReply?.();
          }
          break;

        case 'a':
          event.preventDefault();
          onReplyAll?.();
          break;

        case 'f':
          event.preventDefault();
          onForward?.();
          break;

        case 'e':
          event.preventDefault();
          onArchive?.();
          break;

        case '#':
        case 'delete':
        case 'backspace':
          if (event.key === '#' || event.shiftKey) {
            event.preventDefault();
            onDelete?.();
          }
          break;

        case 'j':
          event.preventDefault();
          onNextMessage?.();
          break;

        case 'k':
          event.preventDefault();
          onPrevMessage?.();
          break;

        case 's':
          event.preventDefault();
          onToggleStar?.();
          break;

        case 'u':
          event.preventDefault();
          onMarkUnread?.();
          break;

        case '/':
          event.preventDefault();
          onFocusSearch?.();
          break;

        case '?':
          event.preventDefault();
          onShowHelp?.();
          break;

        default:
          break;
      }
    },
    [
      onCompose,
      onReply,
      onReplyAll,
      onForward,
      onArchive,
      onDelete,
      onNextMessage,
      onPrevMessage,
      onToggleStar,
      onMarkUnread,
      onFocusSearch,
      onShowHelp,
    ],
  );

  useEffect(() => {
    // Only enable on web
    if (Platform.OS !== 'web' || !enabled) {
      return;
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
}
