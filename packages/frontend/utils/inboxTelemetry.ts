/**
 * Privacy-safe client instrumentation for Inbox hosts.
 *
 * The event name and numeric/boolean dimensions are intentionally allow-listed:
 * message subjects, addresses, search text, ids, and error bodies never leave
 * the process. Hosts subscribe to `oxy:inbox-telemetry` and forward these
 * metrics to their approved observability pipeline.
 *
 * **Nothing subscribes today.** `inbox.oxy.so` serves static assets from a
 * Worker that does not run in the page, so on the web these events are
 * dispatched into an empty room. That is worth stating plainly, because it is
 * why a realtime outage was invisible for as long as it was: the failure path
 * recorded a metric, and the metric went nowhere. Treat a counter added here as
 * a hook for a future host, NOT as production observability — when a failure
 * has to be noticed, it needs a user-visible signal as well.
 */

export type InboxMetricName =
  | 'realtime_email_new'
  | 'realtime_email_changed'
  | 'realtime_malformed_event'
  | 'search_submitted'
  | 'composer_send_succeeded'
  | 'composer_send_queued'
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
