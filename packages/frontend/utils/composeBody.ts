/**
 * The composer body, in the form its editor holds it.
 *
 * On the web the editor is a contentEditable whose value IS its innerHTML, so
 * everything written into it has to be HTML. Plain text — a signature, a
 * template, an AI suggestion, a quote — was written in as it was, and the
 * browser collapsed every line break: a signature arrived as `-- Jane Doe`
 * glued to the last line, and a quoted reply as one run-on paragraph. On
 * native the editor is a plain-text field and the body stays text.
 *
 * Plain text is ESCAPED on its way into HTML. A quote is built from the
 * original's text part, never its HTML: that HTML is someone else's markup, and
 * the editor would render it as live DOM on this origin.
 */

import { DomUtils, parseDocument } from 'htmlparser2';

import type { Message } from '@/schemas/emailSchemas';
import { sanitizeEmailHtml } from './htmlTransform';
import { stripHtml } from './stripHtml';

/** Elements that act on the whole page once they are live DOM in the editor. */
const PAGE_LEVEL_TAGS = new Set(['style', 'head', 'title', 'svg', 'math']);

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Plain text as the editor holds it: escaped HTML on the web, as-is on native. */
export function textToEditorContent(text: string, web: boolean): string {
  if (!web) return text;
  return escapeHtml(text).replace(/\r?\n/g, '<br>');
}

/** The editor's content as plain text — what the `text` part is built from. */
export function editorContentToText(content: string, web: boolean): string {
  return web ? stripHtml(content) : content;
}

/** Append plain text on a new line after whatever the body already holds. */
export function appendTextToBody(body: string, text: string, web: boolean): string {
  const addition = textToEditorContent(text, web);
  if (!editorContentToText(body, web).trim()) return addition;
  return `${body}${web ? '<br>' : '\n'}${addition}`;
}

/** The signature block a new message starts with: a blank line, `--`, the signature. */
export function signatureBlock(signature: string, web: boolean): string {
  return textToEditorContent(`\n\n--\n${signature}`, web);
}

/**
 * Whether the body holds nothing the user wrote: empty, or exactly the
 * signature the composer put there. Compared as text, because the editor may
 * re-serialize the same HTML differently.
 */
export function isBodyBlank(body: string, signature: string | null, web: boolean): boolean {
  const text = editorContentToText(body, web).trim();
  if (!text) return true;
  return signature !== null && text === editorContentToText(signature, web).trim();
}

/** Text quoted under a reply: `> ` on every line, after an attribution line. */
export function quotedReply(message: Pick<Message, 'text'>, attribution: string, web: boolean): string {
  const quoted = (message.text ?? '')
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join('\n');
  if (!web) return `\n\n${attribution}\n${quoted}`;
  // A cite blockquote after an attribution is what `splitHtmlQuote` folds, here
  // and in other clients.
  return `<br><br><div>${escapeHtml(attribution)}</div><blockquote type="cite">${textToEditorContent(message.text ?? '', true)}</blockquote>`;
}

/** The body of a forward: the header block, then the original's text. */
export function forwardedBody(message: Pick<Message, 'text'>, header: string, web: boolean): string {
  return textToEditorContent(`${header}${message.text ?? ''}`, web);
}

/**
 * HTML made safe to become the editor's live DOM. A draft's HTML is not always
 * this composer's: drafts are also written through the API and by Alia. On top
 * of what the email viewer strips (it renders inside a sandboxed frame; the
 * editor does not), anything that would style or script the page is dropped,
 * and a whole document is reduced to its body.
 */
export function sanitizeEditorHtml(html: string): string {
  const document = parseDocument(sanitizeEmailHtml(html));
  const body = DomUtils.findOne((node) => node.name.toLowerCase() === 'body', document.children);
  const nodes = body ? body.children : document.children;
  const visit = (list: typeof nodes) => {
    for (const node of [...list]) {
      if (!('attribs' in node)) continue;
      if (PAGE_LEVEL_TAGS.has(node.name.toLowerCase())) {
        DomUtils.removeElement(node);
        continue;
      }
      visit(node.children);
    }
  };
  visit(nodes);
  return DomUtils.getOuterHTML(nodes);
}

/** The editor content a saved draft is reopened with. */
export function draftToEditorContent(draft: Pick<Message, 'text' | 'html'>, web: boolean): string {
  if (web) return draft.html ? sanitizeEditorHtml(draft.html) : textToEditorContent(draft.text ?? '', true);
  return draft.text ?? (draft.html ? stripHtml(draft.html) : '');
}

/** `text` and `html` parts for a body as the editor holds it. */
export function bodyParts(content: string, web: boolean): { text?: string; html?: string } {
  if (!web) return { text: content || undefined };
  return { text: stripHtml(content) || undefined, html: content || undefined };
}
