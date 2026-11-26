/**
 * The AI and notification settings pages: each switch shows its preference and writes that one.
 */

const mockPlatform = { OS: 'ios' };
jest.mock('react-native', () => ({ Platform: mockPlatform }));
const mockSetPref = jest.fn();
const mockPrefs = {
  aiBrief: true,
  aiSmartReply: false,
  aiThreadSummary: true,
  aiCategorization: false,
  pushNotifications: true,
};
jest.mock('@/contexts/inbox-prefs-context', () => ({
  useInboxPrefs: () => ({ prefs: mockPrefs, setPref: mockSetPref }),
}));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import { fireEvent, render, screen } from '@testing-library/react';

import { AISection } from '@/components/settings/sections/AISection';
import { NotificationsSection } from '@/components/settings/sections/NotificationsSection';

const checked = (name: string) => (screen.getByLabelText(name) as HTMLInputElement).checked;

beforeEach(() => {
  mockSetPref.mockClear();
  mockPlatform.OS = 'ios';
});

describe('AISection', () => {
  it('shows each feature switch with its preference', () => {
    render(<AISection />);
    expect(checked('ui.settings.ai.recap')).toBe(true);
    expect(checked('ui.settings.ai.suggestions')).toBe(false);
    expect(checked('ui.settings.ai.summaryTitle')).toBe(true);
    expect(checked('ui.settings.ai.priorityTitle')).toBe(false);
    expect(screen.getByText('ui.settings.ai.tip')).toBeTruthy();
  });

  it('writes the preference of the switch that was pressed', () => {
    render(<AISection />);
    fireEvent.click(screen.getByLabelText('ui.settings.ai.suggestions'));
    expect(mockSetPref).toHaveBeenCalledWith('aiSmartReply', true);
    fireEvent.click(screen.getByLabelText('ui.settings.ai.recap'));
    expect(mockSetPref).toHaveBeenLastCalledWith('aiBrief', false);
  });
});

describe('NotificationsSection', () => {
  it('offers the push switch on a device', () => {
    render(<NotificationsSection />);
    fireEvent.click(screen.getByLabelText('ui.settings.notifications.push'));
    expect(mockSetPref).toHaveBeenCalledWith('pushNotifications', false);
    expect(screen.getByText('ui.settings.notifications.deviceNotice')).toBeTruthy();
  });

  it('explains instead of offering a switch on the web', () => {
    mockPlatform.OS = 'web';
    render(<NotificationsSection />);
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByText('ui.settings.notifications.webNotice')).toBeTruthy();
  });
});
