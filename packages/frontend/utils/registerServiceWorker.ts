/**
 * Service Worker registration utility.
 *
 * Only runs on web. Registers the service worker and handles update prompts.
 */

import { Platform } from 'react-native';

/**
 * Register the service worker and set up update detection.
 *
 * @param onUpdate - Called when a new SW version is waiting to activate.
 */
let registrationStarted = false;

export function registerServiceWorker(onUpdate?: () => void): void {
  if (Platform.OS !== 'web') return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  // Once per page: the caller is a React effect, which may run again.
  if (registrationStarted) return;
  registrationStarted = true;

  const register = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');

      // Check for updates periodically (every 60 minutes)
      setInterval(() => {
        registration.update().catch(() => {});
      }, 60 * 60 * 1000);

      // Detect when a new service worker is waiting
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (
            newWorker.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            // New version available
            onUpdate?.();
          }
        });
      });
    } catch {
      // SW registration failure is non-fatal; the app still works without it.
    }
  };

  // The app hydrates after `load` has usually fired, and a `load` listener
  // added then never runs — the worker was simply never registered.
  if (document.readyState === 'complete') void register();
  else window.addEventListener('load', () => void register(), { once: true });
}

/**
 * Tell the waiting service worker to skip waiting and take over.
 */
export function applyServiceWorkerUpdate(): void {
  if (Platform.OS !== 'web') return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  navigator.serviceWorker.ready.then((registration) => {
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
  });

  // Reload after the new SW takes over
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}
