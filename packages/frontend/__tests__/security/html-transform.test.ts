import { TextEncoder as NodeTextEncoder } from 'node:util';

import {
  proxyExternalImages,
  normalizeContentId,
  resolveCidImages,
  sanitizeEmailHtml,
} from '@/utils/htmlTransform';

Object.defineProperty(globalThis, 'TextEncoder', { value: NodeTextEncoder });

const PROXY = 'https://api.example/email/proxy';

/** The original URL inside a proxy URL, or null when `value` is not one. */
function proxiedUrl(value: string | null | undefined): string | null {
  if (!value?.startsWith(`${PROXY}?url=`)) return null;
  return new TextDecoder().decode(
    Uint8Array.from(atob(new URL(value).searchParams.get('url')!), (c) => c.charCodeAt(0)),
  );
}

function imageSources(html: string): (string | null)[] {
  const document = new DOMParser().parseFromString(html, 'text/html');
  return [...document.querySelectorAll('img')].map((img) => img.getAttribute('src'));
}

/**
 * Every http(s) or protocol-relative URL left in `html` once CSS escapes are
 * decoded and the entities parsed, that is NOT the proxy. A tracker survives
 * only if it shows up here.
 */
function unproxiedUrls(html: string): string[] {
  const decoded = new DOMParser()
    .parseFromString(`<textarea>${html.replace(/<\/textarea/gi, '')}</textarea>`, 'text/html')
    .querySelector('textarea')!
    .value.replace(/\\([0-9a-f]{1,6}) ?/gi, (_m, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/\\(.)/g, '$1');
  return (decoded.match(/(?:https?:|[\\/]{2})[^\s"'()<>]*/gi) ?? []).filter(
    (url) => !url.startsWith(PROXY) && !/^(?:https?:)?[\\/]*$/.test(url),
  );
}

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

  it('proxies URLs that carry a second URL, and withholds only one that does not parse', () => {
    // Gmail's image proxy (the original after `#`), Cloudinary's fetch, and a
    // broken template's concatenation are ordinary URLs the proxy accepts.
    const html = proxyExternalImages(
      '<img src="https://ci3.googleusercontent.com/meips/ADKq_N=s0-d-e1-ft#https://cdn.shop.com/logo.png">' +
        '<img src="https://res.cloudinary.com/demo/image/fetch/https://upload.example/a.jpg">' +
        '<img src="https://cdn.example/logo.svg;a=https://cdn.example/certificate.pem">' +
        '<img src="https://exa mple.com/broken.png">',
      PROXY,
    );
    const sources = imageSources(html);
    expect(sources.slice(0, 3).map(proxiedUrl)).toEqual([
      // The fragment never reaches a server.
      'https://ci3.googleusercontent.com/meips/ADKq_N=s0-d-e1-ft',
      'https://res.cloudinary.com/demo/image/fetch/https://upload.example/a.jpg',
      'https://cdn.example/logo.svg;a=https://cdn.example/certificate.pem',
    ]);
    expect(sources[3]).toMatch(/^data:image\/gif;base64,/);
  });

  it('preserves query parameters and proxies protocol-relative resources after serialization', () => {
    const html = proxyExternalImages(
      sanitizeEmailHtml(
        '<img src="//images.example/a.png?x=1&amp;y=2"><div style="background-image:url(//images.example/b.png)"></div>',
      ),
      'https://api.example/email/proxy',
    );
    const document = new DOMParser().parseFromString(html, 'text/html');
    const url = new URL(document.querySelector('img')!.getAttribute('src')!);
    expect(atob(url.searchParams.get('url')!)).toBe('https://images.example/a.png?x=1&y=2');
    expect(document.querySelector('div')?.getAttribute('style')).toContain(
      'https://api.example/email/proxy',
    );
  });

  it('drops foreign content, where <style> hides markup from the sanitizer', () => {
    const html = sanitizeEmailHtml(
      '<svg><style><img src=https://tracker.example/p.gif></style></svg><p>hi</p>',
    );
    expect(html).not.toMatch(/svg|tracker/);
    expect(html).toContain('<p>hi</p>');
  });

  it('proxies every remote media URL a browser would load, whatever its case or padding', () => {
    const html = proxyExternalImages(
      '<img src=" HTTPS://tracker.example/a.gif"><video poster="https://tracker.example/b.gif"><source src="https://tracker.example/c.mp4"></video>' +
        '<div style="background-image:image-set(\'https://tracker.example/d.png\' 1x)"></div><a href="https://site.example/">link</a>',
      'https://api.example/email/proxy',
    );
    // The <video> is a link now (see "video and audio"): a link loads nothing.
    expect(html.replace(/<a [^>]*>[^<]*<\/a>/g, '')).not.toMatch(
      /(["'(\s])https?:\/\/tracker\.example/i,
    );
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
    expect(
      resolveCidImages('<img src="cid:known"><img src="cid:unknown">', {
        known: 'https://files.example/known',
      }),
    ).toBe('<img src="https://files.example/known"><img src="cid:unknown">');
  });

  describe('tracking-proxy bypasses', () => {
    const rewrite = (html: string) => proxyExternalImages(sanitizeEmailHtml(html), PROXY);

    it('proxies backslash, slash-less and protocol-relative URLs, as a browser reads them', () => {
      // The detector itself sees through entities and CSS escapes.
      expect(
        unproxiedUrls(
          '<img src="https://t.example/x.gif"><i style="background:u\\72l(&quot;\\68ttps://t.example/y.gif&quot;)">',
        ),
      ).toEqual(['https://t.example/x.gif', 'https://t.example/y.gif']);
      const html = rewrite(
        '<img src="https:\\\\t.example\\a.gif"><img src="https:t.example/b.gif"><img src="\\\\t.example\\c.gif">' +
          '<img src="/\\t.example/d.gif"><img src="HTTPS://t.example/e.gif">' +
          '<img srcset="https:\\\\t.example\\f.gif 1x, //t.example/g.gif 2x">' +
          '<div style="background:url(https:\\\\t.example\\h.gif)"></div>',
      );
      expect(unproxiedUrls(html)).toEqual([]);
      expect(imageSources(html).slice(0, 5).map(proxiedUrl)).toEqual([
        'https://t.example/a.gif',
        'https://t.example/b.gif',
        // The sanitizer already refuses a scheme-less `\\host` src outright.
        null,
        'https://t.example/d.gif',
        'https://t.example/e.gif',
      ]);
      // On its own, the proxy pass reads it as the browser does: another host.
      expect(
        proxiedUrl(imageSources(proxyExternalImages('<img src="\\\\t.example\\c.gif">', PROXY))[0]),
      ).toBe('https://t.example/c.gif');
      const srcset = new DOMParser()
        .parseFromString(html, 'text/html')
        .querySelectorAll('img')[5]
        .getAttribute('srcset')!;
      expect(srcset.split(', ').map((candidate) => proxiedUrl(candidate.split(' ')[0]))).toEqual([
        'https://t.example/f.gif',
        'https://t.example/g.gif',
      ]);
    });

    it('decodes CSS escapes before deciding what loads', () => {
      const html = rewrite(
        '<style>div{background:u\\72l(https://t.example/a.gif)} p{background:\\75 rl("https://t.example/b.gif")}' +
          '@\\69mport "https://t.example/c.css"; @import url(https://t.example/d.css) screen;</style>' +
          '<div style="background-image:u\\72l(https://t.example/e.gif)">x</div>',
      );
      expect(unproxiedUrls(html)).toEqual([]);
      expect(html).not.toMatch(/import/i);
      expect(html.match(/api\.example\/email\/proxy/g)).toHaveLength(3);
    });

    it('reads quotes inside quoted URLs the way CSS does', () => {
      const html = rewrite(
        '<style>a{background:url("https://t.example/a\'b.gif")} b{list-style:url("https://t.example/q\\"q.gif")}' +
          ' i{background:url(https://t.example/x\\).gif)} u{background:url("https://t.example/p.gif?x=\')")}</style>' +
          '<div style=\'background:url("https://t.example/c&#39;d.gif")\'>x</div>',
      );
      expect(unproxiedUrls(html)).toEqual([]);
      const document = new DOMParser().parseFromString(html, 'text/html');
      const css = [
        ...[...document.querySelectorAll('style')].map((style) => style.textContent),
        ...[...document.querySelectorAll('[style]')].map((element) =>
          element.getAttribute('style'),
        ),
      ].join('\n');
      const proxied = [...css.matchAll(/url\("([^"]+)"\)/g)].map((match) => proxiedUrl(match[1]));
      expect(proxied).toEqual([
        "https://t.example/a'b.gif",
        'https://t.example/q%22q.gif',
        'https://t.example/x).gif',
        'https://t.example/p.gif?x=%27)',
        "https://t.example/c'd.gif",
      ]);
    });

    it('proxies image-set() strings and keeps local references untouched', () => {
      const html = rewrite(
        '<style>a{background:image-set("https://t.example/1x.png" 1x, url(https://t.example/2x.png) 2x)}' +
          ' b{behavior:url(#default#VML);background:url(cid:logo@x)}</style>',
      );
      expect(unproxiedUrls(html)).toEqual([]);
      expect(html).toContain('url("#default#VML")');
      expect(html).toContain('url("cid:logo@x")');
    });

    it('drops a stylesheet that would still load something unrouted', () => {
      // `--x` is a string, not a URL, until var() puts it in image-set().
      const html = rewrite(
        '<style>:root{--x:"https://t.example/var.gif"} a{background:image-set(var(--x) 1x)}</style><p style="color:red">x</p>',
      );
      expect(unproxiedUrls(html)).toEqual([]);
      expect(html).toContain('<style></style>');
      expect(html).toContain('style="color:red"');
    });

    it('does not rewrite url( in the text of the mail', () => {
      expect(sanitizeEmailHtml('<p>call url(foo) or @import x;</p>')).toBe(
        '<p>call url(foo) or @import x;</p>',
      );
    });
  });

  describe('video and audio', () => {
    it('become their fallback content and a link to the original, never a load', () => {
      const html = proxyExternalImages(
        sanitizeEmailHtml(
          '<video poster="https://t.example/poster.jpg" src="https://cdn.example/clip.mp4"><track src="https://t.example/subs.vtt">Your client cannot play video.</video>' +
            '<audio><source src="https:\\\\cdn.example\\song.mp3"></audio><audio src="javascript:alert(1)"></audio>',
        ),
        PROXY,
        { videoLinkLabel: 'Open video', audioLinkLabel: 'Open audio' },
      );
      const document = new DOMParser().parseFromString(html, 'text/html');
      expect(document.querySelector('video, audio, source, track')).toBeNull();
      expect(
        [...document.querySelectorAll('a')].map((a) => [a.getAttribute('href'), a.textContent]),
      ).toEqual([
        ['https://cdn.example/clip.mp4', 'Open video'],
        ['https://cdn.example/song.mp3', 'Open audio'],
      ]);
      expect(document.body.textContent).toContain('Your client cannot play video.');
      expect(html).not.toMatch(/t\.example|javascript/);
    });

    it('labels the link with its URL when no label is given', () => {
      expect(proxyExternalImages('<video src="https://cdn.example/a.mp4"></video>', PROXY)).toBe(
        '<a href="https://cdn.example/a.mp4">https://cdn.example/a.mp4</a>',
      );
    });
  });

  it('removes hyperlink-auditing pings', () => {
    expect(
      sanitizeEmailHtml('<a href="https://site.example/" ping="https://t.example/ping">x</a>'),
    ).not.toContain('ping');
  });
});
