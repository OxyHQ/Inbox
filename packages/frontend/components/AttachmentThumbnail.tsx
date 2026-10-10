import { Avatar } from '@oxy.so/bloom/avatar';
import { RiFileImageLine } from '@oxy.so/bloom/icons';
import { Loading } from '@oxy.so/bloom/loading';
import { useAttachmentUrl } from '@/hooks/queries/useAttachmentUrl';
import { useTranslation } from '@/lib/i18n';
interface AttachmentThumbnailProps {
  fileId: string;
  size?: number;
}
export function AttachmentThumbnail({ fileId, size = 48 }: AttachmentThumbnailProps) {
  const { t } = useTranslation();
  const { url, isLoading } = useAttachmentUrl(fileId, true, 'thumb');
  return (
    <Avatar
      source={url}
      size={size}
      shape="squircle"
      color="neutral"
      alt={t('attachment.previewAlt')}
      placeholderIcon={isLoading ? <Loading size="sm" /> : <RiFileImageLine />}
    />
  );
}
