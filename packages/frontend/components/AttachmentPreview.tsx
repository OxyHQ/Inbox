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
import { useTheme } from '@oxy.so/bloom/theme';
import { Image } from 'expo-image';
import { Platform, StyleSheet } from 'react-native';
import { useState } from 'react';
import type { Attachment } from '@/services/emailApi';
import { useAttachmentUrl } from '@/hooks/queries/useAttachmentUrl';
import { useOpenAttachment } from '@/hooks/useOpenAttachment';
import { Embed, HStack, Text as LText, VStack, toElement } from '@oxy.so/bloom-language';

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
  const { url, scope, isCurrent } = useAttachmentUrl(attachment.fileId, isImage, 'thumb');
  const [failure, setFailure] = useState<{ url: string; scope: typeof scope } | null>(null);
  const failed = failure?.url === url && failure.scope === scope;
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
          onError={() => {
            if (isCurrent()) setFailure({ url, scope });
          }}
          accessibilityLabel={attachment.name}
        />
      ) : (
        toElement(
          VStack(
            LText(attachment.name).font('body-2').lines(2),
            HStack(
              Embed(
                Platform.OS === 'web' ? (
                  <HugeiconsIcon icon={info.hugeIcon} size={18} color={info.color} />
                ) : (
                  <MaterialCommunityIcons name={info.icon} size={18} color={info.color} />
                ),
              ),
              LText(fileType).foreground('muted').font('caption-1').lines(1),
            )
              .align('center')
              .spacing('6'),
          )
            .padding('all', 'md')
            .justify('between')
            .spacing('xs')
            .grow(),
        )
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', height: '100%' },
});
