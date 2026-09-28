import { SearchList } from '@/components/SearchList';
import { MessageDetailEmpty } from '@/components/MessageDetailEmpty';
import { useIsDesktopLayout } from '@/hooks/useIsDesktopLayout';

/** The shell owns the persistent search list when two panes fit. */
export default function SearchIndex() {
  const isDesktop = useIsDesktopLayout();
  return isDesktop ? <MessageDetailEmpty /> : <SearchList />;
}
