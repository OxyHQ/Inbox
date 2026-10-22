import { StrictMode } from 'react';
import { render } from '@testing-library/react';
import InboxAlia from '@/components/InboxAlia';

const mockPresent = jest.fn();
jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@alia.onl/sdk', () => {
  const { useImperativeHandle } = jest.requireActual('react');
  return {
    AliaChatSheet: ({ ref, clientContext }: { ref: unknown; clientContext: string }) => {
      useImperativeHandle(ref, () => ({
        present: (turn?: { text: string }) => mockPresent({ turn, clientContext }),
      }));
      return null;
    },
  };
});

beforeEach(() => mockPresent.mockClear());

it('sends a first-open brief action once, after the referenced message context commits', () => {
  const request = {
    action: { label: 'Summarize', prompt: 'Summarize this thread', messageIds: ['message-1'] },
  };
  const { rerender } = render(
    <StrictMode>
      <InboxAlia request={request} />
    </StrictMode>,
  );
  expect(mockPresent).toHaveBeenCalledTimes(1);
  expect(mockPresent).toHaveBeenCalledWith({
    turn: { text: request.action.prompt },
    clientContext: expect.stringContaining('["message-1"]'),
  });
  rerender(
    <StrictMode>
      <InboxAlia request={request} />
    </StrictMode>,
  );
  expect(mockPresent).toHaveBeenCalledTimes(1);
  rerender(
    <StrictMode>
      <InboxAlia request={{ action: request.action }} />
    </StrictMode>,
  );
  expect(mockPresent).toHaveBeenCalledTimes(2);
});

it('opens a general conversation without carrying the previous brief action context', () => {
  const { rerender } = render(
    <InboxAlia
      request={{ action: { label: 'Reply', prompt: 'Draft a reply', messageIds: ['message-1'] } }}
    />,
  );
  rerender(<InboxAlia request={{}} />);
  expect(mockPresent).toHaveBeenLastCalledWith({
    turn: undefined,
    clientContext: 'inbox.aliaClientContext',
  });
});
