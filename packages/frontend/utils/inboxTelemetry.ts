/**
 * Privacy-safe client instrumentation for Inbox hosts.
 *
 * The event name and numeric/boolean dimensions are intentionally allow-listed:
 * message subjects, addresses, search text, ids, and error bodies never leave
 * the process. Hosts can subscribe to `oxy:inbox-telemetry` and forward these
 * metrics to their approved observability pipeline.
 */

export type InboxMetricName =
  | 'realtime_connected'
  | 'realtime_connect_error'
  | 'search_submitted'
  | 'composer_send_succeeded'
  | 'composer_send_failed';

export interface InboxMetricDimensions {
  hasQuery?: boolean;
  hasOperators?: boolean;
  queued?: boolean;
}

export function recordInboxMetric(name: InboxMetricName, dimensions: InboxMetricDimensions = {}): void {
  const detail = {
    name,
    ...dimensions,
    at: Date.now(),
  };

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('oxy:inbox-telemetry', { detail }));
  }
}
