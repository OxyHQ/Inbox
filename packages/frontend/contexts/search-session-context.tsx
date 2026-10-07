import type { SearchFilters } from '@/utils/searchFilters';
import type { ParsedSearchQuery } from '@/hooks/queries/useNaturalLanguageSearch';
import { useOxy } from '@oxy.so/services';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

interface SearchSession {
  query: string;
  submittedQuery: string;
  filters: SearchFilters;
  nlInterpretation: string;
  nlParsedOptions: ParsedSearchQuery | null;
}
const initialState: SearchSession = {
  query: '',
  submittedQuery: '',
  filters: {},
  nlInterpretation: '',
  nlParsedOptions: null,
};
const SearchSessionContext = createContext<{
  state: SearchSession;
  setState: Dispatch<SetStateAction<SearchSession>>;
} | null>(null);

function AccountSearchSession({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialState);
  const value = useMemo(() => ({ state, setState }), [state]);
  return (
    <SearchSessionContext.Provider value={value}>
      {children}
    </SearchSessionContext.Provider>
  );
}

/** Keep searches above responsive list mounts, but never carry one into another account. */
export function SearchSessionProvider({ children }: { children: ReactNode }) {
  const { user } = useOxy();
  // This is the same account identity used by the mail query keys. A keyed
  // boundary also makes outstanding callbacks belong to the old session.
  return (
    <AccountSearchSession key={user?.id ?? 'signed-out'}>
      {children}
    </AccountSearchSession>
  );
}

export function useSearchSessionState<K extends keyof SearchSession>(key: K) {
  const session = useContext(SearchSessionContext);
  if (!session)
    throw new Error('Search session requires SearchSessionProvider');
  const { state, setState } = session;
  const update = useCallback<Dispatch<SetStateAction<SearchSession[K]>>>(
    (next) => {
      setState((previous) => ({
        ...previous,
        [key]: typeof next === 'function' ? next(previous[key]) : next,
      }));
    },
    [key, setState],
  );
  return [state[key], update] as const;
}
