import { useIsDesktopLayout } from '@/hooks/useIsDesktopLayout';
/**
 * Index route for the (search) group.
 *
 * Desktop: rendered in the Slot (right pane) — shows empty state.
 * Mobile: rendered as the main screen — shows the search list.
 */

import { MessageDetailEmpty } from '@/components/MessageDetailEmpty';
import { SearchList } from '@/components/SearchList';

export default function SearchIndex() {
  const isDesktop = useIsDesktopLayout();

  if (isDesktop) {
    return <MessageDetailEmpty />;
  }

  return <SearchList />;
}
