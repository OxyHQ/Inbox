import { useOxyRuntime } from '@oxy.so/services/runtime';
import { useLayoutEffect } from 'react';
import { followOxyRuntime, inboxAccountCache } from '@/hooks/queries/inboxAccountCache';

/**
 * Keeps Inbox's account cache on the session's account. Mounted once, as the
 * first child of `OxyProvider`, so it follows the runtime before any private
 * content mounts; it renders nothing.
 */
export function InboxAccountCache() {
  const runtime = useOxyRuntime();
  useLayoutEffect(() => followOxyRuntime(inboxAccountCache, runtime), [runtime]);
  return null;
}
