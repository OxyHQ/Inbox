import { useQuery } from '@tanstack/react-query';
import { useOxy } from '@oxy.so/services/ui/client';
import { emailKeys } from '@/hooks/queries/queryKeys';

/**
 * Resolves a download/preview URL for an attachment, which is a file in the
 * Oxy File Manager. Uses the core SDK's `getFileDownloadUrlAsync` (signed CDN
 * URL with a fallback to the authenticated `/assets/:id/stream` endpoint).
 * Signed URLs expire in 60 min; staleTime is 45 min to refresh before expiry.
 */
/** Signed URLs expire in 60 min: refreshed before that. */
export const ATTACHMENT_URL_STALE_MS = 45 * 60 * 1000;

export function useAttachmentUrl(fileId: string, enabled = true, variant?: string) {
  const { oxyServices } = useOxy();

  const { data: url = null, isLoading } = useQuery({
    queryKey: emailKeys.attachmentUrl(fileId, variant),
    queryFn: () => oxyServices.assets.url(fileId, variant),
    enabled: enabled && !!fileId,
    staleTime: ATTACHMENT_URL_STALE_MS,
  });

  return { url, isLoading };
}
