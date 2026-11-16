import { act, render } from '@testing-library/react';
import type { ListItemProps } from '@oxy.so/bloom/list';
import type { ReactNode } from 'react';
import { MessageRow } from '@/components/MessageRow';
import { MessageSchema } from '@/schemas/emailSchemas';
import { wireMessage } from '../fixtures/wire';

let mockRow: ListItemProps;
jest.mock('@oxy.so/bloom/list', () => ({
  ListItem: (props: ListItemProps) => {
    mockRow = props;
    return <div>{props.attachments}</div>;
  },
}));
jest.mock('react-native', () => ({
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  StyleSheet: { create: (s: unknown) => s },
}));
jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'en' }),
}));
jest.mock('@oxy.so/bloom/theme', () => ({ useThemePaint: () => ({}) }));
jest.mock('@oxy.so/bloom/chip', () => ({ Chip: () => null }));
jest.mock('@/hooks/queries/useLabels', () => ({ useLabels: () => ({ data: [] }) }));
jest.mock('@/components/ImportanceBadge', () => ({ ImportanceBadge: () => null }));
jest.mock('@/components/SentimentIndicator', () => ({ SentimentIndicator: () => null }));
jest.mock('@/components/DeliveryStatus', () => ({
  useDeliveryLabel: () => () => 'delivery.sending',
}));
jest.mock('@/components/AttachmentPreview', () => ({
  AttachmentPreview: ({
    attachment,
    disabled,
  }: {
    attachment: { name: string };
    disabled?: boolean;
  }) => (
    <button type="button" disabled={disabled}>
      {attachment.name}
    </button>
  ),
}));
jest.mock('@/components/cards/CardPreview', () => ({ CardPreview: () => null }));

const message = MessageSchema.parse(
  wireMessage({
    subject: 'Attachment conversation',
    text: 'Preview text',
    attachments: [
      {
        fileId: 'file-a',
        name: 'Invoice.pdf',
        contentType: 'application/pdf',
        size: 40,
        contentId: null,
        isInline: false,
      },
      {
        fileId: 'inline',
        name: 'Logo.png',
        contentType: 'image/png',
        size: 40,
        contentId: 'logo',
        isInline: true,
      },
    ],
  }),
);

it('hands row geometry and gestures to ListItem while keeping mail and attachment data', () => {
  const open = jest.fn(),
    toggle = jest.fn(),
    enter = jest.fn();
  const view = render(
    <MessageRow message={message} onSelect={open} onToggleSelect={toggle} onLongPress={enter} />,
  );
  expect(mockRow.mail).toMatchObject({
    subject: 'Attachment conversation',
    snippet: 'Preview text',
    hasAttachment: true,
    unread: true,
  });
  expect(view.getByRole('button', { name: 'Invoice.pdf' })).toBeTruthy();
  expect(view.queryByRole('button', { name: 'Logo.png' })).toBeNull();
  act(() => mockRow.onCheckedChange?.(true));
  expect(enter).toHaveBeenCalledWith(message._id);
  expect(open).not.toHaveBeenCalled();
  expect(toggle).not.toHaveBeenCalled();
  view.rerender(
    <MessageRow
      message={message}
      onSelect={open}
      onToggleSelect={toggle}
      onLongPress={enter}
      isSelectionMode
      isMultiSelected
    />,
  );
  expect(mockRow.selecting).toBe(true);
  expect(mockRow.checked).toBe(true);
  expect(mockRow.swipeEnabled).toBe(false);
  expect((view.getByRole('button', { name: 'Invoice.pdf' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  act(() => mockRow.onCheckedChange?.(false));
  expect(toggle).toHaveBeenCalledWith(message._id);
  expect(open).not.toHaveBeenCalled();
});

it('retains row navigation and delegates input capability detection to Bloom', () => {
  const open = jest.fn();
  render(<MessageRow message={message} onSelect={open} swipeActions={{ left: [] }} />);
  expect(mockRow.swipeEnabled).toBeUndefined();
  act(() => mockRow.onPress?.());
  expect(open).toHaveBeenCalledWith(message);
});
