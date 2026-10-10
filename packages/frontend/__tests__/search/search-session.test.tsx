import { SearchSessionProvider, useSearchSessionState } from '@/contexts/search-session-context';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { __setOxyState } from '../../__mocks__/oxyhq-services';

let oldSearchCompletion: () => void;
function SearchFixture() {
  const [query, setQuery] = useSearchSessionState('query');
  const [submitted, setSubmitted] = useSearchSessionState('submittedQuery');
  const [filters, setFilters] = useSearchSessionState('filters');
  const [interpretation, setInterpretation] = useSearchSessionState('nlInterpretation');
  const [parsed, setParsed] = useSearchSessionState('nlParsedOptions');
  return (
    <>
      <output>
        {JSON.stringify({
          query,
          submitted,
          filters,
          interpretation,
          parsed,
        })}
      </output>
      <button
        onClick={() => {
          setQuery('invoices from Sarah');
          setSubmitted('invoices');
          setFilters({
            from: 'sarah@example.com',
            to: 'me@example.com',
            hasAttachment: true,
            unread: false,
            mailbox: 'inbox-id',
            label: 'Receipts',
            dateAfter: '2026-10-01',
            dateBefore: '2026-10-07',
          });
          setInterpretation('Invoices from Sarah');
          setParsed({ from: 'sarah@example.com', hasAttachment: true });
          oldSearchCompletion = () => {
            setInterpretation('Late account A result');
            setParsed({ from: 'private@example.com' });
          };
        }}
      >
        Search
      </button>
    </>
  );
}
function read() {
  return JSON.parse(screen.getByRole('status').textContent!);
}
const empty = {
  query: '',
  submitted: '',
  filters: {},
  interpretation: '',
  parsed: null,
};
beforeEach(() => {
  act(() => __setOxyState({ user: { id: 'account-a' }, isAuthenticated: true }));
});

it('retains the complete search session when its list unmounts for a tab or width change', () => {
  const { rerender } = render(
    <SearchSessionProvider>
      <SearchFixture key="desktop" />
    </SearchSessionProvider>,
  );
  fireEvent.click(screen.getByText('Search'));
  const before = read();
  expect(before.query).toBe('invoices from Sarah');
  rerender(<SearchSessionProvider>{null}</SearchSessionProvider>);
  rerender(
    <SearchSessionProvider>
      <SearchFixture key="mobile" />
    </SearchSessionProvider>,
  );
  expect(read()).toEqual(before);
});

it('clears all fields on account switch and ignores late updates from the previous account', () => {
  render(
    <SearchSessionProvider>
      <SearchFixture />
    </SearchSessionProvider>,
  );
  fireEvent.click(screen.getByText('Search'));
  act(() => __setOxyState({ user: { id: 'account-b' } }));
  expect(read()).toEqual(empty);
  act(() => oldSearchCompletion());
  expect(read()).toEqual(empty);
  act(() => __setOxyState({ user: { id: 'account-a' } }));
  expect(read()).toEqual(empty);
});

it('drops the search session on sign-out', () => {
  render(
    <SearchSessionProvider>
      <SearchFixture />
    </SearchSessionProvider>,
  );
  fireEvent.click(screen.getByText('Search'));
  act(() => __setOxyState({ user: null, isAuthenticated: false }));
  expect(read()).toEqual(empty);
});
