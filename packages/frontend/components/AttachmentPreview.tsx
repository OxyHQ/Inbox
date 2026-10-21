import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  Doc01Icon,
  File01Icon,
  FileZipIcon,
  Image01Icon,
  MusicNote01Icon,
  Pdf01Icon,
  PlayCircle02Icon,
  Ppt01Icon,
  Xls01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import { Card } from '@oxy.so/bloom/card';
import { Text } from '@oxy.so/bloom/typography';
import { useTheme } from '@oxy.so/bloom/theme';
import { Image } from 'expo-image';
import { Platform, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import type { Attachment } from '@/services/emailApi';
import { useAttachmentUrl } from '@/hooks/queries/useAttachmentUrl';
import { useOpenAttachment } from '@/hooks/useOpenAttachment';

type AttachmentInfo = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  hugeIcon: IconSvgElement;
  label: string;
  color: string;
};

function getAttachmentInfo(
  att: Attachment,
  tokens: ReturnType<typeof useTheme>['colors'],
): AttachmentInfo {
  const ct = att.contentType.toLowerCase();
  if (ct.startsWith('image/'))
    return {
      icon: 'image-outline',
      hugeIcon: Image01Icon as unknown as IconSvgElement,
      label: att.name,
      color: tokens.successSubtleForeground,
    };
  if (ct.startsWith('video/'))
    return {
      icon: 'play-circle-outline',
      hugeIcon: PlayCircle02Icon as unknown as IconSvgElement,
      label: att.name,
      color: tokens.errorSubtleForeground,
    };
  if (ct.startsWith('audio/'))
    return {
      icon: 'music-note-outline',
      hugeIcon: MusicNote01Icon as unknown as IconSvgElement,
      label: att.name,
      color: tokens.tertiarySubtleForeground,
    };
  if (ct.includes('pdf'))
    return {
      icon: 'file-pdf-box',
      hugeIcon: Pdf01Icon as unknown as IconSvgElement,
      label: att.name,
      color: tokens.errorSubtleForeground,
    };
  if (ct.includes('spreadsheet') || ct.includes('excel') || ct.includes('csv'))
    return {
      icon: 'file-excel-outline',
      hugeIcon: Xls01Icon as unknown as IconSvgElement,
      label: att.name,
      color: tokens.successSubtleForeground,
    };
  if (ct.includes('presentation') || ct.includes('powerpoint'))
    return {
      icon: 'file-powerpoint-outline',
      hugeIcon: Ppt01Icon as unknown as IconSvgElement,
      label: att.name,
      color: tokens.warningSubtleForeground,
    };
  if (ct.includes('document') || ct.includes('word') || ct.includes('msword'))
    return {
      icon: 'file-word-outline',
      hugeIcon: Doc01Icon as unknown as IconSvgElement,
      label: att.name,
      color: tokens.infoSubtleForeground,
    };
  if (ct.includes('zip') || ct.includes('rar') || ct.includes('tar') || ct.includes('gz'))
    return {
      icon: 'zip-box-outline',
      hugeIcon: FileZipIcon as unknown as IconSvgElement,
      label: att.name,
      color: tokens.textSecondary,
    };
  return {
    icon: 'file-outline',
    hugeIcon: File01Icon as unknown as IconSvgElement,
    label: att.name,
    color: tokens.textSecondary,
  };
}

/** A photo thumbnail or document tile in the mail row's shared horizontal rail. */
export function AttachmentPreview({
  attachment,
  disabled,
}: {
  attachment: Attachment;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const openAttachment = useOpenAttachment();
  const isImage = attachment.contentType.toLowerCase().startsWith('image/');
  const { url } = useAttachmentUrl(attachment.fileId, isImage, 'thumb');
  const [failed, setFailed] = useState(false);
  const info = getAttachmentInfo(attachment, colors);
  const extension = attachment.name.split('.').pop();
  const fileType =
    extension && extension !== attachment.name && extension.length <= 8
      ? extension.toUpperCase()
      : attachment.contentType.split('/').pop()?.toUpperCase();
  return (
    <Card
      appearance="subtle"
      tone="neutral"
      radius="radius-8"
      border="hairline"
      elevation="none"
      clipContent
      style={{ width: isImage ? 136 : 160, height: 88, flexShrink: 0 }}
      disabled={disabled}
      accessibilityLabel={attachment.name}
      onPress={() => void openAttachment(attachment.fileId, attachment.name)}
    >
      {isImage && url && !failed ? (
        <Image
          source={url}
          contentFit="cover"
          style={styles.image}
          onError={() => setFailed(true)}
          accessibilityLabel={attachment.name}
        />
      ) : (
        <View style={styles.document}>
          <Text variant="body-2-regular" numberOfLines={2}>
            {attachment.name}
          </Text>
          <View style={styles.fileType}>
            {Platform.OS === 'web' ? (
              <HugeiconsIcon icon={info.hugeIcon} size={18} color={info.color} />
            ) : (
              <MaterialCommunityIcons name={info.icon} size={18} color={info.color} />
            )}
            <Text
              variant="caption-1-regular"
              style={{ color: colors.textSecondary }}
              numberOfLines={1}
            >
              {fileType}
            </Text>
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', height: '100%' },
  document: { flex: 1, padding: 12, justifyContent: 'space-between', gap: 4 },
  fileType: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
