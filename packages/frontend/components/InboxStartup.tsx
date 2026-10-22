import { PageHeader } from '@oxy.so/bloom/page-header';
import { Screen } from '@oxy.so/bloom/screen';
import { View } from 'react-native';
import { useTranslation } from '@/lib/i18n';

/** Pending panel content only. The real workspace stays mounted while the SDK restores its account. */
export function InboxStartup({ detail = false }: { detail?: boolean }) {
  const { t } = useTranslation();
  return (
    <Screen
      scroll="none"
      testID="inbox-startup"
      header={
        <View className={detail ? 'lg:hidden' : undefined}>
          <PageHeader
            title={t('drawer.mailboxes.Inbox')}
            sticky={false}
            scrim="none"
            safeArea={false}
          />
        </View>
      }
    />
  );
}
