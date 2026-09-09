import { TextEncoder as NodeTextEncoder } from 'node:util';

import {
  proxyExternalImages,
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

  it('resolves conventional favicons by hostname through the privacy proxy', () => {
    const html = proxyExternalImages(
      '<img src="https://example.com/favicon.ico">',
      'https://api.example/email/proxy',
    );

    expect(html).toContain('/email/proxy');
    const encoded = new URL(html.match(/src="([^"]+)/)?.[1] ?? '').searchParams.get('url');
    expect(Buffer.from(encoded ?? '', 'base64').toString('utf8')).toBe(
      'https://www.google.com/s2/favicons?sz=64&domain_url=example.com',
    );
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

  it('resolves only known CID attachments', () => {
    expect(resolveCidImages('<img src="cid:known"><img src="cid:unknown">', {
      known: 'https://files.example/known',
    })).toBe('<img src="https://files.example/known"><img src="cid:unknown">');
  });
});
