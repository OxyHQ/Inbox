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
