/**
 * Hand an RFC 5322 message to the user as a `.eml` file: a download on the
 * web, the share sheet on native. One implementation for "Download message"
 * and for opening the raw source of a message this client could not read.
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { toast } from '@oxy.so/bloom';

import type { TranslateFn } from '@/lib/i18n';
import { safeDownloadFilename } from '@/utils/downloadFilename';

export function emlFilename(subject: string | null | undefined): string {
  const safeSubject = (subject ?? '')
    .replace(/[^a-zA-Z0-9_\- ]/g, '_')
    .slice(0, 60)
    .trim();
  return `${safeDownloadFilename(safeSubject || 'message')}.eml`;
}

export async function saveEmlFile(
  content: string,
  filename: string,
  t: TranslateFn,
): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type: 'message/rfc822' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }
  try {
    const documentDirectory = FileSystem.documentDirectory;
    if (!documentDirectory) {
      toast.error(t('message.toast.fileSystemUnavailable'));
      return;
    }
    const fileUri = `${documentDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(fileUri, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'message/rfc822',
        dialogTitle: t('message.toast.saveEmailDialog'),
      });
    } else {
      toast.error(t('message.toast.sharingUnavailable'));
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : t('message.toast.downloadFailed');
    toast.error(message);
  }
}
