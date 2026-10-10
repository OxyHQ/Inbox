/**
 * The printable document for one message.
 *
 * The message's HTML is someone else's markup. It used to be written raw into a
 * `window.open('')` document — a blank window shares the app's origin, so an
 * `onerror` in a received mail ran as the app, with its storage and its
 * session, the moment the user pressed Print. It is sanitized and its remote
 * images proxied exactly as the reader does, the header fields are escaped, and
 * on the web it prints from a sandboxed frame that may not run script.
 */

import type { Message } from '@/schemas/emailSchemas';
import { escapeHtml, textToEditorContent } from './composeBody';
import { getProxyBaseUrl, proxyExternalImages, sanitizeEmailHtml } from './htmlTransform';

function addressLine(list: { name?: string | null; address: string }[]): string {
  return list.map((a) => (a.name ? `${a.name} <${a.address}>` : a.address)).join(', ');
}

export interface PrintStrings {
  noSubject: string;
  /** The message's date, already formatted in the app's locale. */
  date: string;
  /** Translated field labels, punctuation included ("From:", "De :", "差出人:"). */
  labels: { from: string; to: string; cc: string; date: string };
}

/**
 * `message.html` must be the reader's HTML — with `cid:` references already
 * resolved by `useCidResolver` — or every inline image prints broken.
 */
export function buildPrintHtml(
  message: Pick<Message, 'subject' | 'from' | 'to' | 'cc' | 'html' | 'text'>,
  { noSubject, date, labels }: PrintStrings,
): string {
  const subject = escapeHtml(message.subject || noSubject);
  const from = escapeHtml(addressLine([message.from]));
  const to = escapeHtml(addressLine(message.to));
  const cc = escapeHtml(addressLine(message.cc ?? []));
  const body = message.html
    ? proxyExternalImages(sanitizeEmailHtml(message.html), getProxyBaseUrl())
    : `<div style="white-space:pre-wrap">${textToEditorContent(message.text ?? '', true)}</div>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${subject}</title>
<style>
  body { margin: 0; padding: 24px; background: #fff; color: #000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.5; }
  .header { border-bottom: 1px solid #ddd; padding-bottom: 16px; margin-bottom: 16px; }
  .subject { font-size: 20px; font-weight: 400; margin: 0 0 12px 0; }
  .field { margin: 2px 0; }
  .label { font-weight: 600; display: inline-block; min-width: 50px; }
  .body { margin-top: 16px; }
  img { max-width: 100%; height: auto; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<div class="header">
  <h1 class="subject">${subject}</h1>
  <div class="field"><span class="label">${escapeHtml(labels.from)}</span> ${from}</div>
  <div class="field"><span class="label">${escapeHtml(labels.to)}</span> ${to}</div>
  ${cc ? `<div class="field"><span class="label">${escapeHtml(labels.cc)}</span> ${cc}</div>` : ''}
  <div class="field"><span class="label">${escapeHtml(labels.date)}</span> ${escapeHtml(date)}</div>
</div>
<div class="body">${body}</div>
</body>
</html>`;
}

/**
 * Print a document on the web from a hidden frame. `allow-same-origin` lets
 * this page call the frame's `print()`; without `allow-scripts` nothing in the
 * document can run.
 */
export function printHtmlOnWeb(html: string): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-same-origin allow-modals');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    // The print dialog is modal in every browser; the frame can go after it.
    setTimeout(() => frame.remove(), 1000);
  };
  frame.srcdoc = html;
  document.body.appendChild(frame);
}
