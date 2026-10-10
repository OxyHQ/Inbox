/**
 * Zod schemas + inferred types for the Oxy email domain.
 *
 * Every API RESPONSE schema here is DERIVED from `@oxy.so/contracts`' email wire
 * contract, which oxy-api is typed against and tests real responses with. One
 * declaration, two sides: the client can no longer disagree with the server
 * about a field's nullability, which is how `contentId: null` once made
 * messages vanish from the inbox. Only client-side REFINEMENTS are composed on
 * top (the typed card payload, and a card that fails to parse degrading to
 * "no card" rather than failing its message) — never a redeclared field.
 *
 * The schemas below `Pagination` describe endpoints the contract does not
 * cover yet (quota, settings, subscriptions, reminders, templates, saved
 * searches); they stay local until it does.
 *
 * `services/emailApi.ts` re-exports everything here, so existing
 * `@/services/emailApi` imports keep working unchanged.
 */

import { z } from 'zod';
import {
  MESSAGE_CARD_TYPES,
  emailAttachmentSchema,
  emailBundleSchema,
  emailContactSchema,
  emailFilterActionSchema,
  emailFilterConditionSchema,
  emailFilterSchema,
  emailLabelSchema,
  emailMailboxSchema,
  emailMessageAddressSchema,
  emailMessageCardSchema,
  emailMessageFlagsSchema,
  emailMessageHighlightSchema,
  emailMessageSchema,
  emailOutboxSchema,
} from '@oxy.so/contracts';

// ─── Schemas derived from the wire contract ────────────────────────

export const EmailAddressSchema = emailMessageAddressSchema;
export const AttachmentSchema = emailAttachmentSchema;
export const MessageFlagsSchema = emailMessageFlagsSchema;
export const CardTypeSchema = z.enum(MESSAGE_CARD_TYPES);

/**
 * Typed view of a card's payload. The contract carries it as an open record;
 * this names the keys the UI reads. Fields are the superset of every card
 * variant, all optional because extraction is best-effort, and `.passthrough()`
 * keeps any key the extractor adds.
 */
export const CardDataSchema = z
  .object({
    // Trip
    airline: z.string().optional(),
    flightNumber: z.string().optional(),
    departure: z.string().optional(),
    arrival: z.string().optional(),
    departureTime: z.string().optional(),
    arrivalTime: z.string().optional(),
    confirmationCode: z.string().optional(),
    hotel: z.string().optional(),
    checkIn: z.string().optional(),
    checkOut: z.string().optional(),
    // Purchase
    merchant: z.string().optional(),
    amount: z.number().optional(),
    currency: z.string().optional(),
    orderNumber: z.string().optional(),
    items: z.array(z.string()).optional(),
    // Event
    title: z.string().optional(),
    location: z.string().optional(),
    description: z.string().optional(),
    organizer: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    // Bill
    biller: z.string().optional(),
    dueDate: z.string().optional(),
    accountNumber: z.string().optional(),
    // Package
    carrier: z.string().optional(),
    estimatedDelivery: z.string().optional(),
    status: z.string().optional(),
    trackingNumber: z.string().optional(),
  })
  .passthrough();

/**
 * A card the UI can render: the contract's card with its payload present and
 * typed. The wire allows `data: null`; a card with nothing in it has nothing to
 * show, so it degrades to "no card" (see `MessageSchema`).
 */
export const MessageCardSchema = emailMessageCardSchema.extend({ data: CardDataSchema });

export const HighlightSchema = emailMessageHighlightSchema;

/**
 * A message as every `/email` read returns it. The one refinement: a card that
 * does not satisfy `MessageCardSchema` becomes `undefined` instead of failing
 * the whole message — a best-effort AI extraction must never hide a mail.
 */
export const MessageSchema = emailMessageSchema.extend({
  card: MessageCardSchema.optional().catch(undefined),
});

export const MailboxSchema = emailMailboxSchema;
export const LabelSchema = emailLabelSchema;

export const PaginationSchema = z.object({
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  hasMore: z.boolean(),
  nextCursor: z.string().nullable().optional(),
});

export const QuotaUsageSchema = z.object({
  used: z.number(),
  limit: z.number(),
  percentage: z.number(),
});

export const EmailSettingsSchema = z.object({
  signature: z.string(),
  autoReply: z.object({
    enabled: z.boolean(),
    subject: z.string().optional(),
    body: z.string().optional(),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
  }),
  autoForwardTo: z.string().optional(),
  autoForwardKeepCopy: z.boolean().optional(),
  address: z.string().optional(),
});

export const SubscriptionSchema = z.object({
  _id: z.string(),
  name: z.string(),
  messageCount: z.number(),
  /** How many of those messages were opened. Defaults to 0 on older APIs. */
  readCount: z.number().default(0),
  latestDate: z.string(),
  oldestDate: z.string(),
  latestMessageId: z.string(),
  hasListUnsubscribe: z.boolean(),
  type: z.enum(['list-unsubscribe', 'pattern-match', 'frequent']),
  senderAvatarPath: z.string().nullable().optional(),
  /**
   * Set once an unsubscribe (or block) for this sender succeeded. Optional:
   * an API from before the field still returns the row without it, and the
   * row then reads as still subscribed.
   */
  unsubscribed: z.boolean().optional(),
  /** When it happened (ISO 8601). */
  unsubscribedAt: z.string().nullable().optional(),
});

export const UnsubscribeResultSchema = z.object({
  success: z.boolean(),
  method: z.string(),
});

export const BundleSchema = emailBundleSchema;

export const ReminderSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  text: z.string(),
  remindAt: z.string(),
  completed: z.boolean(),
  pinned: z.boolean(),
  snoozedUntil: z.string().nullable().optional(),
  relatedMessageId: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ContactSuggestionSchema = z.object({
  name: z.string().nullable().optional(),
  address: z.string(),
});

export const ContactSchema = emailContactSchema;

export const EmailFilterConditionSchema = emailFilterConditionSchema;

export const EmailFilterActionSchema = emailFilterActionSchema;

export const EmailFilterSchema = emailFilterSchema;

export const EmailTemplateSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  name: z.string(),
  subject: z.string(),
  body: z.string(),
  order: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const EmailOutboxSchema = emailOutboxSchema;

export const SavedEmailSearchFiltersSchema = z.object({
  q: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  subject: z.string().optional(),
  hasAttachment: z.boolean().optional(),
  dateAfter: z.string().optional(),
  dateBefore: z.string().optional(),
  mailbox: z.string().optional(),
  starred: z.boolean().optional(),
  unread: z.boolean().optional(),
  label: z.string().optional(),
}).default({});

export const SavedEmailSearchSchema = z.object({
  id: z.string(),
  name: z.string(),
  query: z.string(),
  filters: SavedEmailSearchFiltersSchema,
  order: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// ─── Compose input validation ──────────────────────────────────────

/**
 * A recipient the client SENDS (compose, draft save). Unlike the wire
 * `EmailAddress`, where a missing display name is `''`, a typed address has
 * no name at all.
 */
export interface RecipientInput {
  name?: string;
  address: string;
}

/** A single recipient email address, validated with Zod's email rule. */
export const RecipientEmailSchema = z.string().trim().email();

/** Whether a raw string is a valid recipient email address. */
export function isValidRecipientEmail(value: string): boolean {
  return RecipientEmailSchema.safeParse(value).success;
}

/**
 * Parse a comma-separated recipient string into `{ address }` objects, keeping
 * only the syntactically-valid addresses. Single chokepoint for To/Cc/Bcc
 * parsing in the composer.
 */
export function parseRecipientList(input: string): RecipientInput[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter(isValidRecipientEmail)
    .map((address) => ({ address }));
}

// ─── Inferred Types ────────────────────────────────────────────────

export type EmailAddress = z.infer<typeof EmailAddressSchema>;
export type Attachment = z.infer<typeof AttachmentSchema>;
export type MessageFlags = z.infer<typeof MessageFlagsSchema>;
export type CardType = z.infer<typeof CardTypeSchema>;
export type CardData = z.infer<typeof CardDataSchema>;
export type MessageCard = z.infer<typeof MessageCardSchema>;
export type Highlight = z.infer<typeof HighlightSchema>;
export type Message = z.infer<typeof MessageSchema>;

/**
 * A list row the API returned that does not satisfy `MessageSchema`.
 *
 * Deliberately NOT a `Message`: nothing that acts on a message (flags, reply,
 * thread grouping) can receive one by accident. The list renders it as a
 * degraded row so a message never silently disappears.
 */
export interface UnreadableMessage {
  kind: 'unreadable';
  _id: string | null;
  from: string | null;
  subject: string | null;
  receivedAt: string | null;
}
export type Mailbox = z.infer<typeof MailboxSchema>;
export type Label = z.infer<typeof LabelSchema>;
export type Pagination = z.infer<typeof PaginationSchema>;
export type QuotaUsage = z.infer<typeof QuotaUsageSchema>;
export type EmailSettings = z.infer<typeof EmailSettingsSchema>;
export type Subscription = z.infer<typeof SubscriptionSchema>;
export type UnsubscribeResult = z.infer<typeof UnsubscribeResultSchema>;
export type Bundle = z.infer<typeof BundleSchema>;
export type Reminder = z.infer<typeof ReminderSchema>;
export type ContactSuggestion = z.infer<typeof ContactSuggestionSchema>;
export type Contact = z.infer<typeof ContactSchema>;
export type EmailFilter = z.infer<typeof EmailFilterSchema>;
export type EmailFilterCondition = z.infer<typeof EmailFilterConditionSchema>;
export type EmailFilterAction = z.infer<typeof EmailFilterActionSchema>;
export type EmailTemplate = z.infer<typeof EmailTemplateSchema>;
export type EmailOutbox = z.infer<typeof EmailOutboxSchema>;
export type SavedEmailSearchFilters = z.infer<typeof SavedEmailSearchFiltersSchema>;
export type SavedEmailSearch = z.infer<typeof SavedEmailSearchSchema>;
