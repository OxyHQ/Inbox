import { buildReplyRecipients, isOwnAddress } from '@/utils/replyRecipients';

const me = { username: 'nate', email: 'nate@oxy.so' };
const addresses = (list: { address: string }[]) => list.map((a) => a.address);

describe('isOwnAddress', () => {
  it('matches the primary address, the account email and plus-addresses, case-insensitively', () => {
    expect(isOwnAddress('Nate@Oxy.so', me)).toBe(true);
    expect(isOwnAddress('nate+receipts@oxy.so', me)).toBe(true);
    expect(isOwnAddress('me@elsewhere.com', { username: 'nate', email: 'me@elsewhere.com' })).toBe(
      true,
    );
    expect(isOwnAddress('nathan@oxy.so', me)).toBe(false);
    expect(isOwnAddress('nate@other.com', me)).toBe(false);
  });
});

describe('buildReplyRecipients', () => {
  const incoming = {
    from: { name: 'AWS', address: 'support@amazon.com' },
    to: [{ address: 'nate@oxy.so' }, { address: 'ops@example.com' }],
    cc: [
      { address: 'NATE@oxy.so' },
      { address: 'finance@example.com' },
      { address: 'ops@example.com' },
    ],
  };

  it('replies to the sender only', () => {
    const r = buildReplyRecipients(incoming, 'reply', me);
    expect(addresses(r.to)).toEqual(['support@amazon.com']);
    expect(r.cc).toEqual([]);
  });

  it('honours Reply-To', () => {
    const r = buildReplyRecipients(
      { ...incoming, replyTo: { address: 'cases@amazon.com' } },
      'reply',
      me,
    );
    expect(addresses(r.to)).toEqual(['cases@amazon.com']);
  });

  it('reply-all never includes the user and never repeats an address', () => {
    const r = buildReplyRecipients(incoming, 'reply-all', me);
    expect(addresses(r.to)).toEqual(['support@amazon.com', 'ops@example.com']);
    expect(addresses(r.cc)).toEqual(['finance@example.com']);
  });

  it("replying to the user's own message goes to that message's recipients", () => {
    const sent = {
      from: { address: 'nate@oxy.so' },
      to: [{ address: 'support@amazon.com' }],
      cc: [{ address: 'finance@example.com' }, { address: 'nate+cc@oxy.so' }],
    };
    expect(addresses(buildReplyRecipients(sent, 'reply', me).to)).toEqual(['support@amazon.com']);
    const all = buildReplyRecipients(sent, 'reply-all', me);
    expect(addresses(all.to)).toEqual(['support@amazon.com']);
    expect(addresses(all.cc)).toEqual(['finance@example.com']);
  });
});
