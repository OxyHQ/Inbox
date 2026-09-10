import type { PropsWithChildren } from 'react';

export function TabBar({ children }: PropsWithChildren) {
  return children;
}

export function TabBarButton() {
  return null;
}

export function TabBarMinimizeProvider({ children }: PropsWithChildren) {
  return children;
}

export function useTabBarFootprint() {
  return 76;
}
