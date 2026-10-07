import { splitHtmlQuote, splitTextQuote } from '@/utils/messageQuotes';

const attribution = 'On Tue, Oct 6, 2026 at 12:37 AM UTC, Nate <nate@oxy.so> wrote:';

it('folds the reply attribution with the quoted plain text', () => {
  expect(splitTextQuote(`My answer\n\n${attribution}\n> Earlier email`)).toEqual({
    body: 'My answer', quoted: `${attribution}\n> Earlier email`,
  });
});

it('preserves unquoted inline answers and leaves ordinary prose alone', () => {
  const parts = splitTextQuote(`${attribution}\n> First question\nMy inline answer\n> Second question`);
  expect(parts.body).toBe('My inline answer');
  expect(parts.quoted).toContain('Second question');
  expect(splitTextQuote('On Tuesday we wrote:\nThe release notes')).toEqual({ body: 'On Tuesday we wrote:\nThe release notes' });
});

it('recognizes wrapped localized attributions and unprefixed quote text', () => {
  const parts = splitTextQuote('Sí\nEl 6 de octubre,\nNate <nate@oxy.so> escribió:\nMensaje original');
  expect(parts.body).toBe('Sí');
  expect(parts.quoted).toContain('Mensaje original');
});

it('folds Gmail quotes while preserving original markup outside them', () => {
  const parts = splitHtmlQuote('<div style="color:red"><p>My answer</p><div class="gmail_quote"><div class="gmail_attr">On Oct 6, Nate wrote:</div><blockquote>Previous email<img src="cid:picture"></blockquote></div></div>');
  expect(parts.body).toContain('My answer');
  expect(parts.body).not.toContain('Previous email');
  expect(parts.quoted).toContain('gmail_attr');
  expect(parts.quoted).toContain('cid:picture');
  expect(parts.quoted).toContain('color:red');
});

it('folds attributed and Apple blockquotes but keeps inline replies visible', () => {
  const parts = splitHtmlQuote('<p>Reply</p><div>On Oct 6, Nate &lt;nate@oxy.so&gt; wrote:</div><br><blockquote type="cite">Old text</blockquote><p>One more answer</p>');
  expect(parts.body).toContain('One more answer');
  expect(parts.body).not.toContain('wrote:');
  expect(parts.quoted).toContain('wrote:');
  expect(parts.quoted).toContain('Old text');
  expect(parts.quoted).not.toContain('One more answer');
});

it('retains normal blockquotes, full-document styles and the Outlook original header', () => {
  const ordinary = '<blockquote>A quotation in a newsletter</blockquote>';
  expect(splitHtmlQuote(ordinary)).toEqual({ body: ordinary });
  const parts = splitHtmlQuote('<html><head><style>p{color:red}</style></head><body><p>Answer</p><div id="divRplyFwdMsg">From: Nate</div><p>Original</p></body></html>');
  expect(parts.body).toContain('p{color:red}');
  expect(parts.quoted).toContain('p{color:red}');
  expect(parts.quoted).toContain('From: Nate');
  expect(parts.quoted).toContain('Original');
  expect(parts.body).not.toContain('Original');
});

it('recognizes plaintext citations appended to HTML by mail composers', () => {
  const parts = splitHtmlQuote('<div>New answer</div>\n\nOn Oct 6, Nate wrote:\n&gt; Previous text');
  expect(parts.body).toContain('New answer');
  expect(parts.body).not.toContain('Previous text');
  expect(parts.quoted).toContain('On Oct 6, Nate wrote:');
  expect(parts.quoted).toContain('Previous text');
});
