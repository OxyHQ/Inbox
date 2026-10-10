/**
 * The layout direction follows the UI language, not the device: an English UI
 * on an Arabic phone came up mirrored, because `allowRTL(true)` ran
 * unconditionally and RN then followed the device's direction.
 */

const I18nManager = { isRTL: false, allowRTL: jest.fn(), forceRTL: jest.fn() };
const Platform = { OS: 'android' as string };
jest.mock('react-native', () => ({ I18nManager, Platform }));

const toast = { info: jest.fn() };
jest.mock('@oxy.so/bloom/toast', () => ({ toast }));
jest.mock('@oxy.so/bloom/locale', () => ({
  LocaleProvider: ({ children }: { children: unknown }) => children,
}));

let currentLanguage = 'en-US';
jest.mock('@oxy.so/services', () => ({
  useOxy: () => ({
    currentLanguage,
    currentLanguages: [currentLanguage],
    isAuthenticated: false,
    setLanguage: jest.fn(),
  }),
  useUpdateProfile: () => ({ mutateAsync: jest.fn() }),
}));

import { act, render } from '@testing-library/react';

import { applyNativeLayoutDirection, LocaleProvider } from '@/lib/i18n/locale-context';
import en from '@/lib/i18n/locales/en';

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  I18nManager.isRTL = false;
  Platform.OS = 'android';
  currentLanguage = 'en-US';
});

afterEach(() => jest.useRealTimers());

describe('applyNativeLayoutDirection', () => {
  it('allows and forces exactly the direction asked for', () => {
    applyNativeLayoutDirection(false);
    expect(I18nManager.allowRTL).toHaveBeenCalledWith(false);
    expect(I18nManager.forceRTL).toHaveBeenCalledWith(false);
    applyNativeLayoutDirection(true);
    expect(I18nManager.allowRTL).toHaveBeenLastCalledWith(true);
    expect(I18nManager.forceRTL).toHaveBeenLastCalledWith(true);
  });

  it('reports a restart is needed only when the running direction differs', () => {
    I18nManager.isRTL = true;
    expect(applyNativeLayoutDirection(false)).toBe(true);
    expect(applyNativeLayoutDirection(true)).toBe(false);
  });

  it('leaves the web alone: the document `dir` is what counts there', () => {
    Platform.OS = 'web';
    I18nManager.isRTL = true;
    expect(applyNativeLayoutDirection(false)).toBe(false);
    expect(I18nManager.forceRTL).not.toHaveBeenCalled();
  });
});

describe('LocaleProvider', () => {
  it('asks for a restart when an LTR language runs mirrored on an RTL device', () => {
    I18nManager.isRTL = true;
    render(<LocaleProvider>{null}</LocaleProvider>);
    expect(I18nManager.allowRTL).toHaveBeenCalledWith(false);
    expect(toast.info).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(toast.info.mock.calls[0][0]).toBe(en.ui.layoutDirection.restartRequired);
  });

  it('says nothing when the direction already matches', () => {
    I18nManager.isRTL = true;
    currentLanguage = 'ar-SA';
    render(<LocaleProvider>{null}</LocaleProvider>);
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(I18nManager.forceRTL).toHaveBeenCalledWith(true);
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('says nothing for a direction that was only wrong while the locale settled', () => {
    I18nManager.isRTL = true;
    const view = render(<LocaleProvider>{null}</LocaleProvider>);
    currentLanguage = 'ar-SA';
    view.rerender(<LocaleProvider>{null}</LocaleProvider>);
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(toast.info).not.toHaveBeenCalled();
  });
});
