/**
 * Cross-platform HTML email body renderer.
 * Web: sandboxed iframe with auto-height. Native: locked-down react-native-webview.
 *
 * External images and fonts are routed through our proxy to:
 * - Bypass CORS/CORP restrictions
 * - Protect user privacy (hide IP from email senders)
 * - Block tracking pixels
 */

import { useTheme } from '@oxy.so/bloom/theme';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Linking, Platform, StyleSheet } from 'react-native';
import {
  getProxyBaseUrl,
  proxyExternalImages,
  sanitizeEmailHtml,
} from '../utils/htmlTransform';
import { useTranslation } from '@/lib/i18n';

interface HtmlBodyProps {
  html: string;
}

const ALLOWED_EXTERNAL_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
const CONTROL_OR_SPACE_BOUNDARY = /^[\u0000-\u0020]+|[\u0000-\u0020]+$/g;

/**
 * Validate an anchor/navigation href against a strict protocol allowlist.
 *
 * Email HTML is attacker-controlled, so we only ever hand a URL to the
 * system browser / new tab when it parses cleanly AND uses an explicitly
 * allowed scheme. This rejects `javascript:`, `data:`, `file:`, and
 * control-character-obfuscated variants (e.g. `java\\u0000script:`), since
 * leading/trailing control chars and whitespace are stripped before parsing
 * and the scheme is matched exactly.
 */
export function getSafeExternalUrl(
  href: string | null | undefined,
): string | null {
  const trimmedHref = href?.replace(CONTROL_OR_SPACE_BOUNDARY, '');
  if (!trimmedHref || trimmedHref.startsWith('#')) return null;

  try {
    const url = new URL(trimmedHref);
    if (!ALLOWED_EXTERNAL_LINK_PROTOCOLS.has(url.protocol.toLowerCase())) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Decide whether a native WebView navigation request should be treated as a
 * real user-initiated link tap that we open in the system browser.
 *
 * `react-native-webview` reports `navigationType` inconsistently across
 * platforms: iOS supplies `'click'` for link taps, but Android sets it to
 * `'other'` (or omits it entirely) for the SAME tap. Gating strictly on
 * `=== 'click'` therefore blocks every email link on Android. We accept
 * `'click'`, `'other'`, or an absent type while still requiring a top-frame
 * navigation; the protocol allowlist (`getSafeExternalUrl`) is the real
 * security boundary and is enforced by the caller.
 */
export function isUserInitiatedNativeNavigation(request: {
  navigationType?: string | null;
  isTopFrame?: boolean;
}): boolean {
  const { navigationType } = request;
  const isAllowedType =
    navigationType === 'click' ||
    navigationType === 'other' ||
    navigationType == null;
  return request.isTopFrame !== false && isAllowedType;
}

/** The in-memory document the WebView renders, and in-page `#anchor` jumps within it. */
const INITIAL_DOCUMENT = /^about:blank(?:[?#]|$)/i;

/**
 * Every navigation the native WebView attempts, decided in one place.
 *
 * `originWhitelist` is `['*']` so that this runs for EVERY URL.
 * react-native-webview checks its whitelist first and hands any URL that
 * fails it straight to `Linking.openURL` — unvalidated, whatever its scheme,
 * tapped or not — and never calls `onShouldStartLoadWithRequest`. With the
 * old `['about:blank']` that was every link in every mail: the protocol
 * allowlist below never ran.
 *
 * The WebView itself never leaves the in-memory document. A safe link, on a
 * real top-frame tap, is opened OUTSIDE it, and only then.
 */
export function decideNativeNavigation(request: {
  url: string;
  navigationType?: string | null;
  isTopFrame?: boolean;
}): { allow: boolean; open: string | null } {
  if (INITIAL_DOCUMENT.test(request.url)) return { allow: true, open: null };
  const safeUrl = getSafeExternalUrl(request.url);
  return {
    allow: false,
    open: safeUrl && isUserInitiatedNativeNavigation(request) ? safeUrl : null,
  };
}

interface WrapStrings {
  videoLinkLabel: string;
  audioLinkLabel: string;
}

/**
 * Wrap email HTML with styling and proxy external resources.
 *
 * Dark mode strategy (feature-detection rather than forced override):
 * - Set `color-scheme: dark` on the document so well-behaved emails can opt
 *   in to a dark variant via CSS `@media (prefers-color-scheme: dark)` or
 *   `light-dark()` declarations. Modern marketing email systems
 *   (Mailchimp, Litmus, Apple Mail's adaptive engine, etc.) already use
 *   this signal, so we trust it.
 * - Keep the host transparent and apply theme text on `html` and `body`
 *   (without `!important`) so the email's own root-level styling wins
 *   when present.
 * - Crucially, do NOT force `background-color: transparent` on `body > div`,
 *   `body > table`, or `body > center`. That used to break marketing emails
 *   with branded coloured header bars (Apple, Stripe, GitHub notifications,
 *   etc.) because those wrappers carry the header background.
 * - Images are unaffected — no `filter: invert` or similar tricks.
 *
 * The result: a slightly worse rendering for emails that hardcode
 * `background: white` and don't honour `color-scheme`, but correct
 * rendering for the rich-HTML newsletters that actually matter.
 */
function wrapHtml(
  html: string,
  isDark: boolean,
  colors: ReturnType<typeof useTheme>['colors'],
  strings: WrapStrings,
): string {
  const bgColor = 'transparent';
  const textColor = colors.text;
  const linkColor = colors.primarySubtleForeground;
  const quoteBorderColor = colors.border;
  const quoteTextColor = colors.textSecondary;

  // Strip active content (scripts, forms, event handlers, dangerous URL schemes)
  // BEFORE proxying so untrusted email markup is display-only in both the web
  // iframe and the native WebView.
  const proxyBaseUrl = getProxyBaseUrl();
  const sanitizedHtml = sanitizeEmailHtml(html);
  const proxiedHtml = proxyExternalImages(sanitizedHtml, proxyBaseUrl, strings);

  return `
    <!DOCTYPE html>
    <html${isDark ? ' style="color-scheme: dark;"' : ''}>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
      ${isDark ? '<meta name="color-scheme" content="dark">' : ''}
      <style>
        * { box-sizing: border-box; }
        html, body {
          margin: 0;
          padding: 0;
          background: ${bgColor};
          color: ${textColor};
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 15px;
          line-height: 1.5;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        img { max-width: 100%; height: auto; }
        a { color: ${linkColor}; }
        pre, code { white-space: pre-wrap; word-wrap: break-word; }
        table { max-width: 100%; }
        blockquote {
          margin: 0 0 0 8px;
          padding-left: 12px;
          border-left: 3px solid ${quoteBorderColor};
          color: ${quoteTextColor};
        }
      </style>
    </head>
    <body>${proxiedHtml}</body>
    </html>
  `;
}

function HtmlBodyWeb({ html }: HtmlBodyProps) {
  const { t } = useTranslation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const { mode, colors } = useTheme();
  const isDark = mode === 'dark';
  const videoLinkLabel = t('message.detail.openVideo');
  const audioLinkLabel = t('message.detail.openAudio');

  const wrappedHtml = useMemo(
    () => wrapHtml(html, isDark, colors, { videoLinkLabel, audioLinkLabel }),
    [html, isDark, colors, videoLinkLabel, audioLinkLabel],
  );

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let observer: ResizeObserver | null = null;

    const updateHeight = () => {
      const doc = iframe.contentDocument;
      if (!doc?.body) return;
      const h = doc.body.scrollHeight;
      if (h > 0) setHeight(h);
    };

    const handleLoad = () => {
      const doc = iframe.contentDocument;
      if (!doc?.body) return;

      // Set up observer first to catch fast-resolving cached images
      observer = new ResizeObserver(updateHeight);
      observer.observe(doc.body);

      updateHeight();

      // Guard for images that complete between measurement and observer attach.
      // { once: true } auto-removes the listener after firing — no leak.
      doc.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
        if (!img.complete) {
          img.addEventListener('load', updateHeight, { once: true });
          img.addEventListener('error', updateHeight, { once: true });
        }
      });

      // Intercept link clicks — validate and open safe external links from the parent.
      // Email HTML is attacker-controlled, so never allow the sandbox to open popups directly.
      doc.addEventListener('click', (e: MouseEvent) => {
        const anchor = (e.target as HTMLElement).closest?.('a');
        if (!anchor) return;

        e.preventDefault();
        const safeUrl = getSafeExternalUrl(anchor.getAttribute('href'));
        if (!safeUrl) return;

        window.open(safeUrl, '_blank', 'noopener,noreferrer');
      });
    };

    iframe.addEventListener('load', handleLoad);
    return () => {
      iframe.removeEventListener('load', handleLoad);
      observer?.disconnect();
    };
  }, [wrappedHtml]);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={wrappedHtml}
      style={{
        border: 'none',
        width: '100%',
        height: height ?? 'auto',
        minHeight: height ? undefined : 100,
        display: 'block',
        overflow: 'hidden',
      }}
      sandbox="allow-same-origin"
      title={t('message.detail.emailContent')}
      scrolling="no"
    />
  );
}

let HtmlBodyNative: React.ComponentType<HtmlBodyProps> | null = null;

if (Platform.OS !== 'web') {
  // The native WebView must stay out of the web bundle. This platform guard is
  // intentional: a static import makes Expo's web export resolve native code.
  const { WebView } = require('react-native-webview');

  HtmlBodyNative = function HtmlBodyNativeComponent({ html }: HtmlBodyProps) {
    const { t } = useTranslation();
    const { mode, colors } = useTheme();
    const isDark = mode === 'dark';
    const videoLinkLabel = t('message.detail.openVideo');
    const audioLinkLabel = t('message.detail.openAudio');

    // JavaScript is disabled in the WebView (see props below), so the email body
    // is rendered statically. No height-measuring script is injected; the WebView
    // owns its own scroll instead of growing to fit.
    const wrappedHtml = useMemo(
      () => wrapHtml(html, isDark, colors, { videoLinkLabel, audioLinkLabel }),
      [html, isDark, colors, videoLinkLabel, audioLinkLabel],
    );

    // Open user-clicked safe links in the system browser instead of navigating the WebView.
    const handleNavigation = useCallback(
      (request: {
        url: string;
        navigationType?: string | null;
        isTopFrame?: boolean;
      }) => {
        const { allow, open } = decideNativeNavigation(request);
        if (open) Linking.openURL(open).catch(() => undefined);
        return allow;
      },
      [],
    );

    return (
      <WebView
        // Every URL must reach handleNavigation — see decideNativeNavigation.
        originWhitelist={['*']}
        source={{ html: wrappedHtml }}
        style={styles.webView}
        scalesPageToFit={false}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        onShouldStartLoadWithRequest={handleNavigation}
        javaScriptEnabled={false}
        domStorageEnabled={false}
        startInLoadingState={false}
        cacheEnabled={false}
        mixedContentMode="never"
        setSupportMultipleWindows={false}
      />
    );
  };
}

export function HtmlBody({ html }: HtmlBodyProps) {
  if (Platform.OS === 'web') {
    return <HtmlBodyWeb html={html} />;
  }
  if (HtmlBodyNative) {
    return <HtmlBodyNative html={html} />;
  }
  return null;
}

const styles = StyleSheet.create({
  webView: {
    backgroundColor: 'transparent',
    minHeight: 400,
  },
});
