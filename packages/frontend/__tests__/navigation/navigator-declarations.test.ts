/**
 * On expo-router 58 a Tabs or Drawer navigator renders a child route only when
 * its layout declares it, and a Tabs child declared with `href: null` does not
 * render either. Loading such a route's URL shows the navigator's FIRST screen
 * instead: no error, no warning, the wrong page. Measured with a probe app on
 * expo-router 58.0.23 (Inbox's settings pages would all have opened the inbox);
 * 57.0.9 rendered every one of them. This reads the layouts and the app/ tree
 * and fails when a Tabs/Drawer child is undeclared or hidden with `href: null`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const APP_DIR = path.join(__dirname, '..', '..', 'app');
const ROUTE_FILE = /\.(tsx|ts|jsx|js)$/;

/** Route names a navigator in `dir` sees: files, and directories that own a layout. */
function childRoutes(dir: string, prefix = ''): string[] {
  const routes: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      const ownsLayout = fs.readdirSync(full).some((f) => /^_layout\.(tsx|ts|jsx|js)$/.test(f));
      routes.push(...(ownsLayout ? [name] : childRoutes(full, name)));
    } else if (ROUTE_FILE.test(entry.name) && !/^[_+]/.test(entry.name)) {
      routes.push(name.replace(ROUTE_FILE, ''));
    }
  }
  return routes.sort();
}

function layoutFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return layoutFiles(full);
    return /^_layout\.(tsx|ts)$/.test(entry.name) ? [full] : [];
  });
}

const navigatorLayouts = layoutFiles(APP_DIR)
  .map((file) => ({ file, source: fs.readFileSync(file, 'utf8') }))
  .filter(({ source }) => /<(Tabs|Drawer)[\s>]/.test(source));

describe('expo-router 58 Tabs/Drawer navigators declare every child route', () => {
  it('finds the navigators it is meant to check', () => {
    // Without this the suite passes vacuously when the tree moves.
    const relative = navigatorLayouts.map(({ file }) => path.relative(APP_DIR, file));
    expect(relative).toContain(path.join('(drawer)', '(tabs)', '_layout.tsx'));
    const tabsDir = path.join(APP_DIR, '(drawer)', '(tabs)');
    expect(childRoutes(tabsDir)).toEqual(
      expect.arrayContaining(['(inbox)', 'search', 'settings/about', 'subscriptions']),
    );
  });

  it.each(navigatorLayouts.map(({ file, source }) => [path.relative(APP_DIR, file), file, source]))(
    '%s declares each child once and hides none with href: null',
    (_name, file, source) => {
      const declared = [...source.matchAll(/<(?:Tabs|Drawer)\.Screen\s+name="([^"]+)"/g)]
        .map((match) => match[1])
        .sort();
      expect(declared).toEqual(childRoutes(path.dirname(file)));
      expect(source).not.toMatch(/\bhref:\s*null\s*[,}]/);
    },
  );
});
