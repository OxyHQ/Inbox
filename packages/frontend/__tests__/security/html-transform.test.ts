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

  it('resolves only known CID attachments', () => {
    expect(resolveCidImages('<img src="cid:known"><img src="cid:unknown">', {
      known: 'https://files.example/known',
    })).toBe('<img src="https://files.example/known"><img src="cid:unknown">');
  });
});
