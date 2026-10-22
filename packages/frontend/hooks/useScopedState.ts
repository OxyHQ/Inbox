import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * Reset account-owned state before rendering the next account, without remounting
 * the surrounding workspace. A setter belongs to its original session, even if
 * that account is selected again after an intervening switch.
 */
export function useScopedState<T>(
  scope: string | null,
  initialize: (scope: string | null) => T,
): [T, Dispatch<SetStateAction<T>>] {
  const [stored, setStored] = useState(() => ({ scope, value: initialize(scope), epoch: {} }));
  let current = stored;
  if (current.scope !== scope) {
    current = { scope, value: initialize(scope), epoch: {} };
    // React retries this component before committing children or effects. An
    // effect reset would render the previous account's values for one frame.
    setStored(current);
  }
  const epoch = current.epoch;
  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    (update) => {
      setStored((previous) => {
        if (previous.epoch !== epoch) return previous;
        const value =
          typeof update === 'function' ? (update as (previous: T) => T)(previous.value) : update;
        return Object.is(value, previous.value) ? previous : { ...previous, value };
      });
    },
    [epoch],
  );
  return [current.value, setValue];
}
