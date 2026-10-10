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
    const html = quotedReply({ text: '<img src=x onerror=alert(1)>\nline' }, 'On Mon, Ann wrote:', true);
    expect(html).toBe(
      '<br><br><div>On Mon, Ann wrote:</div><blockquote type="cite">&lt;img src=x onerror=alert(1)&gt;<br>line</blockquote>',
    );
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
