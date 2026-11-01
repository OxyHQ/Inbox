/** Observable session fence for memory-only inference UI. */
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useOxy } from '@oxy.so/services/ui/client';
import { useOxyRuntime } from '@oxy.so/services/runtime';
import { useQueryClient } from '@tanstack/react-query';
import { reserveInferenceBinding } from '@/hooks/queries/inferenceNamespace';

export function useObservedInferenceOwner() {
  const { oxyServices, user } = useOxy();
  const runtime = useOxyRuntime();
  const queryClient = useQueryClient();
  const http = oxyServices.http;
  const subject = user?.id ?? null;
  const subscribeToken = useCallback(
    (notify: () => void) => http.addTokenChangeListener(notify),
    [http],
  );
  const getEpoch = useCallback(() => http.getSessionEpoch(), [http]);
  const epoch = useSyncExternalStore(subscribeToken, getEpoch, getEpoch);
  const getKnownSubject = useCallback(() => oxyServices.session.userId, [oxyServices]);
  const knownSubject = useSyncExternalStore(subscribeToken, getKnownSubject, getKnownSubject);
  const getAuthenticated = useCallback(() => oxyServices.session.isAuthenticated, [oxyServices]);
  const authenticated = useSyncExternalStore(subscribeToken, getAuthenticated, getAuthenticated);
  const subscribeRuntime = useCallback(
    (notify: () => void) => runtime.subscribe(notify),
    [runtime],
  );
  const getRevision = useCallback(() => runtime.getAccountSessionRevision(), [runtime]);
  const revision = useSyncExternalStore(subscribeRuntime, getRevision, getRevision);
  const projection = runtime.getAccountSessionIdentity();
  const binding = useMemo(
    () => ({ id: reserveInferenceBinding(), runtime, http, queryClient }),
    [runtime, http, queryClient],
  );
  // A decoded subject is only a local mismatch check, never proof of an actor.
  const ready =
    subject !== null &&
    projection.accountId === subject &&
    authenticated &&
    (knownSubject === null || knownSubject === subject);
  const isCurrent = () => {
    const current = runtime.getAccountSessionIdentity();
    const currentKnownSubject = oxyServices.session.userId;
    return (
      subject !== null &&
      current.accountId === subject &&
      current.sessionId === projection.sessionId &&
      current.revision === revision &&
      http.getSessionEpoch() === epoch &&
      oxyServices.session.isAuthenticated &&
      currentKnownSubject === knownSubject &&
      (currentKnownSubject === null || currentKnownSubject === subject)
    );
  };
  return {
    binding: binding.id,
    subject,
    sessionId: projection.sessionId,
    revision,
    epoch,
    knownSubject,
    authenticated,
    runtime,
    http,
    ready,
    isCurrent,
  };
}
export type InferenceOwner = ReturnType<typeof useObservedInferenceOwner>;
