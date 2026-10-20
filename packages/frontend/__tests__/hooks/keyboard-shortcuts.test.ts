/**
 * The web shortcuts act on the selected conversation, so they must not fire
 * from a held key (holding `e` archived one conversation after another) or
 * while something else owns the keyboard: a menu, a listbox, a popover, a
 * native select.
 */

import { renderHook } from '@testing-library/react';
import { Platform } from 'react-native';

import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

const onArchive = jest.fn();
const onNextMessage = jest.fn();

function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
}

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'web';
  document.body.innerHTML = '';
  renderHook(() => useKeyboardShortcuts({ onArchive, onNextMessage }));
});

it('acts once for a held destructive key, but keeps moving through the list', () => {
  press('e');
  press('e', { repeat: true });
  press('e', { repeat: true });
  press('j');
  press('j', { repeat: true });

  expect(onArchive).toHaveBeenCalledTimes(1);
  expect(onNextMessage).toHaveBeenCalledTimes(2);
});

it('does nothing while a menu or a popover is open', () => {
  document.body.innerHTML = '<div role="menu"><button>Snooze</button></div>';
  press('e');
  document.body.innerHTML = '<div data-radix-popper-content-wrapper=""><div>Pick</div></div>';
  press('e');
  document.body.innerHTML = '<ul role="listbox"><li>ann@example.com</li></ul>';
  press('e');

  expect(onArchive).not.toHaveBeenCalled();
});

it('leaves a focused select its own keys', () => {
  document.body.innerHTML = '<select><option>English</option></select>';
  press('e', {}, document.querySelector('select') as HTMLSelectElement);

  expect(onArchive).not.toHaveBeenCalled();
});
