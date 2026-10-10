import { TextEncoder as NodeTextEncoder } from 'node:util';

import {
  proxyExternalImages,
  normalizeContentId,
  resolveCidImages,
  sanitizeEmailHtml,
} from '@/utils/htmlTransform';

Object.defineProperty(globalThis, 'TextEncoder', { value: NodeTextEncoder });

describe('email HTML security boundary', () => {
  it('removes active content and rejects dangerous URLs in normal attributes', () => {
    const html = sanitizeEmailHtml(
      '<script>alert(1)</script><a href="javascript:alert(1)" onclick="steal()">link</a><img src="data:text/html,bad">',
    );

    expect(html).not.toContain('<script');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('data:text/html');
  });

  it('filters browser-parsed attributes, including slash separators and encoded URLs', () => {
    const html = sanitizeEmailHtml(
      '<img/onerror="alert(1)" src="missing"><a href="java&#x73;cript:alert(1)">link</a>',
    );
    const document = new DOMParser().parseFromString(html, 'text/html');
    expect(document.querySelector('img')?.hasAttribute('onerror')).toBe(false);
    expect(document.querySelector('a')?.hasAttribute('href')).toBe(false);
  });

  it('removes nested active documents and preserves encoded text and query strings', () => {
    const html = sanitizeEmailHtml(
      '<noscript><img src=x onerror=alert(1)></noscript><iframe srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"></iframe>' +
      '<p>&lt;script&gt; is text</p><a href="https://example.com/?a=1&amp;b=2">link</a>',
    );
    const document = new DOMParser().parseFromString(html, 'text/html');
    expect(document.querySelector('noscript, iframe, script')).toBeNull();
    expect(document.querySelector('p')?.textContent).toBe('<script> is text');
    expect(document.querySelector('a')?.getAttribute('href')).toBe('https://example.com/?a=1&b=2');
  });

  it('rejects an entire responsive image source when one candidate is unsafe', () => {
    const html = sanitizeEmailHtml(
      '<img srcset="https://images.example/a.jpg 1x, javascript:alert(1) 2x">',
    );

    expect(html).not.toContain('srcset');
  });

  it('proxies responsive images from both img and source elements', () => {
    const html = proxyExternalImages(
      '<img srcset="https://images.example/a.jpg 1x"><picture><source srcset="https://images.example/b.jpg 2x"></picture>',
      'https://api.example/email/proxy',
    );

    expect((html.match(/https:\/\/api\.example\/email\/proxy\?url=/g) ?? []).length).toBe(2);
  });

  it('resolves conventional favicons through Clarity without sending email data', () => {
    const html = proxyExternalImages(
      '<img src="https://example.com/favicon.ico">',
      'https://api.example/email/proxy',
    );

    expect(html).not.toContain('/email/proxy');
    // Only the domain leaves: @clarity.surf/sdk >=0.4 serves it from Clarity itself.
    expect(html).toContain('src="https://api.clarity.surf/favicons/example.com"');
  });

  it('does not proxy malformed image URLs containing a second absolute URL', () => {
    const malformed =
      'https://cdn.example/logo.svg;a=https://cdn.example/certificate.pem';
    const html = proxyExternalImages(
      `<img src="${malformed}">`,
      'https://api.example/email/proxy',
    );

    expect(html).toContain('data:image/gif;base64,');
    expect(html).not.toContain('/email/proxy');
  });

  it('preserves query parameters and proxies protocol-relative resources after serialization', () => {
    const html = proxyExternalImages(sanitizeEmailHtml(
      '<img src="//images.example/a.png?x=1&amp;y=2"><div style="background-image:url(//images.example/b.png)"></div>',
    ), 'https://api.example/email/proxy');
    const document = new DOMParser().parseFromString(html, 'text/html');
    const url = new URL(document.querySelector('img')!.getAttribute('src')!);
    expect(atob(url.searchParams.get('url')!)).toBe('https://images.example/a.png?x=1&y=2');
    expect(document.querySelector('div')?.getAttribute('style')).toContain('https://api.example/email/proxy');
  });

  it('drops foreign content, where <style> hides markup from the sanitizer', () => {
    const html = sanitizeEmailHtml('<svg><style><img src=https://tracker.example/p.gif></style></svg><p>hi</p>');
    expect(html).not.toMatch(/svg|tracker/);
    expect(html).toContain('<p>hi</p>');
  });

  it('proxies every remote media URL a browser would load, whatever its case or padding', () => {
    const html = proxyExternalImages(
      '<img src=" HTTPS://tracker.example/a.gif"><video poster="https://tracker.example/b.gif"><source src="https://tracker.example/c.mp4"></video>' +
        '<div style="background-image:image-set(\'https://tracker.example/d.png\' 1x)"></div><a href="https://site.example/">link</a>',
      'https://api.example/email/proxy',
    );
    expect(html).not.toMatch(/(["'(\s])https?:\/\/tracker\.example/i);
    expect(html).toContain('href="https://site.example/"');
  });

  it('matches a stored <Content-ID> to its bare, encoded or CSS cid: reference', () => {
    // The API stores the header as written, brackets included.
    const map = { [normalizeContentId('<Logo@Example.com>')]: 'https://files.example/logo' };
    expect(
      resolveCidImages(
        '<img src=cid:logo%40example.com><img src="cid:logo@example.com"><td style="background:url(cid:logo@example.com)">',
        map,
      ),
    ).toBe(
      '<img src=https://files.example/logo><img src="https://files.example/logo"><td style="background:url(https://files.example/logo)">',
    );
  });

  it('resolves only known CID attachments', () => {
    expect(resolveCidImages('<img src="cid:known"><img src="cid:unknown">', {
      known: 'https://files.example/known',
    })).toBe('<img src="https://files.example/known"><img src="cid:unknown">');
  });
});
