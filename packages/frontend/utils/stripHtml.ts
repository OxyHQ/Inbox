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
  'address',
  'article',
  'aside',
  'center',
  'dd',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'tbody',
  'tfoot',
  'thead',
  'tr',
  'ul',
]);

/** Blocks that keep a blank line around them, as their margins do on screen. */
const PARAGRAPH_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

/** Elements whose content is never text the reader sees. */
const SKIPPED_TAGS = new Set(['head', 'noscript', 'script', 'style', 'template', 'title']);

class TextWriter {
  out = '';
  private preserved: { start: number; end: number }[] = [];

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

  write(text: string, preserve = false): void {
    if (preserve && text)
      this.preserved.push({ start: this.out.length, end: this.out.length + text.length });
    this.out += text;
  }

  /** Find the first preserved range that ends after the given offset. */
  private firstAfter(offset: number): number {
    let low = 0;
    let high = this.preserved.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (this.preserved[middle].end <= offset) low = middle + 1;
      else high = middle;
    }
    return low;
  }

  isPreserved(offset: number): boolean {
    const range = this.preserved[this.firstAfter(offset)];
    return !!range && range.start <= offset;
  }

  /** Copy a slice and its preformatted ranges without inventing sentinels. */
  copyTo(other: TextWriter, start: number, end: number): void {
    let cursor = start;
    for (let i = this.firstAfter(start); i < this.preserved.length; i++) {
      const range = this.preserved[i];
      if (range.start >= end) break;
      const from = Math.max(cursor, range.start);
      const to = Math.min(end, range.end);
      if (cursor < from) other.write(this.out.slice(cursor, from));
      if (from < to) other.write(this.out.slice(from, to), true);
      cursor = to;
    }
    if (cursor < end) other.write(this.out.slice(cursor, end));
  }

  /** Apply normal whitespace cleanup only where it cannot remove preformatted text. */
  normalized(): string {
    const removals: { start: number; end: number }[] = [];
    for (const match of this.out.matchAll(/[ \t]+/g)) {
      const end = match.index + match[0].length;
      if (end < this.out.length && this.out[end] !== '\n') continue;
      let keepThrough = match.index;
      for (let i = this.firstAfter(match.index); i < this.preserved.length; i++) {
        const range = this.preserved[i];
        if (range.start >= end) break;
        keepThrough = Math.max(keepThrough, Math.min(range.end, end));
      }
      if (keepThrough < end) removals.push({ start: keepThrough, end });
    }
    for (const match of this.out.matchAll(/\n{3,}/g)) {
      const end = match.index + match[0].length;
      const range = this.preserved[this.firstAfter(match.index)];
      if (!range || range.start >= end) removals.push({ start: match.index + 2, end });
    }
    let leading = 0;
    while (this.out[leading] === '\n' && !this.isPreserved(leading)) leading++;
    if (leading) removals.push({ start: 0, end: leading });
    let trailing = this.out.length;
    while (trailing > leading && this.out[trailing - 1] === '\n' && !this.isPreserved(trailing - 1))
      trailing--;
    if (trailing < this.out.length) removals.push({ start: trailing, end: this.out.length });
    removals.sort((a, b) => a.start - b.start);
    const result: string[] = [];
    let cursor = 0;
    for (const removal of removals) {
      if (removal.start > cursor) result.push(this.out.slice(cursor, removal.start));
      cursor = Math.max(cursor, removal.end);
    }
    result.push(this.out.slice(cursor));
    return result.join('');
  }
}

function tagName(node: ChildNode): string | null {
  return node.type === 'tag' || node.type === 'script' || node.type === 'style'
    ? node.name.toLowerCase()
    : null;
}

/** Parse the integer prefix HTML accepts, limited to exactly representable numbers. */
function listInteger(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const match = /^[\t\n\f\r ]*([+-]?\d+)/.exec(value);
  if (!match) return undefined;
  const result = Number(match[1]);
  return Number.isSafeInteger(result) ? result : undefined;
}

/** Compute the direct list-item ordinals once, including explicit resets. */
function listOrdinals(
  parent: ChildNode & { children: ChildNode[]; attribs: Record<string, string> },
): Map<ChildNode, number> {
  const items = parent.children.filter((child) => tagName(child) === 'li');
  const reversed = parent.attribs.reversed !== undefined;
  const step = reversed ? -1 : 1;
  let ordinal = listInteger(parent.attribs.start) ?? (reversed ? items.length : 1);
  const result = new Map<ChildNode, number>();
  for (const [index, item] of items.entries()) {
    if ('attribs' in item) ordinal = listInteger(item.attribs.value) ?? ordinal;
    result.set(item, Number.isSafeInteger(ordinal) ? ordinal : index + 1);
    ordinal += step;
  }
  return result;
}

/** Apply the HTML parser's initial-LF rule for a direct preformatted text node. */
function afterPreStart(data: string, source: string, startIndex: number | null): string {
  if (data.startsWith('\n')) return data.slice(1);
  if (data.startsWith('\r') && startIndex !== null && source[startIndex] === '\r') {
    return data.slice(source[startIndex + 1] === '\n' ? 2 : 1);
  }
  return data;
}

function render(
  nodes: ChildNode[],
  writer: TextWriter,
  pre: boolean,
  ordinals: WeakMap<object, Map<ChildNode, number>>,
  source: string,
  skipInitialPreLF = false,
): void {
  for (const [index, node] of nodes.entries()) {
    if (node.type === 'text') {
      if (pre) {
        const data =
          skipInitialPreLF && index === 0
            ? afterPreStart(node.data, source, node.startIndex)
            : node.data;
        writer.write(data, true);
        continue;
      }
      const text = node.data.replace(/ /g, ' ');
      const collapsed = text.replace(/[ \t\r\n\f]+/g, ' ');
      // Whitespace at the start of a line is source formatting, not text.
      writer.write(writer.atLineStart ? collapsed.replace(/^ /, '') : collapsed);
      continue;
    }
    const name = tagName(node);
    if (!name || SKIPPED_TAGS.has(name) || !('children' in node)) continue;

    if (name === 'br') {
      writer.write('\n', pre);
    } else if (name === 'hr') {
      writer.lineBreak();
      writer.write('---\n');
    } else if (name === 'blockquote') {
      const inner = new TextWriter();
      render(node.children, inner, pre, ordinals, source);
      let end = inner.out.length;
      while (end > 0 && inner.out[end - 1] === '\n' && !inner.isPreserved(end - 1)) end--;
      writer.lineBreak();
      if (end > 0) {
        let start = 0;
        while (start <= end) {
          const lineEnd = inner.out.indexOf('\n', start);
          const stop = lineEnd < 0 || lineEnd >= end ? end : lineEnd;
          writer.write(start < stop ? '> ' : '>');
          inner.copyTo(writer, start, stop);
          if (stop === end) {
            writer.write('\n');
            break;
          }
          inner.copyTo(writer, stop, stop + 1);
          start = stop + 1;
        }
      }
    } else if (name === 'li') {
      writer.lineBreak();
      const parent = node.parent;
      if (parent && 'name' in parent && parent.name.toLowerCase() === 'ol') {
        let values = ordinals.get(parent);
        if (!values) {
          values = listOrdinals(parent);
          ordinals.set(parent, values);
        }
        writer.write(`${values.get(node) ?? 1}. `);
      } else {
        writer.write('- ');
      }
      render(node.children, writer, pre, ordinals, source);
      writer.lineBreak();
    } else if (name === 'td' || name === 'th') {
      // The cells of a row stay on one line.
      if (!writer.atLineStart) writer.write('\t');
      render(node.children, writer, pre, ordinals, source);
    } else if (BLOCK_TAGS.has(name)) {
      const paragraph = PARAGRAPH_TAGS.has(name);
      if (paragraph) writer.paragraphBreak();
      else writer.lineBreak();
      render(node.children, writer, pre || name === 'pre', ordinals, source, name === 'pre');
      if (paragraph) writer.paragraphBreak();
      else writer.lineBreak();
    } else {
      render(node.children, writer, pre, ordinals, source);
    }
  }
}

export function stripHtml(html: string): string {
  if (!html) return '';
  const writer = new TextWriter();
  render(
    parseDocument(html, { withStartIndices: true }).children,
    writer,
    false,
    new WeakMap(),
    html,
  );
  return writer.normalized();
}
