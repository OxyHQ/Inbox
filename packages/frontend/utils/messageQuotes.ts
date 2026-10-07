import { DomUtils, parseDocument } from 'htmlparser2';

type HtmlNode = ReturnType<typeof parseDocument>['children'][number];
export interface MessageParts { body: string; quoted?: string }

function isAttribution(value: string): boolean {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length > 700 || !/[@\d]/.test(text)) return false;
  return /^(?:On\b.+\bwrote:|El\b.+\bescribi[oó]:|Le\b.+\ba [eé]crit\s*:|Am\b.+\bschrieb.+:|Em\b.+\bescreveu:|Il\b.+\bha scritto:)$/i.test(text);
}

/** Keep unquoted inline answers visible; fold only recognizable reply citations. */
export function splitTextQuote(text: string): MessageParts {
  const lines = text.split(/\r?\n/);
  for (let start = 0; start < lines.length; start++) {
    for (let end = start; end < Math.min(start + 3, lines.length); end++) {
      if (!isAttribution(lines.slice(start, end + 1).join(' '))) continue;
      const tail = lines.slice(end + 1);
      if (!tail.some((line) => line.trim())) continue;
      const prefixed = tail.some((line) => /^\s*>/.test(line));
      const quoted = prefixed ? tail.filter((line) => /^\s*>/.test(line)) : tail;
      const visible = prefixed ? tail.filter((line) => !/^\s*>/.test(line)) : [];
      return {
        body: [...lines.slice(0, start), ...visible].join('\n').trim(),
        quoted: [...lines.slice(start, end + 1), ...quoted].join('\n').trim(),
      };
    }
  }
  return { body: text };
}

/**
 * Parse without a browser DOM so web and native use identical quote boundaries.
 * Only established mail-client containers / attributed blockquotes are folded.
 * Styling and surrounding structure are retained in both documents; HtmlBody
 * still sanitizes and proxies each fragment before displaying it.
 */
export function splitHtmlQuote(html: string): MessageParts {
  const document = parseDocument(html);
  const quoted = new Set<HtmlNode>();
  const textQuotes = new Map<HtmlNode, MessageParts>();
  const visit = (nodes: HtmlNode[]) => {
    nodes.forEach((node, index) => {
      if (node.type === 'text') {
        const parts = splitTextQuote(node.data);
        if (parts.quoted) textQuotes.set(node, parts);
        return;
      }
      if (!('attribs' in node) || ['head', 'script', 'style'].includes(node.name)) return;
      const classes = (node.attribs.class ?? '').split(/\s+/);
      const clientQuote = classes.some((name) => ['gmail_quote', 'yahoo_quoted', 'protonmail_quote'].includes(name));
      let previous = index - 1;
      while (previous >= 0 && !DomUtils.textContent(nodes[previous]).trim()) previous--;
      const attribution = previous >= 0 && isAttribution(DomUtils.textContent(nodes[previous]))
        ? nodes[previous] : undefined;
      if (clientQuote || (node.name === 'blockquote' && (node.attribs.type?.toLowerCase() === 'cite' || attribution))) {
        quoted.add(node);
        if (attribution) quoted.add(attribution);
        return;
      }
      // Outlook puts the original-message header and quoted tail in sibling nodes.
      if (node.attribs.id?.toLowerCase() === 'divrplyfwdmsg') {
        nodes.slice(index).forEach((sibling) => quoted.add(sibling));
        return;
      }
      visit(node.children);
    });
  };
  visit(document.children);
  if (!quoted.size && !textQuotes.size) return { body: html };

  const copy = (node: HtmlNode, quoteOnly: boolean): HtmlNode | null => {
    if (quoted.has(node)) return quoteOnly ? node.cloneNode(true) : null;
    const textParts = textQuotes.get(node);
    if (textParts && node.type === 'text') {
      const data = quoteOnly ? textParts.quoted : textParts.body;
      if (!data) return null;
      const clone = node.cloneNode(false);
      clone.data = data;
      return clone;
    }
    if ('name' in node && ['head', 'style'].includes(node.name)) return node.cloneNode(true);
    if ('children' in node) {
      const children = node.children.map((child) => copy(child, quoteOnly)).filter((child): child is HtmlNode => child !== null);
      if (!children.length) return null;
      const clone = node.cloneNode(false);
      clone.children = children;
      return clone;
    }
    return quoteOnly ? null : node.cloneNode(true);
  };
  const serialize = (quoteOnly: boolean) => document.children
    .map((node) => copy(node, quoteOnly))
    .filter((node): node is HtmlNode => node !== null)
    .map((node) => DomUtils.getOuterHTML(node)).join('');
  return { body: serialize(false), quoted: serialize(true) };
}
