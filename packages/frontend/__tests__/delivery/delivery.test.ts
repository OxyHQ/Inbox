import { MessageSchema } from '@/schemas/emailSchemas';
import {
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
    expect(isOutstanding(message(wireDelivery({ state: 'sent', error: null, errorCode: null })).delivery)).toBe(false);
  });

  it('reports sending, retrying and failed; only failed needs the user', () => {
    for (const state of ['sending', 'retrying', 'failed'] as const) {
      expect(isOutstanding(message(wireDelivery({ state })).delivery)).toBe(true);
    }
    expect(isUndelivered(message(wireDelivery({ state: 'retrying' })).delivery)).toBe(false);
    expect(isUndelivered(message(wireDelivery({ state: 'failed' })).delivery)).toBe(true);
  });

  it('explains by code, and a cancelled send by its own words', () => {
    expect(deliveryReasonKey(message(wireDelivery()).delivery!)).toBe('delivery.reason.rejected');
    expect(deliveryReasonKey(message(wireDelivery({ errorCode: null })).delivery!)).toBe('delivery.cancelled');
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
