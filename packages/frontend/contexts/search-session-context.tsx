import { useScopedState } from '@/hooks/useScopedState';
import type { SearchFilters } from '@/utils/searchFilters';
import type { ParsedSearchQuery } from '@/hooks/queries/useNaturalLanguageSearch';
import { useOxy } from '@oxy.so/services/ui/client';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
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

/** Keep searches above responsive list mounts, but never carry one into another account. */
export function SearchSessionProvider({ children }: { children: ReactNode }) {
  const { user } = useOxy();
  const [state, setState] = useScopedState(user?.id ?? null, () => initialState);
  const value = useMemo(() => ({ state, setState }), [state, setState]);
  return <SearchSessionContext.Provider value={value}>{children}</SearchSessionContext.Provider>;
}

export function useSearchSessionState<K extends keyof SearchSession>(key: K) {
  const session = useContext(SearchSessionContext);
  if (!session) throw new Error('Search session requires SearchSessionProvider');
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
