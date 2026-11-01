import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { Linking, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { toast } from '@oxy.so/bloom/toast';
import { useOxy } from '@oxy.so/services/ui/client';
import { useTranslation } from '@/lib/i18n';
import { useObservedInferenceOwner } from '@/hooks/queries/useObservedInferenceOwner';
import { safeDownloadFilename } from '@/utils/downloadFilename';

/** Open the same authenticated file from a mail row or the message reader. */
export function useOpenAttachment() {
  const { oxyServices } = useOxy();
  const owner = useObservedInferenceOwner();
  const { t } = useTranslation();
  const binding = useMemo(
    () => ({
      identity: [
        owner.binding,
        owner.subject,
        owner.sessionId,
        owner.revision,
        owner.epoch,
        owner.knownSubject,
        owner.authenticated,
      ],
      pendingTabs: new Set<Window>(),
    }),
    [
      owner.binding,
      owner.subject,
      owner.sessionId,
      owner.revision,
      owner.epoch,
      owner.knownSubject,
      owner.authenticated,
    ],
  );
  const committed = useRef<typeof binding | null>(null);
  useLayoutEffect(() => {
    committed.current = binding;
    return () => {
      if (committed.current === binding) committed.current = null;
      for (const tab of binding.pendingTabs) {
        try {
          tab.close();
        } catch {
          // The browser may already have closed the popup.
        }
      }
      binding.pendingTabs.clear();
    };
  }, [binding]);
  return useCallback(
    async (fileId: string, filename: string) => {
      const isCurrent = () => committed.current === binding && owner.ready && owner.isCurrent();
      if (!isCurrent()) {
        const projection = owner.runtime.getAccountSessionIdentity();
        if (
          committed.current === binding &&
          !owner.ready &&
          projection.revision === owner.revision &&
          owner.http.getSessionEpoch() === owner.epoch &&
          oxyServices.session.userId === owner.knownSubject
        ) {
          toast.error(t('message.toast.attachmentSessionUnavailable'));
        }
        return;
      }
      if (Platform.OS === 'web') {
        // Keep popup creation in the user gesture to avoid browser popup blockers.
        const tab = window.open('', '_blank');
        if (tab) binding.pendingTabs.add(tab);
        const close = () => {
          if (!tab || !binding.pendingTabs.delete(tab)) return;
          try {
            tab.close();
          } catch {
            /* The browser may already have closed it. */
          }
        };
        try {
          const url = await oxyServices.assets.url(fileId);
          if (!isCurrent()) {
            close();
            return;
          }
          if (tab) {
            binding.pendingTabs.delete(tab);
            tab.opener = null;
            tab.location.href = url;
          } else {
            window.location.assign(url);
          }
        } catch (error: unknown) {
          close();
          if (isCurrent())
            toast.error(
              error instanceof Error ? error.message : t('message.toast.attachmentFailed'),
            );
        }
        return;
      }
      try {
        const url = await oxyServices.assets.url(fileId);
        if (!isCurrent()) return;
        // The OS may reclaim this file; an in-progress download may still finish after a switch.
        const cacheDirectory = FileSystem.cacheDirectory;
        if (!cacheDirectory) {
          await Linking.openURL(url);
          return;
        }
        const download = await FileSystem.downloadAsync(
          url,
          cacheDirectory + safeDownloadFilename(filename),
        );
        if (!isCurrent()) return;
        if (download.status < 200 || download.status >= 300) {
          throw new Error(t('message.toast.attachmentFailed'));
        }
        const available = await Sharing.isAvailableAsync();
        if (!isCurrent()) return;
        if (available) {
          await Sharing.shareAsync(download.uri);
        } else {
          await Linking.openURL(url);
        }
      } catch (error: unknown) {
        if (isCurrent())
          toast.error(error instanceof Error ? error.message : t('message.toast.attachmentFailed'));
      }
    },
    [oxyServices, t, owner, binding],
  );
}
