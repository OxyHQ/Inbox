const recordInboxMetric = jest.fn();
jest.mock('@/utils/inboxTelemetry', () => ({ recordInboxMetric }));

import { createEmailApi } from '@/services/emailApi';
import {
  ContactSchema,
  EmailFilterSchema,
  LabelSchema,
  MessageSchema,
} from '@/schemas/emailSchemas';
import { ampAttachment, wireContact, wireMessage } from '../fixtures/wire';

/**
 * The app's response schemas are the `@oxy.so/contracts` email wire contract.
 * These fixtures are the shapes oxy-api really sends — including every value
 * that once disagreed with a hand-written client copy.
 */
describe('email wire contract, as the app parses it', () => {
  it('parses an attachment whose contentId is null', () => {
    const parsed = MessageSchema.parse(wireMessage({ attachments: [ampAttachment] }));
    expect(parsed.attachments[0]).toMatchObject({
      contentType: 'text/x-amp-html',
      contentId: null,
      isInline: false,
    });
  });

  it('parses a contact whose company and notes are null', () => {
    expect(ContactSchema.parse(wireContact())).toMatchObject({ company: null, notes: null });
  });

  it('keeps a card whose confidence and extractedAt are null', () => {
    const parsed = MessageSchema.parse(
      wireMessage({
        card: {
          type: 'package',
          data: { carrier: 'UPS', trackingNumber: '1Z' },
          confidence: null,
          extractedAt: null,
        },
      }),
    );
    expect(parsed.card).toMatchObject({
      type: 'package',
      data: { carrier: 'UPS' },
      confidence: null,
    });
  });

  it('drops only the card, never the message, when the card has no payload', () => {
    const parsed = MessageSchema.parse(
      wireMessage({ card: { type: 'bill', data: null, confidence: null, extractedAt: null } }),
    );
    expect(parsed._id).toBeDefined();
    expect(parsed.card).toBeUndefined();
  });

  it('parses system and user labels from one list', () => {
    const labels = [
      { _id: 'system:important', name: 'important', color: '#f00', order: 0, system: true },
      {
        _id: 'label-1',
        id: 'label-1',
        userId: 'user-1',
        name: 'Finance',
        color: '#0f0',
        order: 1,
        system: false,
        createdAt: '2026-09-27T05:56:22.583Z',
        updatedAt: '2026-09-27T05:56:22.583Z',
      },
    ];
    expect(labels.map((l) => LabelSchema.parse(l).system)).toEqual([true, false]);
  });

  it('takes filter vocabularies from the contract', () => {
    const filter = {
      _id: 'filter-1',
      id: 'filter-1',
      userId: 'user-1',
      name: 'Receipts',
      enabled: true,
      matchAll: true,
      order: 0,
      conditions: [{ field: 'from', operator: 'ends-with', value: '@ramp.com' }],
      actions: [{ type: 'label', value: 'finance' }, { type: 'star' }],
      createdAt: '2026-09-27T05:56:22.583Z',
      updatedAt: '2026-09-27T05:56:22.583Z',
    };
    expect(EmailFilterSchema.parse(filter).actions).toHaveLength(2);
    expect(EmailFilterSchema.safeParse({ ...filter, actions: [{ type: 'explode' }] }).success).toBe(
      false,
    );
  });

  it('lists contacts with null fields through the API client', async () => {
    const http = {
      get: jest.fn().mockResolvedValue({
        data: [wireContact(), wireContact({ _id: 'contact-2', id: 'contact-2', company: 'Ramp' })],
        pagination: { total: 2, limit: 50, offset: 0, hasMore: false },
      }),
    };
    const contacts = await createEmailApi(http as never).listContacts();
    expect(contacts.data.map((c) => c.company)).toEqual([null, 'Ramp']);
  });
});
