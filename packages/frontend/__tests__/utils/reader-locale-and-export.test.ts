/**
 * The reader's dates in the app's chosen locale, calendar export to RFC 5545,
 * printing, reminder presets and the native WebView's navigation gate.
 */

import { TextEncoder as NodeTextEncoder } from 'node:util';

jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: (k: string) => k, locale: 'en-US' }),
}));
// Only the components' pure helpers are under test; their UI kit is not loaded.
jest.mock('@oxy.so/bloom/theme', () => ({ useTheme: () => ({}) }));
jest.mock('@oxy.so/bloom/button', () => ({ Button: () => null, IconButton: () => null }));
jest.mock('@oxy.so/bloom/checkbox', () => ({ Checkbox: () => null }));
jest.mock('@oxy.so/bloom/icons', () => ({ RiDeleteBinLine: () => null, RiCloseLine: () => null }));
jest.mock('@oxy.so/bloom/item', () => ({ Item: () => null }));
jest.mock('@oxy.so/bloom/bottom-sheet', () => ({ BottomSheet: () => null }));
jest.mock('@oxy.so/bloom/text-field', () => ({ TextFieldInput: () => null }));
jest.mock('@oxy.so/bloom/typography', () => ({ Text: () => null }));
jest.mock('react-native-webview', () => ({ WebView: () => null }));
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  StyleSheet: { create: <T>(styles: T) => styles },
}));

import { decideNativeNavigation } from '@/components/HtmlBody';
import { getReminderPresets } from '@/components/CreateReminderSheet';
import { formatReminderTime } from '@/components/ReminderRow';
import { calendarTimes, generateIcs } from '@/utils/calendarEvent';
import { formatCardDate, formatMoney } from '@/utils/cardFormat';
import { buildPrintHtml } from '@/utils/printMessage';

Object.defineProperty(globalThis, 'TextEncoder', { value: NodeTextEncoder });

const t = ((key: string, vars?: Record<string, string>) =>
  vars ? `${key}(${Object.values(vars).join('|')})` : key) as never;

describe('calendar export', () => {
  const times = calendarTimes({ startTime: '2026-10-15T12:00:00Z' })!;

  it('escapes semicolons, commas and backslashes in TEXT', () => {
    const ics = generateIcs({ title: 'Lunch; bring a snack, or not \\ maybe' } as never, times);
    expect(ics).toContain(String.raw`SUMMARY:Lunch\; bring a snack\, or not \\ maybe`);
  });

  it('folds at 75 octets without splitting a character', () => {
    const title = `Launch ${'🎉'.repeat(30)} ${'日本語'.repeat(20)}`;
    const ics = generateIcs({ title } as never, times);
    const lines = ics.split('\r\n');
    const encoder = new NodeTextEncoder();
    for (const line of lines) expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    // Unfolding gives back the text exactly — no half emoji anywhere.
    const unfolded = ics.replace(/\r\n /g, '');
    expect(unfolded).toContain(`SUMMARY:${title}`);
    expect(unfolded).not.toContain('�');
    expect(lines.some((line) => /[\uD800-\uDBFF]$/.test(line))).toBe(false);
  });
});

describe('dates in the app locale, not the device locale', () => {
  it('formats card dates and amounts in the locale it is given', () => {
    expect(formatCardDate('de-DE', '2026-10-15', { month: 'short', day: 'numeric' })).toBe(
      '15. Okt.',
    );
    expect(formatCardDate('en-US', '2026-10-15', { month: 'short', day: 'numeric' })).toBe(
      'Oct 15',
    );
    expect(formatMoney('de-DE', 1234.5, 'EUR')).toMatch(/^1\.234,50\s€$/);
  });

  it('formats reminder times in the locale it is given', () => {
    const now = new Date(2026, 9, 12, 8, 0);
    expect(formatReminderTime(new Date(2026, 9, 20, 9, 0).toISOString(), t, 'de-DE', now)).toBe(
      `time.dayAt(Di., 20. Okt.|${new Date(2026, 9, 20, 9, 0).toLocaleTimeString('de-DE', { hour: 'numeric', minute: '2-digit' })})`,
    );
    expect(formatReminderTime(new Date(2026, 9, 20, 9, 0).toISOString(), t, 'en-US', now)).toMatch(
      /^time\.dayAt\(Tue, Oct 20\|9:00\sAM\)$/,
    );
  });
});

describe('reminder days across a DST change', () => {
  // The first day of 2026 that is not 24 hours long here, if this zone has one.
  const shortDay = (() => {
    for (
      let day = new Date(2026, 0, 1);
      day.getFullYear() === 2026;
      day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
    ) {
      const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
      if (next.getTime() - day.getTime() < 86_400_000) return day;
    }
    return new Date(2026, 2, 29);
  })();

  it('calls the day after a 23-hour day "tomorrow"', () => {
    const now = new Date(shortDay.getFullYear(), shortDay.getMonth(), shortDay.getDate(), 1, 0);
    const tomorrow = new Date(
      shortDay.getFullYear(),
      shortDay.getMonth(),
      shortDay.getDate() + 1,
      0,
      30,
    );
    expect(formatReminderTime(tomorrow.toISOString(), t, 'en-US', now)).toMatch(
      /^time\.tomorrowAt/,
    );
    const later = new Date(shortDay.getFullYear(), shortDay.getMonth(), shortDay.getDate(), 23, 30);
    expect(formatReminderTime(later.toISOString(), t, 'en-US', now)).toMatch(/^time\.todayAt/);
  });
});

describe('reminder presets', () => {
  const labels = (now: Date) =>
    getReminderPresets(now).map((preset) => preset.label.split('.').pop());

  it('offers no "this weekend" on a weekend, and one Monday 9:00 on a Sunday', () => {
    expect(labels(new Date(2026, 9, 10, 10, 0))).toEqual([
      'laterToday',
      'tomorrowMorning',
      'nextWeek',
    ]); // Saturday
    expect(labels(new Date(2026, 9, 11, 10, 0))).toEqual(['laterToday', 'tomorrowMorning']); // Sunday
    expect(labels(new Date(2026, 9, 14, 22, 0))).toEqual([
      'tomorrowMorning',
      'thisWeekend',
      'nextWeek',
    ]); // Wednesday night
  });
});

describe('print', () => {
  const message = {
    subject: 'Report',
    from: { name: 'Ann', address: 'ann@example.com' },
    to: [{ address: 'bob@example.com' }],
    cc: [{ address: 'cy@example.com' }],
    text: '',
    // As the reader has it: cid: already resolved to the signed attachment URL.
    html: '<p>Chart</p><img src="https://cloud.oxy.so/files/chart.png">',
  };

  it('uses the translated labels and the resolved inline images', () => {
    const html = buildPrintHtml(message as never, {
      noSubject: '(sin asunto)',
      date: '12 oct 2026',
      labels: { from: 'De:', to: 'Para:', cc: 'Cc:', date: 'Fecha:' },
    });
    for (const label of ['De:', 'Para:', 'Cc:', 'Fecha:'])
      expect(html).toContain(`<span class="label">${label}</span>`);
    expect(html).not.toMatch(/>From:|>To:|>Date:/);
    expect(html).toContain('src="https://cloud.oxy.so/files/chart.png"');
  });
});

describe('native WebView navigation', () => {
  it('lets the WebView load only its own document, and opens safe taps outside it', () => {
    expect(decideNativeNavigation({ url: 'about:blank' })).toEqual({ allow: true, open: null });
    expect(decideNativeNavigation({ url: 'about:blank#section' })).toEqual({
      allow: true,
      open: null,
    });
    expect(
      decideNativeNavigation({ url: 'https://site.example/a', navigationType: 'click' }),
    ).toEqual({
      allow: false,
      open: 'https://site.example/a',
    });
    expect(
      decideNativeNavigation({ url: 'mailto:ann@example.com', navigationType: 'other' }).open,
    ).toBe('mailto:ann@example.com');
  });

  it('never opens other schemes or subframe loads', () => {
    for (const url of [
      'intent://scan/#Intent;scheme=zxing;end',
      'javascript:alert(1)',
      'data:text/html,x',
      'sms:123',
      'file:///etc/hosts',
    ]) {
      expect(decideNativeNavigation({ url, navigationType: 'click' })).toEqual({
        allow: false,
        open: null,
      });
    }
    expect(decideNativeNavigation({ url: 'https://t.example/', isTopFrame: false })).toEqual({
      allow: false,
      open: null,
    });
  });
});
