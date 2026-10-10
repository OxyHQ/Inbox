/**
 * HTML as the plain text a mail client shows for it: the `text` part of what
 * the web composer sends, and the body a native composer reopens a draft
 * written on the web with.
 *
 * Line structure is the point. A `<br>`, a block element and a list item each
 * end a line, and a blockquote is quoted with `> `. Reading `textContent`
 * instead glued every line together — `Hi Ann<br><br>Thanks` went out as
 * `Hi AnnThanks`.
 *
 * Parsed with htmlparser2 on every platform: the markup never becomes DOM, so
 * an `<img onerror>` in a draft cannot run while it is converted.
 */

import { parseDocument } from 'htmlparser2';

type ChildNode = ReturnType<typeof parseDocument>['children'][number];

const BLOCK_TAGS = new Set([
  'address', 'article', 'aside', 'center', 'dd', 'div', 'dl', 'dt', 'fieldset',
  'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'header', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'tbody', 'tfoot',
  'thead', 'tr', 'ul',
]);

/** Blocks that keep a blank line around them, as their margins do on screen. */
const PARAGRAPH_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

/** Elements whose content is never text the reader sees. */
const SKIPPED_TAGS = new Set(['head', 'noscript', 'script', 'style', 'template', 'title']);

class TextWriter {
  out = '';

  get atLineStart(): boolean {
    return this.out === '' || this.out.endsWith('\n');
  }

  /** End the current line, unless nothing is on it yet. */
  lineBreak(): void {
    if (!this.atLineStart) this.out += '\n';
  }

  /** Leave one blank line, unless there already is one (or nothing before it). */
  paragraphBreak(): void {
    if (!this.out) return;
    this.lineBreak();
    if (!this.out.endsWith('\n\n')) this.out += '\n';
  }

  write(text: string): void {
    this.out += text;
  }
}

function tagName(node: ChildNode): string | null {
  return node.type === 'tag' || node.type === 'script' || node.type === 'style' ? node.name.toLowerCase() : null;
}

function render(nodes: ChildNode[], writer: TextWriter, pre: boolean): void {
  for (const node of nodes) {
    if (node.type === 'text') {
      const text = node.data.replace(/ /g, ' ');
      if (pre) {
        writer.write(text);
        continue;
      }
      const collapsed = text.replace(/[ \t\r\n\f]+/g, ' ');
      // Whitespace at the start of a line is source formatting, not text.
      writer.write(writer.atLineStart ? collapsed.replace(/^ /, '') : collapsed);
      continue;
    }
    const name = tagName(node);
    if (!name || SKIPPED_TAGS.has(name) || !('children' in node)) continue;

    if (name === 'br') {
      writer.write('\n');
    } else if (name === 'hr') {
      writer.lineBreak();
      writer.write('---\n');
    } else if (name === 'blockquote') {
      const inner = new TextWriter();
      render(node.children, inner, pre);
      const body = inner.out.replace(/\n+$/, '');
      writer.lineBreak();
      if (body) {
        writer.write(`${body.split('\n').map((line) => (line ? `> ${line}` : '>')).join('\n')}\n`);
      }
    } else if (name === 'li') {
      writer.lineBreak();
      const parent = node.parent;
      if (parent && 'name' in parent && parent.name.toLowerCase() === 'ol') {
        const items = parent.children.filter((child) => tagName(child) === 'li');
        writer.write(`${items.indexOf(node) + 1}. `);
      } else {
        writer.write('- ');
      }
      render(node.children, writer, pre);
      writer.lineBreak();
    } else if (name === 'td' || name === 'th') {
      // The cells of a row stay on one line.
      if (!writer.atLineStart) writer.write('\t');
      render(node.children, writer, pre);
    } else if (BLOCK_TAGS.has(name)) {
      const paragraph = PARAGRAPH_TAGS.has(name);
      if (paragraph) writer.paragraphBreak();
      else writer.lineBreak();
      render(node.children, writer, pre || name === 'pre');
      if (paragraph) writer.paragraphBreak();
      else writer.lineBreak();
    } else {
      render(node.children, writer, pre);
    }
  }
}

export function stripHtml(html: string): string {
  if (!html) return '';
  const writer = new TextWriter();
  render(parseDocument(html).children, writer, false);
  return writer.out
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+|\n+$/g, '');
}
