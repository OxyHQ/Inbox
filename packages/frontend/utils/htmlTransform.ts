/**
 * HTML Transform Utilities for Email Content
 *
 * Transforms email HTML to route external resources through our proxy,
 * providing CORS bypass and tracking protection.
 */

import { resolveFaviconForImageUrl } from '@clarity.surf/sdk';
import { DomUtils, parseDocument } from 'htmlparser2';

const DANGEROUS_TAGS = [
  'script',
  'iframe',
  'object',
  'embed',
  'applet',
  'meta',
  'base',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'link',
  'template',
  'noscript',
  'foreignobject',
  'animate',
  'animatetransform',
  'set',
  // Foreign content. Inside <svg>/<math> a browser parses <style> as MARKUP,
  // while this parser treats it as raw text: `<svg><style><img src=…>` reaches
  // the page as a real <img> neither the sanitizer nor the image proxy saw.
  // Mail clients (Gmail among them) do not render inline SVG either.
  'svg',
  'math',
];
const DANGEROUS_URL_SCHEMES = /^(?:javascript|data|vbscript|file):/i;

function isSafeEmailUrl(value: string): boolean {
  const trimmed = value.trim().replace(/[\u0000-\u001f\u007f\s]+/g, '');
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('/')) return true;
  if (DANGEROUS_URL_SCHEMES.test(trimmed)) return false;

  try {
    const parsed = new URL(trimmed);
    return ['http:', 'https:', 'mailto:', 'tel:', 'cid:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function isSafeSrcset(value: string): boolean {
  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return entries.length > 0 && entries.every((entry) => isSafeEmailUrl(entry.split(/\s+/)[0]));
}

/**
 * Remove active content and dangerous URLs from untrusted email HTML before it is
 * rendered in an iframe or native WebView. This is intentionally conservative:
 * email markup should be display-only, with no scripts, forms, event handlers,
 * or javascript/data/file navigations.
 */
export function sanitizeEmailHtml(html: string): string {
  if (!html) return '';

  // Parse before filtering: regexes cannot distinguish an attribute value from
  // markup, or decode character references in URLs. The same parser runs on web
  // and native, and serialization escapes text/attributes before the browser
  // parses the document again. The iframe still disallows script execution.
  const document = parseDocument(html);
  const blockedTags = new Set(DANGEROUS_TAGS);
  const visit = (nodes: typeof document.children) => {
    for (const node of [...nodes]) {
      if (node.type === 'comment') {
        DomUtils.removeElement(node);
        continue;
      }
      if (!('attribs' in node)) continue;
      if (blockedTags.has(node.name.toLowerCase())) {
        DomUtils.removeElement(node);
        continue;
      }
      if (node.name === 'style') {
        for (const child of node.children) {
          if (child.type === 'text') child.data = sanitizeCss(child.data);
        }
      }
      for (const [name, value] of Object.entries(node.attribs)) {
        if (/^on/i.test(name) || name === 'srcdoc' || name === 'ping') {
          delete node.attribs[name];
        } else if (name === 'style') {
          node.attribs.style = sanitizeCss(value);
        } else if (['srcset', 'imagesrcset'].includes(name)) {
          if (!isSafeSrcset(value)) delete node.attribs[name];
        } else if (
          ['href', 'src', 'xlink:href', 'action', 'formaction', 'poster', 'background'].includes(
            name,
          )
        ) {
          if (!isSafeEmailUrl(value)) delete node.attribs[name];
        }
      }
      visit(node.children);
    }
  };
  visit(document.children);
  return DomUtils.getOuterHTML(document);
}

/**
 * Email uses system fonts; remote stylesheets and fonts must not act as
 * beacons. These used to be regexes over the whole serialized document, which
 * an escape (`@\69mport`) or a quote inside a URL slipped past, and which
 * rewrote `url(…)` in the mail's TEXT as well.
 */
const SANITIZER_DROPPED_AT_RULES = new Set(['import', 'namespace', 'font-face']);

function sanitizeCss(css: string): string {
  return rewriteCssUrls(
    css,
    (url) => (isSafeEmailUrl(url) ? url : 'about:blank'),
    SANITIZER_DROPPED_AT_RULES,
  );
}

type HtmlNode = ReturnType<typeof parseDocument>['children'][number];
type HtmlElement = Extract<HtmlNode, { attribs: Record<string, string> }>;

const INTERNAL_DOMAINS = ['oxy.so', 'localhost', '127.0.0.1'];
const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
/** Stands in for the document's URL when resolving a reference without a scheme. */
const RELATIVE_BASE = new URL('https://relative.invalid/');
/** Where `resolveFaviconForImageUrl` points (it only ever changes the path). */
const FAVICON_ORIGIN = new URL(
  resolveFaviconForImageUrl('https://example.com/favicon.ico') ?? 'https://api.clarity.surf/',
).origin;

function isInternalHost(hostname: string): boolean {
  return INTERNAL_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`));
}

type ResourceUrl =
  /** Nothing a sender learns from: relative, `cid:`, `data:`, `mailto:`, `#…`. */
  | { kind: 'inert' }
  | { kind: 'remote'; url: URL }
  /** Looks like a remote reference, but no URL parser makes one of it. */
  | { kind: 'broken' };

/**
 * What a browser would fetch for a URL-valued attribute or CSS `url()`, decided
 * by the WHATWG URL parser rather than by a prefix. `https:\\t.example\p.gif`
 * (backslashes are slashes to a browser), `https:t.example/p.gif`,
 * `\\t.example/p.gif` and ` HTTPS://…` are all remote — a `^https?://` test
 * recognised none of them, so they loaded straight from the sender, with the
 * reader's IP and the moment the mail was opened.
 *
 * A reference WITH a scheme is resolved on its own: on web the srcdoc frame
 * would resolve `https:t.example/p.gif` against inbox.oxy.so, but Android's
 * WebView document is `about:blank`, where it is an absolute URL.
 */
function classifyResourceUrl(value: string): ResourceUrl {
  // As the URL parser does: strip C0 controls and spaces around it and every
  // tab and newline inside it.
  const cleaned = value
    .replace(/[\t\n\r]/g, '')
    .replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, '');
  if (!cleaned) return { kind: 'inert' };
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(cleaned)?.[1].toLowerCase();
  if (scheme && scheme !== 'http' && scheme !== 'https') return { kind: 'inert' };
  try {
    const url = scheme ? new URL(cleaned) : new URL(cleaned, RELATIVE_BASE);
    // A relative reference that kept the stand-in host stays on this origin;
    // one that replaced it (`//host`, `\\host`, `/\host`) names another host.
    if (!scheme && url.host === RELATIVE_BASE.host) return { kind: 'inert' };
    return { kind: 'remote', url };
  } catch {
    return { kind: 'broken' };
  }
}

function buildProxyUrl(originalUrl: string, proxyBaseUrl: string): string {
  // btoa() only handles Latin1 — encode as UTF-8 first to avoid DOMException
  // on internationalized URLs. The backend decodes with Buffer.from(x, 'base64').toString('utf-8').
  const bytes = new TextEncoder().encode(originalUrl);
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  const encoded = btoa(binary);
  return `${proxyBaseUrl}?url=${encodeURIComponent(encoded)}`;
}

/**
 * The URL to load in place of `value`: remote resources go through the proxy
 * (or Clarity, for a site's favicon), Oxy's own are loaded as they are, and a
 * remote-looking URL that does not parse becomes a transparent pixel. Nothing
 * http(s) leaves here unrouted.
 *
 * Only an unparseable URL is withheld. A URL that carries a second URL — a
 * Gmail-proxied image (`…/meips/…#https://cdn.shop.com/logo.png`), a
 * Cloudinary fetch (`…/image/fetch/https://…`), `?redirect=https://…` — is an
 * ordinary URL the proxy accepts and fetches; it used to be blanked.
 */
function rewriteResourceUrl(value: string, proxyBaseUrl: string): string {
  const resource = classifyResourceUrl(value);
  if (resource.kind === 'inert') return value;
  if (resource.kind === 'broken') return TRANSPARENT_PIXEL;
  const { url } = resource;
  // A fragment never reaches a server.
  url.hash = '';
  if (isInternalHost(url.hostname)) return url.href;
  return resolveFaviconForImageUrl(url.href) ?? buildProxyUrl(url.href, proxyBaseUrl);
}

/**
 * `srcset`, split the way the HTML spec splits it: a candidate's URL is a run
 * of non-whitespace (commas included, except trailing ones), so splitting on
 * every comma saw different URLs than the browser fetched.
 */
function rewriteSrcset(srcset: string, rewrite: (url: string) => string): string {
  const isSpace = (ch: string | undefined) => ch !== undefined && /[ \t\n\f\r]/.test(ch);
  const candidates: string[] = [];
  let i = 0;
  while (i < srcset.length) {
    while (i < srcset.length && (isSpace(srcset[i]) || srcset[i] === ',')) i++;
    if (i >= srcset.length) break;
    const start = i;
    while (i < srcset.length && !isSpace(srcset[i])) i++;
    let url = srcset.slice(start, i);
    let descriptors = '';
    if (/,$/.test(url)) {
      url = url.replace(/,+$/, '');
    } else {
      const descriptorStart = i;
      let depth = 0;
      while (i < srcset.length && (srcset[i] !== ',' || depth > 0)) {
        if (srcset[i] === '(') depth++;
        else if (srcset[i] === ')') depth = Math.max(0, depth - 1);
        i++;
      }
      descriptors = srcset.slice(descriptorStart, i).trim();
    }
    const rewritten = rewrite(url);
    candidates.push(descriptors ? `${rewritten} ${descriptors}` : rewritten);
  }
  return candidates.join(', ');
}

// ─── CSS ───────────────────────────────────────────────────────────
//
// A tokenizer, not a regex: what the browser loads depends on CSS escapes
// (`u\72l(…)`, `@\69mport`), on quotes inside quoted URLs
// (`url("…/a'b.gif")`) and on comments, and every regex that has stood here
// was bypassed by one of them. This follows CSS Syntax Level 3 §4 for the
// tokens that can load something — url(), src(), image-set() strings and
// @import — and copies everything else through.

const CSS_SPACE = /^[ \t\n]$/;
const isCssSpace = (ch: string | undefined) => ch !== undefined && CSS_SPACE.test(ch);
const isCssNameChar = (ch: string | undefined) =>
  ch !== undefined && (/^[A-Za-z0-9_-]$/.test(ch) || ch.charCodeAt(0) >= 0x80);
const isCssNonPrintable = (ch: string) => /^[\u0000-\u0008\u000b\u000e-\u001f\u007f]$/.test(ch);
/** `\` starts an escape unless a newline follows it (input is preprocessed). */
const isCssEscape = (css: string, i: number) => css[i] === '\\' && css[i + 1] !== '\n';

function safeCodePoint(codePoint: number): string {
  const valid =
    codePoint > 0 && codePoint <= 0x10ffff && (codePoint < 0xd800 || codePoint > 0xdfff);
  return valid ? String.fromCodePoint(codePoint) : '\uFFFD';
}

/** An escape's value; `i` is just past the backslash. */
function consumeCssEscape(css: string, i: number): [string, number] {
  if (i >= css.length) return ['\uFFFD', i];
  const hex = /^[0-9a-fA-F]{1,6}/.exec(css.slice(i, i + 6));
  if (hex) {
    const end = i + hex[0].length;
    return [safeCodePoint(parseInt(hex[0], 16)), isCssSpace(css[end]) ? end + 1 : end];
  }
  const ch = String.fromCodePoint(css.codePointAt(i)!);
  return [ch, i + ch.length];
}

/** An ident-like run (name characters and escapes), unescaped. */
function consumeCssName(css: string, i: number): [string, number] {
  let name = '';
  while (i < css.length) {
    if (isCssNameChar(css[i])) {
      name += css[i];
      i++;
    } else if (isCssEscape(css, i)) {
      const [ch, next] = consumeCssEscape(css, i + 1);
      name += ch;
      i = next;
    } else {
      break;
    }
  }
  return [name, i];
}

/** A string's value; `i` is just past the opening quote. */
function consumeCssString(css: string, i: number, quote: string): [string, number] {
  let value = '';
  while (i < css.length) {
    const ch = css[i];
    if (ch === quote) return [value, i + 1];
    // An unescaped newline ends a (bad) string without being part of it.
    if (ch === '\n') return [value, i];
    if (ch === '\\') {
      if (i + 1 >= css.length) {
        i++;
      } else if (css[i + 1] === '\n') {
        i += 2;
      } else {
        const [escaped, next] = consumeCssEscape(css, i + 1);
        value += escaped;
        i = next;
      }
      continue;
    }
    value += ch;
    i++;
  }
  return [value, i];
}

/** Past the rest of a bad url token: up to and including its `)`. */
function skipBadCssUrl(css: string, i: number): number {
  while (i < css.length) {
    if (css[i] === ')') return i + 1;
    i = isCssEscape(css, i) ? consumeCssEscape(css, i + 1)[1] : i + 1;
  }
  return i;
}

/** An unquoted `url(…)` token; `i` is just past `(`. `value` null: a bad url. */
function consumeCssUrl(css: string, i: number): { value: string | null; end: number } {
  while (isCssSpace(css[i])) i++;
  let value = '';
  while (i < css.length) {
    const ch = css[i];
    if (ch === ')') return { value, end: i + 1 };
    if (isCssSpace(ch)) {
      while (isCssSpace(css[i])) i++;
      if (i >= css.length) return { value, end: i };
      if (css[i] === ')') return { value, end: i + 1 };
      return { value: null, end: skipBadCssUrl(css, i) };
    }
    if (ch === '"' || ch === "'" || ch === '(' || isCssNonPrintable(ch)) {
      return { value: null, end: skipBadCssUrl(css, i) };
    }
    if (ch === '\\') {
      if (!isCssEscape(css, i)) return { value: null, end: skipBadCssUrl(css, i) };
      const [escaped, next] = consumeCssEscape(css, i + 1);
      value += escaped;
      i = next;
      continue;
    }
    value += ch;
    i++;
  }
  return { value, end: i };
}

/** Past an at-rule's prelude and block, from just after its name. */
function skipCssAtRule(css: string, i: number): number {
  let depth = 0;
  while (i < css.length) {
    const ch = css[i];
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end < 0 ? css.length : end + 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      i = consumeCssString(css, i + 1, ch)[1];
      continue;
    }
    if (ch === '\\') {
      i = isCssEscape(css, i) ? consumeCssEscape(css, i + 1)[1] : i + 1;
      continue;
    }
    if (ch === ';' && depth === 0) return i + 1;
    if (ch === '}') {
      // The enclosing block's end is not this rule's to take.
      if (depth === 0) return i;
      depth--;
      if (depth === 0) return i + 1;
    } else if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
    } else if ((ch === ')' || ch === ']') && depth > 0) {
      depth--;
    }
    i++;
  }
  return i;
}

/** A CSS string literal that reads back as exactly `value`. */
function cssString(value: string): string {
  return `"${value.replace(/[\u0000-\u001f\u007f"\\<>]/g, (ch) => `\\${ch.charCodeAt(0).toString(16)} `)}"`;
}

/** Functions whose string arguments are URLs. */
const CSS_URL_STRING_FUNCTIONS = new Set(['url', 'src', 'image-set', '-webkit-image-set']);
/**
 * At-rules the proxy pass removes whole. `@import` fetches a stylesheet (a
 * beacon, and CSS this pass never saw); `@namespace` loads nothing but names a
 * URL that would otherwise trip the final check below.
 */
const PROXY_DROPPED_AT_RULES = new Set(['import', 'namespace']);

/** Every URL a stylesheet can load, passed through `rewrite`; `droppedAtRules` removed whole. */
function rewriteCssUrls(
  input: string,
  rewrite: (url: string) => string,
  droppedAtRules: ReadonlySet<string>,
): string {
  // CSS input preprocessing (§3.3).
  const css = input.replace(/\r\n?|\f/g, '\n').replace(/\0/g, '\uFFFD');
  const open: string[] = [];
  let out = '';
  let i = 0;
  while (i < css.length) {
    const ch = css[i];
    if (ch === '/' && css[i + 1] === '*') {
      // Kept as an empty comment, so the tokens on each side stay apart.
      const end = css.indexOf('*/', i + 2);
      i = end < 0 ? css.length : end + 2;
      out += '/**/';
      continue;
    }
    if (ch === '"' || ch === "'") {
      const [value, end] = consumeCssString(css, i + 1, ch);
      out += CSS_URL_STRING_FUNCTIONS.has(open[open.length - 1] ?? '')
        ? cssString(rewrite(value))
        : css.slice(i, end);
      i = end;
      continue;
    }
    if ((ch === '@' || ch === '#') && (isCssNameChar(css[i + 1]) || isCssEscape(css, i + 1))) {
      // An at-keyword or a hash token: never a function, whatever follows.
      const [name, end] = consumeCssName(css, i + 1);
      if (ch === '@' && droppedAtRules.has(name.toLowerCase())) {
        i = skipCssAtRule(css, end);
        continue;
      }
      out += css.slice(i, end);
      i = end;
      continue;
    }
    if (isCssNameChar(ch) || isCssEscape(css, i)) {
      const [name, end] = consumeCssName(css, i);
      if (css[end] !== '(') {
        out += css.slice(i, end);
        i = end;
        continue;
      }
      const fn = name.toLowerCase();
      if (fn === 'url') {
        let next = end + 1;
        while (isCssSpace(css[next])) next++;
        if (css[next] !== '"' && css[next] !== "'") {
          const { value, end: urlEnd } = consumeCssUrl(css, end + 1);
          out += `url(${cssString(value === null ? TRANSPARENT_PIXEL : rewrite(value))})`;
          i = urlEnd;
          continue;
        }
      }
      open.push(fn);
      out += `${css.slice(i, end)}(`;
      i = end + 1;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') open.push('');
    else if ((ch === ')' || ch === ']' || ch === '}') && open.length) open.pop();
    out += ch;
    i++;
  }
  return out;
}

/**
 * The last line of defence, independent of the tokenizer: with every escape
 * decoded, the stylesheet may not contain `@import`, nor any http(s) or
 * protocol-relative URL other than the proxy's, Oxy's own or Clarity's
 * favicons. A stylesheet that does is one the tokenizer read differently from
 * a browser, and it is dropped whole — losing an email's styling is the
 * recoverable failure; loading a tracker is not.
 */
function cssLoadsOnlyRoutedUrls(css: string, proxyBaseUrl: string): boolean {
  const decoded = css
    .replace(
      /\\(?:([0-9a-fA-F]{1,6})[ \t\n]?|([\s\S]))/g,
      (_match, hex: string | undefined, ch: string | undefined) =>
        hex ? safeCodePoint(parseInt(hex, 16)) : (ch ?? ''),
    )
    .toLowerCase();
  if (decoded.includes('@import')) return false;
  const proxyPrefix = `${proxyBaseUrl.toLowerCase()}?`;
  const isRouted = (candidate: string) => {
    if (!candidate.replace(/^(?:https?:)?[\\/]*/, '')) return true; // names no host
    if (candidate.startsWith(proxyPrefix)) return true;
    try {
      const url = new URL(/^https?:/.test(candidate) ? candidate : `https:${candidate}`);
      return (
        isInternalHost(url.hostname) ||
        (url.origin === FAVICON_ORIGIN && url.pathname.startsWith('/favicons/'))
      );
    } catch {
      return false;
    }
  };
  for (const match of decoded.matchAll(/(?:^|[\s"'(,])([\\/]{2}[^\s"'()]*)|(https?:[^\s"'()]*)/g)) {
    if (!isRouted(match[1] ?? match[2])) return false;
  }
  return true;
}

/** Elements whose `src` the browser loads as soon as it is rendered. */
const IMAGE_SRC_TAGS = new Set(['img', 'image', 'source']);

export interface ProxyOptions {
  /** Text of the link that replaces a `<video>`; the URL itself when absent. */
  videoLinkLabel?: string;
  /** Text of the link that replaces an `<audio>`; the URL itself when absent. */
  audioLinkLabel?: string;
}

/**
 * `<video>` and `<audio>` become their fallback content plus a link to the
 * original file. They cannot play here: the proxy serves only images and
 * fonts, and the web CSP's media-src does not allow it. Loading the file
 * directly instead would hand the sender the reader's IP and read time (the
 * Android WebView has no CSP to stop it). A link loads nothing until it is
 * tapped — like every other link in the mail — and then opens outside the
 * reader, through the same scheme allowlist as any link.
 */
function replaceMediaElement(node: HtmlElement, options: ProxyOptions): HtmlNode[] {
  const candidates = [
    node.attribs.src,
    ...node.children
      .filter((child): child is HtmlElement => 'attribs' in child && child.name === 'source')
      .map((child) => child.attribs.src),
  ];
  let href: string | null = null;
  for (const candidate of candidates) {
    if (!candidate) continue;
    const resource = classifyResourceUrl(candidate);
    if (resource.kind === 'remote') {
      href = resource.url.href;
      break;
    }
  }
  const replacement: HtmlNode[] = node.children.filter(
    (child) => !('attribs' in child && (child.name === 'source' || child.name === 'track')),
  );
  if (href) {
    const anchor = parseDocument('<a></a>').children[0] as HtmlElement;
    anchor.attribs.href = href;
    const label = parseDocument('-').children[0];
    if (label.type === 'text') {
      label.data =
        (node.name === 'audio' ? options.audioLinkLabel : options.videoLinkLabel) || href;
      DomUtils.appendChild(anchor, label);
    }
    replacement.push(anchor);
  }
  let previous: HtmlNode = node;
  for (const next of replacement) {
    DomUtils.append(previous, next);
    previous = next;
  }
  DomUtils.removeElement(node);
  return replacement;
}

/**
 * Route every resource email HTML would load through the proxy: images,
 * backgrounds, `srcset`, and every `url()` / `image-set()` in CSS. Anything
 * remote that cannot be routed is replaced by a transparent pixel; `<video>` /
 * `<audio>` become links.
 */
export function proxyExternalImages(
  html: string,
  proxyBaseUrl: string,
  options: ProxyOptions = {},
): string {
  if (!html || !proxyBaseUrl) return html;

  const document = parseDocument(html);
  const rewrite = (value: string) => rewriteResourceUrl(value, proxyBaseUrl);
  const rewriteCss = (value: string): string => {
    const rewritten = rewriteCssUrls(value, rewrite, PROXY_DROPPED_AT_RULES);
    return cssLoadsOnlyRoutedUrls(rewritten, proxyBaseUrl) ? rewritten : '';
  };
  const visit = (nodes: HtmlNode[]) => {
    for (const node of [...nodes]) {
      if (!('attribs' in node)) continue;
      if (node.name === 'video' || node.name === 'audio') {
        visit(replaceMediaElement(node, options));
        continue;
      }
      // Every attribute a browser fetches media from without a click.
      if (IMAGE_SRC_TAGS.has(node.name) && node.attribs.src)
        node.attribs.src = rewrite(node.attribs.src);
      if (node.attribs.poster) node.attribs.poster = rewrite(node.attribs.poster);
      for (const name of ['href', 'xlink:href']) {
        if (node.name !== 'a' && node.name !== 'area' && node.attribs[name]) {
          node.attribs[name] = rewrite(node.attribs[name]);
        }
      }
      for (const name of ['srcset', 'imagesrcset']) {
        if (node.attribs[name]) node.attribs[name] = rewriteSrcset(node.attribs[name], rewrite);
      }
      if (node.attribs.background) node.attribs.background = rewrite(node.attribs.background);
      if (node.attribs.style) {
        const style = rewriteCss(node.attribs.style);
        if (style) node.attribs.style = style;
        else delete node.attribs.style;
      }
      if (node.name === 'style') {
        for (const child of node.children) {
          if (child.type === 'text') child.data = rewriteCss(child.data);
        }
      }
      visit(node.children);
    }
  };
  visit(document.children);
  return DomUtils.getOuterHTML(document);
}

/**
 * The form a Content-ID is compared in. The API stores the header as written,
 * angle brackets included (`<logo@example.com>`), while the HTML references it
 * bare and sometimes URL-encoded (`cid:logo%40example.com`); compared as given,
 * the two never matched and every inline image in received mail was broken.
 */
export function normalizeContentId(value: string): string {
  let id = value.trim();
  if (id.toLowerCase().startsWith('cid:')) id = id.slice(4);
  id = id.replace(/^<|>$/g, '');
  try {
    id = decodeURIComponent(id);
  } catch {
    // Not percent-encoded after all; compare as written.
  }
  return id.toLowerCase();
}

/**
 * Replace cid: references in email HTML with actual attachment URLs: quoted
 * and unquoted attributes, and CSS `url(cid:…)`. `cidMap` is keyed by
 * `normalizeContentId`.
 */
export function resolveCidImages(html: string, cidMap: Record<string, string>): string {
  if (!html || Object.keys(cidMap).length === 0) return html;
  return html.replace(/cid:([^\s"'()<>]+)/gi, (match, cid: string) => {
    const url = cidMap[normalizeContentId(cid)];
    return url ?? match;
  });
}

/**
 * Get the proxy base URL based on the current environment
 */
export function getProxyBaseUrl(): string {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.oxy.so';
  return `${apiUrl}/email/proxy`;
}
