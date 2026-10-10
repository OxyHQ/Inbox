/**
 * Email API client
 *
 * Wraps the Oxy email REST API for use in the Inbox app.
 * Uses OxyServices.http for automatic auth and CSRF handling.
 * All responses validated with zod schemas at runtime.
 */

import { chunk } from '@oxy.so/utils/text';
import { z } from 'zod';
import type { OxyServices } from '@oxy.so/core';

// Runtime schemas + inferred types live in `@/schemas/emailSchemas`. They are
// re-exported here so existing `@/services/emailApi` imports keep working.
import {
  MessageSchema,
  MailboxSchema,
  LabelSchema,
  PaginationSchema,
  QuotaUsageSchema,
  EmailSettingsSchema,
  SubscriptionSchema,
  UnsubscribeResultSchema,
  BundleSchema,
  ReminderSchema,
  ContactSuggestionSchema,
  ContactSchema,
  EmailFilterSchema,
  EmailTemplateSchema,
  EmailOutboxSchema,
  SavedEmailSearchSchema,
} from '@/schemas/emailSchemas';
import { recordInboxMetric } from '@/utils/inboxTelemetry';
import type {
  EmailAddress,
  RecipientInput,
  Message,
  UnreadableMessage,
  Mailbox,
  Label,
  Pagination,
  MessageFlags,
  QuotaUsage,
  EmailSettings,
  Subscription,
  UnsubscribeResult,
  Bundle,
  Reminder,
  ContactSuggestion,
  Contact,
  EmailFilter,
  EmailFilterCondition,
  EmailFilterAction,
  EmailTemplate,
  EmailOutbox,
  SavedEmailSearch,
  SavedEmailSearchFilters,
} from '@/schemas/emailSchemas';

export * from '@/schemas/emailSchemas';

type HttpService = OxyServices['http'];

// ─── Response Helpers ──────────────────────────────────────────────

// HttpService.unwrapResponse() already strips the { data: ... } wrapper for
// non-paginated responses and returns paginated { data, pagination } as-is.
// So http.get() returns the inner value directly (or { data, pagination } for
// paginated endpoints). No extra unwrapping needed here.

interface PaginatedResult<T> {
  data: T[];
  pagination: Pagination;
}

export interface EmailSearchOptions {
  q?: string;
  from?: string;
  to?: string;
  subject?: string;
  hasAttachment?: boolean;
  dateAfter?: string;
  dateBefore?: string;
  mailbox?: string;
  starred?: boolean;
  unread?: boolean;
  label?: string;
  limit?: number;
  offset?: number;
  cursor?: string;
}

/**
 * A read that returns several messages. `unreadable` holds the rows the API
 * sent that fail the schema — reported, and shown degraded by the UI, never
 * silently dropped.
 */
export interface ThreadData {
  messages: Message[];
  unreadable: UnreadableMessage[];
}

export interface BundledMessages {
  primary: Message[];
  primaryUnreadable: UnreadableMessage[];
  bundles: {
    bundle: Bundle;
    messages: Message[];
    unreadable: UnreadableMessage[];
    unreadCount: number;
  }[];
  pagination: Pagination;
}

export interface EmailSendOptions {
  idempotencyKey?: string;
}

function readString(value: unknown, key: string): string | null {
  if (typeof value !== 'object' || value === null) return null;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'string' ? field : null;
}

/**
 * What can still be read from a row that failed the schema: enough to show the
 * user that a message IS there and let them open it, never enough to mistake
 * it for a `Message`.
 */
function toUnreadable(item: unknown): UnreadableMessage {
  const from =
    typeof item === 'object' && item !== null ? (item as { from?: unknown }).from : undefined;
  return {
    kind: 'unreadable',
    _id: readString(item, '_id'),
    from: readString(from, 'name') || readString(from, 'address'),
    subject: readString(item, 'subject'),
    receivedAt: readString(item, 'receivedAt') ?? readString(item, 'date'),
  };
}

/**
 * Parse an array of messages.
 *
 * A row that fails the schema is a CONTRACT bug between this client and the
 * API, never a "stale cache item": the Ramp verification mails vanished from
 * the inbox because an attachment's `contentId: null` failed here and the row
 * was skipped without a word. So a failure is reported, loudly and in
 * production, with the fields that failed — never the message content — and
 * the row comes back as an `UnreadableMessage` for the list to show.
 */
function parseMessageList(
  items: unknown,
  source: string,
): { messages: Message[]; unreadable: UnreadableMessage[] } {
  const messages: Message[] = [];
  const unreadable: UnreadableMessage[] = [];
  if (!Array.isArray(items)) return { messages, unreadable };
  for (const item of items) {
    const result = MessageSchema.safeParse(item);
    if (result.success) {
      messages.push(result.data);
      continue;
    }
    const row = toUnreadable(item);
    console.error('[inbox] message failed schema validation', {
      source,
      id: row._id,
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    recordInboxMetric('message_parse_failed');
    unreadable.push(row);
  }
  return { messages, unreadable };
}

/**
 * A single-message read. Throws — the detail screen shows its error state with
 * a retry — but reports the failing fields exactly as a list row would.
 */
function parseMessageStrict(item: unknown, source: string): Message {
  const result = MessageSchema.safeParse(item);
  if (result.success) return result.data;
  console.error('[inbox] message failed schema validation', {
    source,
    id: readString(item, '_id'),
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  });
  recordInboxMetric('message_parse_failed');
  throw result.error;
}

/** Long enough for a synchronous SMTP relay; see `sendMessage`. */
/** The most message ids one bulk request may carry (`bulk*Schema` in the API). */
export const BULK_LIMIT = 100;

const BulkResultSchema = z.object({ matched: z.number(), modified: z.number() });

async function inBatches(
  ids: string[],
  run: (batch: string[]) => Promise<{ matched: number; modified: number }>,
): Promise<{ matched: number; modified: number }> {
  const total = { matched: 0, modified: 0 };
  for (const batch of chunk(ids, BULK_LIMIT)) {
    const result = await run(batch);
    total.matched += result.matched;
    total.modified += result.modified;
  }
  return total;
}

const SEND_TIMEOUT_MS = 60_000;

// ─── API Client ────────────────────────────────────────────────────

/**
 * What a read is bound to. React Query passes the `signal` of the query that
 * asked, and aborts it when the answer is no longer wanted — a superseded
 * refetch, a list scrolled away from, a search retyped. Without it every
 * cancelled read still ran to completion over the network.
 */
export interface ReadScope {
  signal?: AbortSignal;
}

export function createEmailApi(http: HttpService) {
  return {
    // ─── Mailboxes ──────────────────────────────────────────────────

    async listMailboxes({ signal }: ReadScope = {}): Promise<Mailbox[]> {
      const res = await http.get('/email/mailboxes', { signal });
      return z.array(MailboxSchema).parse(res);
    },

    async createMailbox(name: string, parentPath?: string): Promise<Mailbox> {
      const res = await http.post('/email/mailboxes', { name, parentPath });
      return MailboxSchema.parse(res);
    },

    async deleteMailbox(mailboxId: string): Promise<void> {
      await http.delete(`/email/mailboxes/${mailboxId}`);
    },

    // ─── Messages ───────────────────────────────────────────────────

    async listMessages(
      options: {
        mailboxId?: string;
        starred?: boolean;
        label?: string;
        limit?: number;
        offset?: number;
        cursor?: string;
        unseenOnly?: boolean;
      } = {},
      { signal }: ReadScope = {},
    ): Promise<{ data: Message[]; unreadable: UnreadableMessage[]; pagination: Pagination }> {
      const params: Record<string, string> = {};
      if (options.mailboxId) params.mailbox = options.mailboxId;
      if (options.starred) params.starred = 'true';
      if (options.label) params.label = options.label;
      if (options.limit !== undefined) params.limit = String(options.limit);
      if (options.offset !== undefined) params.offset = String(options.offset);
      if (options.cursor !== undefined) params.cursor = options.cursor;
      if (options.unseenOnly) params.unseen = 'true';

      const res = (await http.get('/email/messages', {
        params,
        signal,
      })) as PaginatedResult<unknown>;
      const { messages, unreadable } = parseMessageList(res.data, 'list');
      return {
        data: messages,
        unreadable,
        pagination: PaginationSchema.parse(res.pagination),
      };
    },

    async getMessage(messageId: string, { signal }: ReadScope = {}): Promise<Message> {
      const res = await http.get(`/email/messages/${messageId}`, { signal });
      return parseMessageStrict(res, 'detail');
    },

    async getThread(messageId: string, { signal }: ReadScope = {}): Promise<ThreadData> {
      const res = await http.get(`/email/messages/${messageId}/thread`, { signal });
      return parseMessageList(res, 'thread');
    },

    async updateFlags(messageId: string, flags: Partial<MessageFlags>): Promise<Message> {
      const res = await http.put(`/email/messages/${messageId}/flags`, { flags });
      return MessageSchema.parse(res);
    },

    async updateLabels(messageId: string, add: string[], remove: string[]): Promise<Message> {
      const res = await http.put(`/email/messages/${messageId}/labels`, { add, remove });
      return MessageSchema.parse(res);
    },

    async moveMessage(messageId: string, mailboxId: string): Promise<Message> {
      const res = await http.post(`/email/messages/${messageId}/move`, { mailboxId });
      return MessageSchema.parse(res);
    },

    async snoozeMessage(messageId: string, until: string): Promise<Message> {
      const res = await http.post(`/email/messages/${messageId}/snooze`, { until });
      return MessageSchema.parse(res);
    },

    async unsnoozeMessage(messageId: string): Promise<Message> {
      const res = await http.post(`/email/messages/${messageId}/unsnooze`);
      return MessageSchema.parse(res);
    },

    async deleteMessage(messageId: string, permanent = false): Promise<void> {
      const params = permanent ? '?permanent=true' : '';
      await http.delete(`/email/messages/${messageId}${params}`);
    },

    // ─── Bulk Operations ──────────────────────────────────────────────

    // The API takes at most BULK_LIMIT ids per request, and one conversation
    // can hold more than that: a selection or a long thread is sent in batches,
    // one after another. Both operations set state, so a batch that is repeated
    // after a partial failure does no harm.
    async bulkUpdateFlags(
      messageIds: string[],
      flags: Partial<MessageFlags>,
    ): Promise<{ matched: number; modified: number }> {
      return inBatches(messageIds, async (batch) => {
        const res = await http.post('/email/messages/bulk/flags', { messageIds: batch, flags });
        return BulkResultSchema.parse(res);
      });
    },

    async bulkMoveMessages(
      messageIds: string[],
      mailboxId: string,
    ): Promise<{ matched: number; modified: number }> {
      return inBatches(messageIds, async (batch) => {
        const res = await http.post('/email/messages/bulk/move', { messageIds: batch, mailboxId });
        return BulkResultSchema.parse(res);
      });
    },

    // ─── Labels ─────────────────────────────────────────────────────

    async listLabels(): Promise<Label[]> {
      const res = await http.get('/email/labels');
      return z.array(LabelSchema).parse(res);
    },

    async createLabel(name: string, color: string): Promise<Label> {
      const res = await http.post('/email/labels', { name, color });
      return LabelSchema.parse(res);
    },

    async updateLabel(labelId: string, updates: { name?: string; color?: string }): Promise<Label> {
      const res = await http.put(`/email/labels/${labelId}`, updates);
      return LabelSchema.parse(res);
    },

    async deleteLabel(labelId: string): Promise<void> {
      await http.delete(`/email/labels/${labelId}`);
    },

    // ─── Compose ────────────────────────────────────────────────────

    async sendMessage(message: {
      to: RecipientInput[];
      cc?: RecipientInput[];
      bcc?: RecipientInput[];
      subject: string;
      text?: string;
      html?: string;
      inReplyTo?: string;
      references?: string[];
      attachments?: { fileId: string; contentId?: string; isInline?: boolean }[];
      scheduledAt?: string;
      /**
       * Row id of the draft this message was composed from. The API removes the
       * draft once the message is sent or scheduled.
       */
      draftId?: string;
      /** Required: one per compose session, see `utils/sendIdempotency.ts`. */
      idempotencyKey: string;
    }): Promise<{ messageId: string; queued?: boolean; scheduledAt?: string; message: string }> {
      const { idempotencyKey, ...payload } = message;
      const res = await http.post('/email/messages', payload, {
        headers: { 'Idempotency-Key': idempotencyKey },
        cache: false,
        // The API relays synchronously; the SDK's 5 s default cut a slow relay
        // off mid-send, the composer reopened, and the user sent it again.
        timeout: SEND_TIMEOUT_MS,
        // Safe only because the key makes a repeat the same message.
        retry: true,
      });
      return z
        .object({
          messageId: z.string(),
          queued: z.boolean().optional(),
          scheduledAt: z.string().optional(),
          message: z.string(),
        })
        .parse(res);
    },

    async saveDraft(draft: {
      to?: RecipientInput[];
      cc?: RecipientInput[];
      bcc?: RecipientInput[];
      subject?: string;
      text?: string;
      html?: string;
      inReplyTo?: string;
      references?: string[];
      attachments?: { fileId: string; contentId?: string; isInline?: boolean }[];
      existingDraftId?: string;
      expectedRevision?: number;
    }): Promise<Message> {
      const res = await http.post('/email/drafts', draft);
      return MessageSchema.parse(res);
    },

    // ─── Durable outbound delivery ─────────────────────────────────

    async listOutboundMessages(options: { limit?: number } = {}): Promise<EmailOutbox[]> {
      const res = await http.get('/email/outbox', {
        params: options.limit === undefined ? undefined : { limit: String(options.limit) },
      });
      return z.array(EmailOutboxSchema).parse(res);
    },

    async retryOutboundMessage(outboxId: string): Promise<EmailOutbox> {
      const res = await http.post(`/email/outbox/${outboxId}/retry`);
      return EmailOutboxSchema.parse(res);
    },

    async cancelOutboundMessage(outboxId: string): Promise<EmailOutbox> {
      const res = await http.post(`/email/outbox/${outboxId}/cancel`);
      return EmailOutboxSchema.parse(res);
    },

    // ─── Search ─────────────────────────────────────────────────────

    async search(
      options: EmailSearchOptions = {},
      { signal }: ReadScope = {},
    ): Promise<{ data: Message[]; unreadable: UnreadableMessage[]; pagination: Pagination }> {
      const params: Record<string, string> = {};
      const readStateOperator =
        options.unread === undefined ? undefined : options.unread ? 'is:unread' : 'is:read';
      const query = [readStateOperator, options.q].filter(Boolean).join(' ');
      if (query) params.q = query;
      if (options.from) params.from = options.from;
      if (options.to) params.to = options.to;
      if (options.subject) params.subject = options.subject;
      if (options.hasAttachment) params.hasAttachment = 'true';
      if (options.dateAfter) params.dateAfter = options.dateAfter;
      if (options.dateBefore) params.dateBefore = options.dateBefore;
      if (options.mailbox) params.mailbox = options.mailbox;
      if (options.starred) params.starred = 'true';
      if (options.label) params.label = options.label;
      if (options.limit !== undefined) params.limit = String(options.limit);
      if (options.offset !== undefined) params.offset = String(options.offset);
      if (options.cursor !== undefined) params.cursor = options.cursor;

      const res = (await http.get('/email/search', { params, signal })) as PaginatedResult<unknown>;
      const { messages, unreadable } = parseMessageList(res.data, 'search');
      return {
        data: messages,
        unreadable,
        pagination: PaginationSchema.parse(res.pagination),
      };
    },

    async listSavedSearches(): Promise<SavedEmailSearch[]> {
      const res = await http.get('/email/saved-searches');
      return z.array(SavedEmailSearchSchema).parse(res);
    },

    async createSavedSearch(data: {
      name: string;
      query: string;
      filters: SavedEmailSearchFilters;
      order?: number;
    }): Promise<SavedEmailSearch> {
      const res = await http.post('/email/saved-searches', data);
      return SavedEmailSearchSchema.parse(res);
    },

    async deleteSavedSearch(savedSearchId: string): Promise<void> {
      await http.delete(`/email/saved-searches/${savedSearchId}`);
    },

    // ─── Quota ──────────────────────────────────────────────────────

    async getQuota(): Promise<QuotaUsage> {
      const res = await http.get('/email/quota');
      return QuotaUsageSchema.parse(res);
    },

    // ─── Settings ───────────────────────────────────────────────────

    async getSettings(): Promise<EmailSettings> {
      const res = await http.get('/email/settings');
      return EmailSettingsSchema.parse(res);
    },

    async updateSettings(settings: {
      signature?: string;
      autoReply?: Partial<EmailSettings['autoReply']>;
      autoForwardTo?: string;
      autoForwardKeepCopy?: boolean;
    }): Promise<void> {
      await http.put('/email/settings', settings);
    },

    // ─── Subscriptions ───────────────────────────────────────────────

    async listSubscriptions(
      options: { limit?: number; offset?: number } = {},
    ): Promise<{ data: Subscription[]; pagination: Pagination }> {
      const params: Record<string, string> = {};
      if (options.limit !== undefined) params.limit = String(options.limit);
      if (options.offset !== undefined) params.offset = String(options.offset);

      const res = (await http.get('/email/subscriptions', {
        params,
      })) as PaginatedResult<Subscription>;
      return {
        data: z.array(SubscriptionSchema).parse(res.data),
        pagination: PaginationSchema.parse(res.pagination),
      };
    },

    async unsubscribe(
      senderAddress: string,
      method?: 'list-unsubscribe' | 'block',
    ): Promise<UnsubscribeResult> {
      const res = await http.post('/email/subscriptions/unsubscribe', {
        senderAddress,
        method,
      });
      return UnsubscribeResultSchema.parse(res);
    },

    // ─── Bundles ────────────────────────────────────────────────────

    async listBundles(): Promise<Bundle[]> {
      const res = await http.get('/email/bundles');
      return z.array(BundleSchema).parse(res);
    },

    async updateBundle(
      bundleId: string,
      updates: { enabled?: boolean; collapsed?: boolean; matchLabels?: string[]; order?: number },
    ): Promise<Bundle> {
      const res = await http.put(`/email/bundles/${bundleId}`, updates);
      return BundleSchema.parse(res);
    },

    async listBundledMessages(
      options: { mailboxId?: string; limit?: number; offset?: number } = {},
    ): Promise<BundledMessages> {
      const params: Record<string, string> = {};
      if (options.mailboxId) params.mailbox = options.mailboxId;
      if (options.limit !== undefined) params.limit = String(options.limit);
      if (options.offset !== undefined) params.offset = String(options.offset);

      const res = (await http.get('/email/messages/bundled', { params })) as {
        data: {
          primary: unknown[];
          bundles: { bundle: unknown; messages: unknown[]; unreadCount: number }[];
        };
        pagination: Pagination;
      };
      const primary = parseMessageList(res.data.primary, 'bundles.primary');
      return {
        primary: primary.messages,
        primaryUnreadable: primary.unreadable,
        bundles: res.data.bundles.map((b) => {
          const { messages, unreadable } = parseMessageList(b.messages, 'bundles.bundle');
          // `unreadCount` is the server's count over the raw rows, so a row
          // this client cannot read is still counted there.
          return {
            bundle: BundleSchema.parse(b.bundle),
            messages,
            unreadable,
            unreadCount: b.unreadCount,
          };
        }),
        pagination: PaginationSchema.parse(res.pagination),
      };
    },

    // ─── Reminders ────────────────────────────────────────────────

    async createReminder(data: {
      text: string;
      remindAt: string;
      relatedMessageId?: string;
    }): Promise<Reminder> {
      const res = await http.post('/email/reminders', data);
      return ReminderSchema.parse(res);
    },

    async listReminders(
      options: { includeCompleted?: boolean; limit?: number; offset?: number } = {},
    ): Promise<{ data: Reminder[]; pagination: Pagination }> {
      const params: Record<string, string> = {};
      if (options.includeCompleted) params.completed = 'true';
      if (options.limit !== undefined) params.limit = String(options.limit);
      if (options.offset !== undefined) params.offset = String(options.offset);

      const res = (await http.get('/email/reminders', { params })) as PaginatedResult<Reminder>;
      return {
        data: z.array(ReminderSchema).parse(res.data),
        pagination: PaginationSchema.parse(res.pagination),
      };
    },

    async getReminder(reminderId: string): Promise<Reminder> {
      const res = await http.get(`/email/reminders/${reminderId}`);
      return ReminderSchema.parse(res);
    },

    async updateReminder(
      reminderId: string,
      updates: {
        text?: string;
        remindAt?: string;
        completed?: boolean;
        pinned?: boolean;
        snoozedUntil?: string | null;
      },
    ): Promise<Reminder> {
      const res = await http.put(`/email/reminders/${reminderId}`, updates);
      return ReminderSchema.parse(res);
    },

    async deleteReminder(reminderId: string): Promise<void> {
      await http.delete(`/email/reminders/${reminderId}`);
    },

    // ─── Contacts ────────────────────────────────────────────────────

    async suggestContacts(query: string): Promise<ContactSuggestion[]> {
      const res = await http.get('/email/contacts/suggest', {
        params: { q: query },
      });
      const parsed = z.object({ data: z.array(ContactSuggestionSchema) }).parse(res);
      return parsed.data;
    },

    async listContacts(
      options: { q?: string; starred?: boolean; limit?: number; offset?: number } = {},
    ): Promise<{ data: Contact[]; pagination: Pagination }> {
      const params: Record<string, string> = {};
      if (options.q) params.q = options.q;
      if (options.starred) params.starred = 'true';
      if (options.limit !== undefined) params.limit = String(options.limit);
      if (options.offset !== undefined) params.offset = String(options.offset);

      const res = (await http.get('/email/contacts', { params })) as PaginatedResult<Contact>;
      return {
        data: z.array(ContactSchema).parse(res.data),
        pagination: PaginationSchema.parse(res.pagination),
      };
    },

    async createContact(data: {
      name: string;
      email: string;
      company?: string;
      notes?: string;
      starred?: boolean;
    }): Promise<Contact> {
      const res = await http.post('/email/contacts', data);
      return ContactSchema.parse(res);
    },

    async updateContact(
      contactId: string,
      updates: {
        name?: string;
        email?: string;
        company?: string;
        notes?: string;
        starred?: boolean;
      },
    ): Promise<Contact> {
      const res = await http.put(`/email/contacts/${contactId}`, updates);
      return ContactSchema.parse(res);
    },

    async deleteContact(contactId: string): Promise<void> {
      await http.delete(`/email/contacts/${contactId}`);
    },

    // ─── Templates ────────────────────────────────────────────────────

    async listTemplates(): Promise<EmailTemplate[]> {
      const res = await http.get('/email/templates');
      return z.array(EmailTemplateSchema).parse(res);
    },

    async createTemplate(data: {
      name: string;
      subject?: string;
      body: string;
    }): Promise<EmailTemplate> {
      const res = await http.post('/email/templates', data);
      return EmailTemplateSchema.parse(res);
    },

    async updateTemplate(
      templateId: string,
      updates: { name?: string; subject?: string; body?: string },
    ): Promise<EmailTemplate> {
      const res = await http.put(`/email/templates/${templateId}`, updates);
      return EmailTemplateSchema.parse(res);
    },

    async deleteTemplate(templateId: string): Promise<void> {
      await http.delete(`/email/templates/${templateId}`);
    },

    // ─── Filters ─────────────────────────────────────────────────────

    async listFilters(): Promise<EmailFilter[]> {
      const res = await http.get('/email/filters');
      return z.array(EmailFilterSchema).parse(res);
    },

    async createFilter(data: {
      name: string;
      enabled?: boolean;
      conditions: EmailFilterCondition[];
      matchAll?: boolean;
      actions: EmailFilterAction[];
      order?: number;
    }): Promise<EmailFilter> {
      const res = await http.post('/email/filters', data);
      return EmailFilterSchema.parse(res);
    },

    async updateFilter(
      filterId: string,
      updates: {
        name?: string;
        enabled?: boolean;
        conditions?: EmailFilterCondition[];
        matchAll?: boolean;
        actions?: EmailFilterAction[];
        order?: number;
      },
    ): Promise<EmailFilter> {
      const res = await http.put(`/email/filters/${filterId}`, updates);
      return EmailFilterSchema.parse(res);
    },

    async deleteFilter(filterId: string): Promise<void> {
      await http.delete(`/email/filters/${filterId}`);
    },

    // ─── Import / Export ────────────────────────────────────────────

    /**
     * Export a message as .eml file. Returns the raw content as a string.
     * The caller is responsible for triggering the download.
     */
    async exportMessage(messageId: string): Promise<{ content: string; filename: string }> {
      // The export endpoint responds with `message/rfc822`; HttpService returns
      // non-JSON content types as raw text.
      const res = await http.get<string>(`/email/messages/${messageId}/export`, {
        headers: { Accept: 'message/rfc822' },
      });
      return {
        content: res,
        filename: 'message.eml',
      };
    },

    /**
     * Import .eml files. Returns the count of successfully imported messages.
     */
    async importMessages(files: File[]): Promise<{ imported: number; total: number }> {
      const formData = new FormData();
      for (const file of files) {
        formData.append('files', file, file.name);
      }
      const res = await http.post('/email/import', formData);
      return z.object({ imported: z.number(), total: z.number() }).parse(res);
    },
  };
}

export type EmailApiInstance = ReturnType<typeof createEmailApi>;
