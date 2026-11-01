/**
 * The composer body as its editor holds it. On the web that editor is a
 * contentEditable whose value is its innerHTML, and plain text written into it
 * as-is lost every line break: the signature glued itself to the last line and
 * a quoted reply became one paragraph.
 */

import {
  appendTextToBody,
  bodyParts,
  draftToEditorContent,
  editorDomValue,
  forwardedAttachments,
  forwardedBody,
  isBodyBlank,
  quotedReply,
  sanitizeEditorHtml,
  signatureBlock,
  textToEditorContent,
} from '@/utils/composeBody';

describe('plain text into the web editor', () => {
  it('keeps line breaks and escapes markup', () => {
    expect(textToEditorContent('Hi <b>you</b>\nBye & thanks', true)).toBe(
      'Hi &lt;b&gt;you&lt;/b&gt;<br>Bye &amp; thanks',
    );
  });

  it('is left alone on native, where the editor is plain text', () => {
    expect(textToEditorContent('a\nb', false)).toBe('a\nb');
  });

  it('writes the signature on its own lines', () => {
    expect(signatureBlock('Jane\nOxy', true)).toBe('<br><br>--<br>Jane<br>Oxy');
    expect(signatureBlock('Jane', false)).toBe('\n\n--\nJane');
  });

  it('appends on a new line, or replaces a blank body', () => {
    expect(appendTextToBody('', 'Hello', true)).toBe('Hello');
    expect(appendTextToBody('<div>Hi</div>', 'Hello', true)).toBe('<div>Hi</div><br>Hello');
    expect(appendTextToBody('Hi', 'Hello', false)).toBe('Hi\nHello');
  });
});

describe('what the web editor reports', () => {
  it('is empty only for a DOM that holds nothing', () => {
    expect(editorDomValue('', '')).toBe('');
    expect(editorDomValue('<br>', '')).toBe('');
  });

  it('keeps the blank lines and the leading spaces the user typed', () => {
    expect(editorDomValue('<div><br></div><div><br></div>', '')).toBe(
      '<div><br></div><div><br></div>',
    );
    expect(editorDomValue('&nbsp;', '\u00a0')).toBe('&nbsp;');
    expect(editorDomValue(' ', ' ')).toBe(' ');
    expect(editorDomValue('<img src="x">', '')).toBe('<img src="x">');
  });
});

describe('a body that holds only the signature', () => {
  it('is blank, so it is neither autosaved nor asked about on close', () => {
    const signature = signatureBlock('Jane', false);
    expect(isBodyBlank(signature, signature, false)).toBe(true);
    expect(isBodyBlank('   ', null, false)).toBe(true);
    expect(isBodyBlank(`Hello${signature}`, signature, false)).toBe(false);
  });
});

describe('quotes', () => {
  it('quotes a reply with `> ` on native', () => {
    expect(quotedReply({ text: 'one\ntwo' }, 'On Mon, Ann wrote:', false)).toBe(
      '\n\nOn Mon, Ann wrote:\n> one\n> two',
    );
  });

  it('quotes a reply as an escaped cite blockquote on the web, built from text only', () => {
    const html = quotedReply(
      { text: '<img src=x onerror=alert(1)>\nline' },
      'On Mon, Ann wrote:',
      true,
    );
    expect(html).toBe(
      '<br><br><div>On Mon, Ann wrote:</div><blockquote type="cite">&lt;img src=x onerror=alert(1)&gt;<br>line</blockquote>',
    );
  });
});

describe('mail sent as HTML alone', () => {
  const htmlOnly = { text: null, html: '<p>Hi Ann</p><p>The <b>plan</b> is ready.</p>' };

  it('is quoted from its HTML as text, not left empty', () => {
    expect(quotedReply(htmlOnly, 'On Mon, Ann wrote:', false)).toBe(
      '\n\nOn Mon, Ann wrote:\n> Hi Ann\n> \n> The plan is ready.',
    );
    expect(quotedReply(htmlOnly, 'On Mon, Ann wrote:', true)).toBe(
      '<br><br><div>On Mon, Ann wrote:</div><blockquote type="cite">Hi Ann<br><br>The plan is ready.</blockquote>',
    );
  });

  it('is forwarded with its body, never as live markup', () => {
    expect(forwardedBody(htmlOnly, 'Forwarded:\n', false)).toBe(
      'Forwarded:\nHi Ann\n\nThe plan is ready.',
    );
    expect(
      forwardedBody({ text: null, html: '<img src=x onerror=alert(1)>&lt;b&gt;' }, '', true),
    ).toBe('&lt;b&gt;');
  });
});

describe('a forward', () => {
  const file = (overrides: Record<string, unknown>) => ({
    fileId: 'f1',
    name: 'plan.pdf',
    contentType: 'application/pdf',
    size: 2048,
    contentId: null,
    isInline: false,
    ...overrides,
  });

  it('carries the files the reader lists, not the inline images of its HTML', () => {
    const attachments = [
      file({}),
      file({ fileId: 'logo', name: 'logo.png', contentId: '<logo@x>', isInline: true }),
    ];
    expect(forwardedAttachments({ html: '<img src="cid:logo@x">', attachments })).toEqual([
      { fileId: 'f1', name: 'plan.pdf', contentType: 'application/pdf', size: 2048 },
    ]);
    // Without an HTML body the image has nowhere else to go: it is a file.
    expect(forwardedAttachments({ html: null, attachments }).map((a) => a.fileId)).toEqual([
      'f1',
      'logo',
    ]);
  });
});

describe('reopening a draft', () => {
  it('drops anything that would script or restyle the page', () => {
    const clean = sanitizeEditorHtml(
      '<html><head><style>body{display:none}</style></head><body><p onclick="x()">Hi</p><script>alert(1)</script><img src="javascript:alert(1)"></body></html>',
    );
    expect(clean).not.toMatch(/style|script|onclick|javascript/i);
    expect(clean).toContain('<p>Hi</p>');
  });

  it('opens the html part on the web and the text part on native', () => {
    const draft = { html: '<p>Hi</p>', text: 'Hi' };
    expect(draftToEditorContent(draft, true)).toBe('<p>Hi</p>');
    expect(draftToEditorContent(draft, false)).toBe('Hi');
    expect(draftToEditorContent({ html: null, text: 'a\nb' }, true)).toBe('a<br>b');
  });
});

describe('what is sent', () => {
  it('sends text and html on the web, text only on native', () => {
    expect(bodyParts('Hi<br>there', false)).toEqual({ text: 'Hi<br>there' });
    expect(bodyParts('', true)).toEqual({ text: undefined, html: undefined });
  });
});

describe('preformatted content in outgoing plain text', () => {
  it('preserves spaces and consecutive blank lines in the preformatted body', () => {
    const html = '<pre>first  \n\n\n  second\t\nthird</pre>';
    expect(bodyParts(html, true)).toEqual({ text: 'first  \n\n\n  second\t\nthird', html });
  });
});

describe('preformatted plain-text boundaries', () => {
  it('preserves whitespace across inline tags and explicit line breaks', () => {
    const html = '<pre><code>first  </code><br><br><br>  second\t</pre>';
    expect(bodyParts(html, true).text).toBe('first  \n\n\n  second\t');
  });
  it('keeps surrounding paragraph formatting and text from a pre block', () => {
    const html = '<p>Before</p><pre>one\n\n\ntwo</pre><p>After</p>';
    expect(bodyParts(html, true).text).toBe('Before\n\none\n\n\ntwo\n\nAfter');
  });
  it('preserves preformatted spacing inside a quoted block', () => {
    const html = '<blockquote><pre>first  \n\n\nsecond</pre></blockquote>';
    expect(bodyParts(html, true).text).toBe('> first  \n>\n>\n> second');
  });
  it('ignores the first newline immediately after pre and preserves trailing newlines', () => {
    const html = '<pre>\nfirst\n\n</pre>';
    expect(bodyParts(html, true).text).toBe('first\n\n');
  });
});

it('keeps non-breaking spaces and tabs inside preformatted text', () => {
  expect(bodyParts('<pre>a&nbsp;\tb</pre>', true).text).toBe('a\u00a0\tb');
});

it('keeps preformatted text when reopening an HTML-only native draft', () => {
  expect(draftToEditorContent({ html: '<pre>one  \n\n\ntwo</pre>', text: null }, false)).toBe(
    'one  \n\n\ntwo',
  );
});

it('handles long preformatted whitespace followed by text without changing it', () => {
  const text = `${' '.repeat(200_000)}x`;
  expect(bodyParts(`<pre>${text}</pre>`, true).text).toBe(text);
});

describe('numbered lists in plain-text bodies', () => {
  it('keeps the starting number of a list', () => {
    const html = '<ol start="5"><li>Fifth</li><li>Sixth</li></ol>';
    expect(bodyParts(html, true)).toEqual({ text: '5. Fifth\n6. Sixth', html });
  });
});

it('keeps explicit item values and continues from them', () => {
  expect(bodyParts('<ol start="5"><li>A</li><li value="12">B</li><li>C</li></ol>', true).text).toBe(
    '5. A\n12. B\n13. C',
  );
});

it('handles reversed lists, explicit starts and item values', () => {
  expect(bodyParts('<ol reversed><li>A</li><li>B</li><li>C</li></ol>', true).text).toBe(
    '3. A\n2. B\n1. C',
  );
  expect(
    bodyParts('<ol reversed start="8"><li>A</li><li value="3">B</li><li>C</li></ol>', true).text,
  ).toBe('8. A\n3. B\n2. C');
});

it('treats nested numbered lists independently and ignores invalid integer attributes', () => {
  expect(
    bodyParts(
      '<ol start="bad"><li>A<ol start="7"><li>Inner</li></ol></li><li value="bad">B</li></ol>',
      true,
    ).text,
  ).toBe('1. A\n7. Inner\n2. B');
});

it('accepts zero, negative and HTML integer prefixes', () => {
  expect(
    bodyParts('<ol start="  -2tail"><li>A</li><li value="+0x">B</li><li>C</li></ol>', true).text,
  ).toBe('-2. A\n0. B\n1. C');
});

it('uses explicit numbering when reopening an HTML-only native draft', () => {
  expect(
    draftToEditorContent({ html: '<ol start="5"><li>A</li><li>B</li></ol>', text: null }, false),
  ).toBe('5. A\n6. B');
});

it('continues the ordinary sequence for item values that have no integer prefix', () => {
  expect(bodyParts('<ol><li>A</li><li value="+ 3">B</li><li>C</li></ol>', true).text).toBe(
    '1. A\n2. B\n3. C',
  );
});

describe('HTML pre initial line-feed parsing', () => {
  it.each([
    ['<pre>\nA</pre>', 'A'],
    ['<pre>\r\nA</pre>', 'A'],
    ['<pre>\rA</pre>', 'A'],
    ['<pre>&#10;A</pre>', 'A'],
    ['<pre>\n\nA</pre>', '\nA'],
    ['<pre><!--comment-->\nA</pre>', '\nA'],
    ['<pre><code>\nA</code></pre>', '\nA'],
    ['<pre>&#13;A</pre>', '\rA'],
    ['<pre>\r&#10;A</pre>', '\nA'],
    ['<pre>\r\n\nA</pre>', '\nA'],
    ['<pre>&#13;&#10;A</pre>', '\r\nA'],
    ['<pre>\n<code>\nA</code></pre>', '\nA'],
  ])('converts %s to its parsed text', (html, expected) => {
    expect(bodyParts(html, true).text).toBe(expected);
    expect(draftToEditorContent({ html, text: null }, false)).toBe(expected);
  });
});
describe('explicit blank lines in plain-text bodies', () => {
  it('keeps consecutive explicit breaks between text', () => {
    const html = 'A<br><br><br>B';
    expect(bodyParts(html, true)).toEqual({ text: 'A\n\n\nB', html });
  });
  it('keeps multiple explicit breaks when reopening an HTML-only native draft', () => {
    expect(draftToEditorContent({ html: 'A<br><br><br>B', text: null }, false)).toBe('A\n\n\nB');
  });
});

it('preserves explicit breaks in quoted text and preformatted text', () => {
  expect(bodyParts('<blockquote>A<br><br><br>B</blockquote>', true).text).toBe('> A\n>\n>\n> B');
  expect(bodyParts('<pre>A<br><br><br>B</pre>', true).text).toBe('A\n\n\nB');
});

it('preserves a long run of explicit breaks without changing its length', () => {
  const breaks = '<br>'.repeat(1000);
  expect(bodyParts(`A${breaks}B`, true).text).toBe(`A${'\n'.repeat(1000)}B`);
});

it('keeps existing outer-boundary and paragraph normalization', () => {
  expect(bodyParts('<br><br>A<br><br>', true).text).toBe('A');
  expect(bodyParts('<p>A</p><p>B</p>', true).text).toBe('A\n\nB');
});
