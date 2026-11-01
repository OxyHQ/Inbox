import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OxyServices } from '@oxy.so/core';
import type { ReactNode } from 'react';
import type { Message } from '@/services/emailApi';

let mockOxy: OxyServices;
let mockOldReply: (() => void) | undefined;
let mockOldGenerate: (() => void) | undefined;
jest.mock('@oxy.so/services/ui/client', () => ({ useOxy: () => ({ oxyServices: mockOxy }) }));
jest.mock('@/contexts/inbox-prefs-context', () => ({
  useInboxPrefs: () => ({ prefs: { aiSmartReply: true } }),
}));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native', () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock('@oxy.so/bloom/button', () => ({
  Button: ({ children, onPress }: { children: ReactNode; onPress: () => void }) => {
    mockOldGenerate = onPress;
    return (
      <button type="button" onClick={onPress}>
        {children}
      </button>
    );
  },
}));
jest.mock('@oxy.so/bloom/chip', () => ({
  Chip: ({ children, onPress }: { children: ReactNode; onPress: () => void }) => {
    mockOldReply = onPress;
    return (
      <button type="button" onClick={onPress}>
        {children}
      </button>
    );
  },
}));
jest.mock('@oxy.so/bloom/icons/RiSparklingLine', () => ({ RiSparklingLine: () => null }));
jest.mock('@oxy.so/bloom/loading', () => ({
  Loading: ({ text }: { text: string }) => <span>{text}</span>,
}));
jest.mock('@oxy.so/bloom/typography', () => ({
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
import { SmartReplyChips } from '@/components/SmartReplyChips';

beforeEach(() => {
  mockOxy = new OxyServices({
    baseURL: 'https://api.test',
    enableRetry: false,
    enableCache: false,
  });
  mockOldReply = undefined;
  mockOldGenerate = undefined;
});
afterEach(() => mockOxy.dispose());

it('requires a fresh opt-in when the actual target message changes', async () => {
  jest.spyOn(mockOxy.http, 'post').mockResolvedValueOnce({ replies: ['Reply to first'] } as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onSelect = jest.fn();
  const wrap = (id: string) => (
    <QueryClientProvider client={client}>
      <SmartReplyChips message={{ _id: id } as Message} onSelectReply={onSelect} />
    </QueryClientProvider>
  );
  const view = render(wrap('first'));
  fireEvent.click(screen.getByRole('button', { name: 'smartReply.generate' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Reply to first' })).toBeTruthy());
  view.rerender(wrap('second'));
  expect(screen.getByRole('button', { name: 'smartReply.generate' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Reply to first' })).toBeNull();
  view.unmount();
  client.clear();
});

it('does not dispatch a retained chip callback after its target is replaced', async () => {
  jest.spyOn(mockOxy.http, 'post').mockResolvedValueOnce({ replies: ['Reply to first'] } as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onSelect = jest.fn();
  const wrap = (id: string) => (
    <QueryClientProvider client={client}>
      <SmartReplyChips message={{ _id: id } as Message} onSelectReply={onSelect} />
    </QueryClientProvider>
  );
  const view = render(wrap('first'));
  fireEvent.click(screen.getByRole('button', { name: 'smartReply.generate' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Reply to first' })).toBeTruthy());
  const oldPress = mockOldReply;
  expect(oldPress).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Reply to first' }));
  expect(onSelect).toHaveBeenCalledWith('Reply to first');
  onSelect.mockClear();
  view.rerender(wrap('second'));
  act(() => oldPress?.());
  expect(onSelect).not.toHaveBeenCalled();
  view.rerender(wrap('first'));
  act(() => oldPress?.());
  expect(onSelect).not.toHaveBeenCalled();
  view.unmount();
  client.clear();
});

it('does not start a request from a retained generate callback after target change', () => {
  const post = jest.spyOn(mockOxy.http, 'post');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = (id: string) => (
    <QueryClientProvider client={client}>
      <SmartReplyChips message={{ _id: id } as Message} onSelectReply={() => {}} />
    </QueryClientProvider>
  );
  const view = render(wrap('first'));
  const oldGenerate = mockOldGenerate;
  expect(oldGenerate).toBeDefined();
  view.rerender(wrap('second'));
  act(() => oldGenerate?.());
  expect(post).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'smartReply.generate' })).toBeTruthy();
  view.unmount();
  client.clear();
});

it('does not display an already cached reply for a different target without opt-in', async () => {
  jest.spyOn(mockOxy.http, 'post').mockResolvedValueOnce({ replies: ['Reply to first'] } as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['smartReplies', 'second'], ['Cached second reply']);
  const wrap = (id: string) => (
    <QueryClientProvider client={client}>
      <SmartReplyChips message={{ _id: id } as Message} onSelectReply={() => {}} />
    </QueryClientProvider>
  );
  const view = render(wrap('first'));
  fireEvent.click(screen.getByRole('button', { name: 'smartReply.generate' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Reply to first' })).toBeTruthy());
  view.rerender(wrap('second'));
  expect(screen.getByRole('button', { name: 'smartReply.generate' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Cached second reply' })).toBeNull();
  expect(mockOxy.http.post).toHaveBeenCalledTimes(1);
  view.unmount();
  client.clear();
});

it('does not display a late response for the previous target', async () => {
  let finish!: (value: { replies: string[] }) => void;
  const pending = new Promise<{ replies: string[] }>((resolve) => {
    finish = resolve;
  });
  jest.spyOn(mockOxy.http, 'post').mockReturnValueOnce(pending as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onSelect = jest.fn();
  const wrap = (id: string) => (
    <QueryClientProvider client={client}>
      <SmartReplyChips message={{ _id: id } as Message} onSelectReply={onSelect} />
    </QueryClientProvider>
  );
  const view = render(wrap('first'));
  fireEvent.click(screen.getByRole('button', { name: 'smartReply.generate' }));
  await waitFor(() => expect(mockOxy.http.post).toHaveBeenCalledTimes(1));
  view.rerender(wrap('second'));
  await act(async () => {
    finish({ replies: ['late reply'] });
    await pending;
  });
  expect(screen.getByRole('button', { name: 'smartReply.generate' })).toBeTruthy();
  expect(screen.queryByText('late reply')).toBeNull();
  expect(onSelect).not.toHaveBeenCalled();
  view.unmount();
  client.clear();
});
