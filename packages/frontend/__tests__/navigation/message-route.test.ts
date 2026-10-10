/**
 * A draft opens in the composer. It used to open read-only in the conversation
 * view, whose only actions were Reply and Forward, so a saved draft could not
 * be sent.
 */

import { messageRoute } from '@/utils/messageRoute';

const flags = { seen: true, starred: false, answered: false, forwarded: false, pinned: false };

describe('messageRoute', () => {
  it('opens a draft in the composer by its id', () => {
    expect(messageRoute({ _id: 'd1', flags: { ...flags, draft: true } })).toEqual({
      pathname: '/compose',
      params: { draftId: 'd1' },
    });
  });

  it('opens anything else as a conversation', () => {
    expect(messageRoute({ _id: 'm1', flags: { ...flags, draft: false } })).toEqual({
      pathname: '/conversation/[id]',
      params: { id: 'm1' },
    });
    expect(
      messageRoute({ _id: 'm1', flags: { ...flags, draft: false } }, '/search/conversation/[id]'),
    ).toEqual({ pathname: '/search/conversation/[id]', params: { id: 'm1' } });
  });
});
