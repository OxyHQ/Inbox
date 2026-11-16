import type { HeaderAction } from '@oxy.so/bloom/page-header';
import type { ReactNode } from 'react';
import { Button } from './bloomButton';

/** Command dispatch stays testable while Bloom owns overflow and geometry. */
export function HeaderActions({
  actions,
  persistentActions,
}: {
  actions: readonly HeaderAction[];
  persistentActions?: ReactNode;
}) {
  return (
    <>
      {persistentActions}
      {actions
        .filter((action) => action.visible !== false)
        .map((action) => (
          <Button
            key={action.id}
            accessibilityLabel={action.label}
            disabled={action.disabled}
            loading={action.busy}
            onPress={action.onPress}
          >
            {action.label}
          </Button>
        ))}
    </>
  );
}
