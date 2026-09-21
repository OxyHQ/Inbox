/** Compatibility for existing bookmarked settings URLs; no settings screen or second navigator. */
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useInboxSettings } from './InboxSettings';
import type { SettingsSectionKey } from './sections-catalog';
export function SettingsLink({ page }: { page?: SettingsSectionKey }) {
  const open = useInboxSettings();
  const router = useRouter();
  useEffect(() => {
    open(page);
    router.replace('/');
  }, [open, page, router]);
  return null;
}
