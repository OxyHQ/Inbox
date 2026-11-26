/**
 * Mailbox special-use constants.
 * Maps friendly names to IMAP special-use attribute values stored in the database.
 */
export const SPECIAL_USE = {
  INBOX: '\\Inbox',
  SENT: '\\Sent',
  DRAFTS: '\\Drafts',
  TRASH: '\\Trash',
  SPAM: '\\Junk',
  ARCHIVE: '\\Archive',
  SNOOZED: '\\Snoozed',
} as const;
