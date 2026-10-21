import { useCallback } from 'react';
import { Linking, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { toast } from '@oxy.so/bloom';
import { useOxy } from '@oxy.so/services/ui/client';
import { useTranslation } from '@/lib/i18n';
import { safeDownloadFilename } from '@/utils/downloadFilename';

/** Open the same authenticated file from a mail row or the message reader. */
export function useOpenAttachment() {
  const { oxyServices } = useOxy();
  const { t } = useTranslation();
  return useCallback(
    async (fileId: string, filename: string) => {
      if (Platform.OS === 'web') {
        // The window is opened IN the tap, then pointed at the file once its
        // signed URL arrives: opened after the await, it is a popup that
        // Safari and strict blockers refuse — and nothing said so.
        const tab = window.open('', '_blank');
        try {
          const url = await oxyServices.assets.url(fileId);
          if (tab) {
            tab.opener = null;
            tab.location.href = url;
          } else {
            window.location.assign(url);
          }
        } catch (error: unknown) {
          tab?.close();
          toast.error(error instanceof Error ? error.message : t('message.toast.attachmentFailed'));
        }
        return;
      }
      try {
        const url = await oxyServices.assets.url(fileId);
        // A cache file: the OS may reclaim it, nothing piles up in Documents.
        const cacheDirectory = FileSystem.cacheDirectory;
        if (!cacheDirectory) {
          await Linking.openURL(url);
          return;
        }
        const download = await FileSystem.downloadAsync(
          url,
          cacheDirectory + safeDownloadFilename(filename),
        );
        // An expired link or a refusal downloads an error page; never hand
        // that to the share sheet as the user's file.
        if (download.status < 200 || download.status >= 300) {
          throw new Error(t('message.toast.attachmentFailed'));
        }
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(download.uri);
        } else {
          await Linking.openURL(url);
        }
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : t('message.toast.attachmentFailed'));
      }
    },
    [oxyServices, t],
  );
}
