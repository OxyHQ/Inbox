import { recordInboxMetric } from '@/utils/inboxTelemetry';

describe('Inbox telemetry privacy boundary', () => {
  it('emits only the allow-listed event and dimensions', () => {
    const listener = jest.fn();
    window.addEventListener('oxy:inbox-telemetry', listener);

    recordInboxMetric('search_submitted', { hasQuery: true, hasOperators: false });

    const event = listener.mock.calls[0]?.[0] as CustomEvent<{ name: string; hasQuery?: boolean }>;
    expect(event.detail.name).toBe('search_submitted');
    expect(event.detail.hasQuery).toBe(true);
    expect(event.detail).not.toHaveProperty('query');
    expect(event.detail).not.toHaveProperty('messageId');
    window.removeEventListener('oxy:inbox-telemetry', listener);
  });
});
