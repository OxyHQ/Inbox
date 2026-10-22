import { InboxStartup } from '@/components/InboxStartup';
import { act, render } from '@testing-library/react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import type { ReactNode } from 'react';

let mockAlone = true;
jest.mock('@oxy.so/bloom/app-shell', () => ({
  AppShellPanelVisibility: ({ when, children }: { when: string; children: ReactNode }) => (
    <div hidden={when === 'alone' && !mockAlone}>{children}</div>
  ),
}));
jest.mock('@oxy.so/bloom/screen', () => ({
  Screen: ({ header }: { header?: ReactNode }) => <main>{header}</main>,
}));
jest.mock('@oxy.so/bloom/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: () => 'Inbox' }) }));

afterEach(() => {
  mockAlone = true;
});

it('keeps the pending title in the sole server panel until the compositor adds its list sibling', async () => {
  // The server's compact composition can also be painted by a desktop browser.
  // Hiding its only heading with lg:hidden left the entire first paint empty.
  const container = document.createElement('div');
  container.innerHTML = renderToString(<InboxStartup detail />);
  document.body.appendChild(container);
  const originalPanel = container.querySelector('main');
  const originalHeading = container.querySelector('h1');
  expect(originalHeading?.textContent).toBe('Inbox');
  const recoverableError = jest.fn();
  let root: Root | undefined;
  try {
    await act(async () => {
      root = hydrateRoot(container, <InboxStartup detail />, {
        onRecoverableError: recoverableError,
      });
    });
    expect(container.querySelector('main')).toBe(originalPanel);
    expect(container.querySelector('h1')).toBe(originalHeading);
    expect(recoverableError).not.toHaveBeenCalled();
    mockAlone = false;
    await act(async () => root?.render(<InboxStartup detail />));
    expect(container.querySelector('main')).toBe(originalPanel);
    expect(container.querySelector('h1')).toBe(originalHeading);
    expect(originalHeading?.parentElement?.hidden).toBe(true);
  } finally {
    await act(async () => root?.unmount());
    container.remove();
  }
});

it('keeps the list title when the reading panel is beside it', () => {
  mockAlone = false;
  const view = render(<InboxStartup />);
  expect(view.getByRole('heading', { name: 'Inbox' })).toBeTruthy();
});
