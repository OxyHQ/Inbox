import { useQuery } from '@tanstack/react-query';
import { useOxy } from '@oxy.so/services/ui/client';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { reserveInferenceNamespace } from '@/hooks/queries/inferenceNamespace';
import {
  ATTACHMENT_URL_STALE_MS,
  resolveScopedAttachment,
  scopedAttachmentKey,
  useScopedAttachmentContext,
} from '@/hooks/queries/scopedAttachment';

export { ATTACHMENT_URL_STALE_MS } from '@/hooks/queries/scopedAttachment';

/** Resolve an attachment URL within the observed, memory-only account scope. */
export function useAttachmentUrl(fileId: string, enabled = true, variant?: string) {
  const { oxyServices } = useOxy();
  const { queryClient, owner, scope, committed } = useScopedAttachmentContext(
    oxyServices,
    enabled && !!fileId,
  );
  const eligible =
    enabled && !!fileId && owner.ready && oxyServices.http === owner.http && owner.isCurrent();
  const target = useMemo(
    () => ({ scope, fileId, variant, enabled, id: reserveInferenceNamespace(queryClient) }),
    [scope, fileId, variant, enabled, queryClient],
  );
  const committedTarget = useRef<typeof target | null>(null);
  useLayoutEffect(() => {
    committedTarget.current = target;
    return () => {
      if (committedTarget.current === target) committedTarget.current = null;
    };
  }, [target]);
  const isCurrent = () =>
    committedTarget.current === target &&
    committed.current?.scope === scope &&
    enabled &&
    !!fileId &&
    owner.ready &&
    oxyServices.http === owner.http &&
    owner.isCurrent();
  const { data, isLoading } = useQuery({
    queryKey: scopedAttachmentKey(fileId, variant, scope.identity),
    queryFn: async ({ signal }) => {
      const lease = committed.current?.scope === scope ? committed.current.lease : null;
      const ownerCurrent = () => !!lease && lease.observers > 0 && owner.isCurrent();
      if (!lease || signal.aborted || !ownerCurrent()) throw new Error('Email account changed');
      const url = await resolveScopedAttachment({
        queryClient,
        service: oxyServices,
        identity: scope.identity,
        lease,
        fileId,
        variant,
        ownerCurrent,
        publish: false,
      });
      if (signal.aborted || !ownerCurrent()) throw new Error('Email account changed');
      return url;
    },
    enabled: eligible,
    // The shared in-flight query already applies the client's retry policy.
    retry: false,
    staleTime: ATTACHMENT_URL_STALE_MS,
  });
  return {
    url: eligible ? (data ?? null) : null,
    isLoading: eligible && isLoading,
    scope: target,
    isCurrent,
  };
}
