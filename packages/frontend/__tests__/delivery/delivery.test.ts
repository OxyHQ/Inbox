import { MessageSchema } from '@/schemas/emailSchemas';
import {
  canRetry,
  deliveryReasonKey,
  editAsNewParams,
  isOutstanding,
  isUndelivered,
  outstandingDeliveries,
} from '@/utils/delivery';
import { wireDelivery, wireMessage } from '../fixtures/wire';

const message = (delivery?: Record<string, unknown>, id = 'm') =>
  MessageSchema.parse(wireMessage({ _id: id, id, ...(delivery ? { delivery } : {}) }));

describe('reading a delivery', () => {
  it('treats received mail and delivered mail as nothing to report', () => {
    expect(isOutstanding(message().delivery)).toBe(false);
    expect(
      isOutstanding(
        message(wireDelivery({ state: 'sent', error: null, errorCode: null })).delivery,
      ),
    ).toBe(false);
  });

  it('reports sending, retrying and failed; only failed needs the user', () => {
    for (const state of ['sending', 'retrying', 'failed'] as const) {
      expect(isOutstanding(message(wireDelivery({ state })).delivery)).toBe(true);
    }
    expect(isUndelivered(message(wireDelivery({ state: 'retrying' })).delivery)).toBe(false);
    expect(isUndelivered(message(wireDelivery({ state: 'failed' })).delivery)).toBe(true);
  });

  it('explains by code, and says nothing of a reason it does not know', () => {
    const rejected = message(wireDelivery()).delivery;
    const unknown = message(wireDelivery({ errorCode: 'quarantined' })).delivery;
    if (!rejected || !unknown) throw new Error('the delivery did not parse');
    expect(deliveryReasonKey(rejected)).toBe('delivery.reason.rejected');
    // An unknown code keeps the delivery and drops only the code.
    expect(unknown.state).toBe('failed');
    expect(deliveryReasonKey(unknown)).toBeNull();
  });

  it('offers Retry for a failure, but not for a bounce', () => {
    const failed = message(wireDelivery()).delivery;
    const bounced = message(wireDelivery({ errorCode: 'bounced' })).delivery;
    const retrying = message(
      wireDelivery({ state: 'retrying', errorCode: 'relay_unavailable' }),
    ).delivery;
    if (!failed || !bounced || !retrying) throw new Error('the delivery did not parse');
    expect(canRetry(failed)).toBe(true);
    expect(canRetry(bounced)).toBe(false);
    expect(canRetry(retrying)).toBe(false);
  });

  it('keeps the message when its delivery cannot be read', () => {
    const parsed = message({ state: 'teleported' });
    expect(parsed._id).toBe('m');
    expect(parsed.delivery).toBeUndefined();
  });

  it('lists the stuck ones apart from the waiting ones', () => {
    const { failed, pending } = outstandingDeliveries([
      message(wireDelivery({ state: 'failed' }), 'f'),
      message(wireDelivery({ state: 'retrying' }), 'r'),
      message(undefined, 'received'),
      message(wireDelivery({ state: 'sent', error: null, errorCode: null }), 's'),
    ]);
    expect(failed.map((m) => m._id)).toEqual(['f']);
    expect(pending.map((m) => m._id)).toEqual(['r']);
  });

  it('reopens a failed message in the composer as a new one', () => {
    const failed = MessageSchema.parse(
      wireMessage({
        to: [{ name: '', address: 'support@example.com' }],
        cc: [{ name: 'Ops', address: 'ops@example.com' }],
        subject: 'Re: Quota',
        text: 'Thanks',
        delivery: wireDelivery(),
      }),
    );
    expect(editAsNewParams(failed)).toEqual({
      to: 'support@example.com',
      cc: 'ops@example.com',
      subject: 'Re: Quota',
      body: 'Thanks',
    });
  });
});
