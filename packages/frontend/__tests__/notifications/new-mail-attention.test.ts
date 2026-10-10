/**
 * One new message, one notification — whichever of the push and the realtime
 * event arrives first. And "the user is already looking at it" means the list
 * is on screen, not merely that it was the last folder browsed.
 */

let viewMode: unknown = null;
jest.mock('@/hooks/useEmail', () => ({
  useEmailStore: { getState: () => ({ viewMode }) },
}));

import { INBOX_EMAIL_PUSH_TYPE } from '@oxy.so/contracts';

import { foregroundPresentationForPush } from '@/hooks/notifications/useForegroundNotificationHandler';
import { emailMailboxIdFromPush } from '@/lib/notifications/email-push';
import {
  __resetNewMailAttention,
  claimNewMailAnnouncement,
  isLookingAtMailbox,
  noteCurrentPath,
  noteSettingsOpen,
} from '@/lib/notifications/new-mail-attention';

const push = (messageId: string, mailboxId = 'mb-inbox') => ({
  type: INBOX_EMAIL_PUSH_TYPE,
  messageId,
  mailboxId,
});

beforeEach(() => {
  viewMode = null;
  __resetNewMailAttention();
});

describe('claimNewMailAnnouncement', () => {
  it('lets the first claim through and refuses the second', () => {
    expect(claimNewMailAnnouncement('row-1')).toBe(true);
    expect(claimNewMailAnnouncement('row-1')).toBe(false);
    expect(claimNewMailAnnouncement('row-2')).toBe(true);
  });

  it('forgets a claim once it is long past, so the map cannot grow forever', () => {
    expect(claimNewMailAnnouncement('row-1', 0)).toBe(true);
    expect(claimNewMailAnnouncement('row-1', 11 * 60 * 1000)).toBe(true);
  });
});

describe('isLookingAtMailbox', () => {
  const inbox = { type: 'mailbox', mailbox: { _id: 'mb-inbox' } };

  it('is the folder on screen', () => {
    noteCurrentPath('/');
    expect(isLookingAtMailbox(inbox, 'mb-inbox')).toBe(true);
    expect(isLookingAtMailbox(inbox, 'mb-other')).toBe(false);
  });

  it('is not the last folder browsed while Search, Subscriptions or Settings is on screen', () => {
    for (const path of [
      '/search',
      '/search/conversation/x',
      '/subscriptions',
      '/settings/labels',
      '/compose',
    ]) {
      noteCurrentPath(path);
      expect(isLookingAtMailbox(inbox, 'mb-inbox')).toBe(false);
    }
  });

  it('is not the folder behind the settings modal', () => {
    noteCurrentPath('/');
    noteSettingsOpen(true);
    expect(isLookingAtMailbox(inbox, 'mb-inbox')).toBe(false);
    noteSettingsOpen(false);
    expect(isLookingAtMailbox(inbox, 'mb-inbox')).toBe(true);
  });
});

describe('foregroundPresentationForPush', () => {
  it('shows the banner for new mail the realtime event has not announced', () => {
    expect(foregroundPresentationForPush(push('row-1'))).toBe('show');
  });

  it('suppresses the banner when the realtime toast already announced the message', () => {
    claimNewMailAnnouncement('row-1');
    expect(foregroundPresentationForPush(push('row-1'))).toBe('suppress');
  });

  it('claims the message, so the realtime event arriving later stays quiet', () => {
    foregroundPresentationForPush(push('row-1'));
    expect(claimNewMailAnnouncement('row-1')).toBe(false);
  });

  it('suppresses the banner when the user is looking at the folder it landed in', () => {
    viewMode = { type: 'mailbox', mailbox: { _id: 'mb-inbox' } };
    noteCurrentPath('/');
    expect(foregroundPresentationForPush(push('row-1', 'mb-inbox'))).toBe('suppress');
  });

  it('suppresses anything that is not an Inbox mail push', () => {
    expect(foregroundPresentationForPush({ type: 'other', messageId: 'row-1' })).toBe('suppress');
    expect(foregroundPresentationForPush(null)).toBe('suppress');
  });
});

describe('emailMailboxIdFromPush', () => {
  it('reads the mailbox of a valid mail push only', () => {
    expect(emailMailboxIdFromPush(push('row-1', 'mb-7'))).toBe('mb-7');
    expect(emailMailboxIdFromPush({ messageId: 'row-1', mailboxId: 'mb-7' })).toBeNull();
    expect(emailMailboxIdFromPush({ type: INBOX_EMAIL_PUSH_TYPE, messageId: 'row-1' })).toBeNull();
  });
});
