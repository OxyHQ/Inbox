import { useEffect } from 'react';
import { act, render } from '@testing-library/react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { LocaleProvider, useLocale } from '@/lib/i18n/locale-context';
import { useTranslation } from '@/lib/i18n/use-translation';

let currentLanguage = 'en-US';
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({
    currentLanguage,
    currentLanguages: [currentLanguage],
    isAuthenticated: false,
    setLanguage: jest.fn(),
  }),
  useUpdateProfile: () => ({ mutateAsync: jest.fn() }),
}));
jest.mock('@oxy.so/bloom/locale', () => ({
  LocaleProvider: ({ children }: { children: unknown }) => children,
}));
jest.mock('@oxy.so/bloom/toast', () => ({ toast: { info: jest.fn() } }));
jest.mock('react-native', () => ({ Platform: { OS: 'web' }, I18nManager: {} }));

const mounts = jest.fn();
const unmounts = jest.fn();
const renderedLocales: string[] = [];

function InboxTitle() {
  const { locale } = useLocale();
  const { t } = useTranslation();
  renderedLocales.push(locale);
  useEffect(() => {
    mounts();
    return unmounts;
  }, []);
  return <h1 data-locale={locale}>{t('drawer.mailboxes.Inbox')}</h1>;
}

function App() {
  return (
    <LocaleProvider>
      <InboxTitle />
    </LocaleProvider>
  );
}

beforeEach(() => {
  currentLanguage = 'en-US';
  renderedLocales.length = 0;
  jest.clearAllMocks();
});

it('uses the SDK language immediately for a client-only mount', () => {
  currentLanguage = 'es-ES';
  const view = render(<App />);
  expect(renderedLocales).toEqual(['es-ES']);
  expect(view.getByRole('heading').dataset.locale).toBe('es-ES');
});

it.each([
  ['es-ES', 'ltr'],
  ['ar-SA', 'rtl'],
])(
  'hydrates the exported English shell before applying %s without replacing it',
  async (language, direction) => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(<App />);
    document.body.appendChild(container);
    const originalHeading = container.querySelector('h1');
    expect(originalHeading?.textContent).toBe('Inbox');

    currentLanguage = language;
    renderedLocales.length = 0;
    const onRecoverableError = jest.fn();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    let root: Root | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, <App />, { onRecoverableError });
      });
      expect(renderedLocales[0]).toBe('en-US');
      expect(container.querySelector('h1')).toBe(originalHeading);
      expect(originalHeading?.dataset.locale).toBe(language);
      expect(originalHeading?.textContent).not.toBe('Inbox');
      expect(document.documentElement.lang).toBe(language);
      expect(document.documentElement.dir).toBe(direction);
      expect(mounts).toHaveBeenCalledTimes(1);
      expect(unmounts).not.toHaveBeenCalled();
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();

      currentLanguage = 'en-US';
      await act(async () => root?.render(<App />));
      expect(container.querySelector('h1')).toBe(originalHeading);
      expect(originalHeading?.textContent).toBe('Inbox');
      expect(document.documentElement.dir).toBe('ltr');
      expect(mounts).toHaveBeenCalledTimes(1);
      expect(unmounts).not.toHaveBeenCalled();
    } finally {
      await act(async () => root?.unmount());
      consoleError.mockRestore();
      container.remove();
    }
  },
);
