import type { ReactNode } from 'react';

/**
 * Props that the DOM stand-ins for React Native and Bloom components read.
 * jest.mock factories in the suites type their props with these.
 */
export interface Children {
  children?: ReactNode;
}

export interface Pressable extends Children {
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

export interface DialogAction {
  label: string;
  onPress?: () => void;
}
