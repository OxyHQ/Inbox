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
  const entries = value.split(',').map((entry) => entry.trim()).filter(Boolean);
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
      for (const [name, value] of Object.entries(node.attribs)) {
        if (/^on/i.test(name) || name === 'srcdoc') {
          delete node.attribs[name];
        } else if (['srcset', 'imagesrcset'].includes(name)) {
          if (!isSafeSrcset(value)) delete node.attribs[name];
        } else if (['href', 'src', 'xlink:href', 'action', 'formaction', 'poster', 'background'].includes(name)) {
          if (!isSafeEmailUrl(value)) delete node.attribs[name];
        }
      }
      visit(node.children);
    }
  };
  visit(document.children);
  let sanitized = DomUtils.getOuterHTML(document);
  sanitized = sanitized.replace(
    /url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi,
    (match, _quote, url: string) => (isSafeEmailUrl(url) ? match : 'url(about:blank)'),
  );
  // Email uses system fonts; remote stylesheets/fonts must not act as beacons.
  sanitized = sanitized.replace(/@font-face\s*\{[^}]*\}/gi, '');
  sanitized = sanitized.replace(/@import\s+(?:url\([^)]*\)|["'][^"']*["'])[^;]*;?/gi, '');
  return sanitized;
}

const INTERNAL_DOMAINS = ['oxy.so', 'localhost', '127.0.0.1'];
const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

function isMalformedRemoteImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return /https?:\/\//i.test(`${parsed.pathname}${parsed.search}${parsed.hash}`);
  } catch {
    return true;
  }
}

function proxyableImageUrl(url: string): boolean {
  return isExternalUrl(url) && !isMalformedRemoteImageUrl(url);
}

function isExternalUrl(url: string): boolean {
  if (!url || url.startsWith('data:') || url.startsWith('#') || url.startsWith('/')) {
    return false;
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const { hostname } = new URL(url);
      return !INTERNAL_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`));
    } catch {
      return false;
    }
  }

  return false;
}

function buildProxyUrl(originalUrl: string, proxyBaseUrl: string): string {
  // btoa() only handles Latin1 — encode as UTF-8 first to avoid DOMException
  // on internationalized URLs. The backend decodes with Buffer.from(x, 'base64').toString('utf-8').
  const bytes = new TextEncoder().encode(originalUrl);
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  const encoded = btoa(binary);
  return `${proxyBaseUrl}?url=${encodeURIComponent(encoded)}`;
}

function proxySrcset(srcset: string, proxyBaseUrl: string): string {
  return srcset
    .split(',')
    .map((entry: string) => {
      const [rawUrl, ...rest] = entry.trim().split(/\s+/);
      const url = rawUrl.startsWith('//') ? `https:${rawUrl}` : rawUrl;
      if (proxyableImageUrl(url)) {
        return rest.length
          ? `${buildProxyUrl(url, proxyBaseUrl)} ${rest.join(' ')}`
          : buildProxyUrl(url, proxyBaseUrl);
      }
      return entry;
    })
    .join(', ');
}

/**
 * Transform email HTML to route external images and fonts through our proxy.
 */
export function proxyExternalImages(html: string, proxyBaseUrl: string): string {
  if (!html || !proxyBaseUrl) return html;

  const document = parseDocument(html);
  const rewriteImage = (value: string): string => {
    const src = value.startsWith('//') ? `https:${value}` : value;
    if (!/^https?:/i.test(src)) return src;
    const faviconUrl = resolveFaviconForImageUrl(src);
    return faviconUrl ?? (isMalformedRemoteImageUrl(src)
      ? TRANSPARENT_PIXEL
      : proxyableImageUrl(src) ? buildProxyUrl(src, proxyBaseUrl) : src);
  };
  const rewriteCss = (value: string): string => value.replace(
    /url\(\s*["']?([^"')]+)["']?\s*\)/gi,
    (_match, url: string) => `url("${rewriteImage(url)}")`,
  );
  const visit = (nodes: typeof document.children) => {
    for (const node of nodes) {
      if (!('attribs' in node)) continue;
      if (node.name === 'img' && node.attribs.src) node.attribs.src = rewriteImage(node.attribs.src);
      if (['img', 'source'].includes(node.name)) {
        for (const name of ['srcset', 'imagesrcset']) {
          if (node.attribs[name]) node.attribs[name] = proxySrcset(node.attribs[name], proxyBaseUrl);
        }
      }
      if (node.attribs.background) node.attribs.background = rewriteImage(node.attribs.background);
      if (node.attribs.style) node.attribs.style = rewriteCss(node.attribs.style);
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
 * Replace cid: references in email HTML with actual attachment URLs.
 */
export function resolveCidImages(html: string, cidMap: Record<string, string>): string {
  if (!html || Object.keys(cidMap).length === 0) return html;
  return html.replace(
    /(['"])cid:([^'"]+)(['"])/gi,
    (match, q1, cid, q2) => {
      const url = cidMap[cid];
      return url ? `${q1}${url}${q2}` : match;
    },
  );
}

/**
 * Get the proxy base URL based on the current environment
 */
export function getProxyBaseUrl(): string {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.oxy.so';
  return `${apiUrl}/email/proxy`;
}
