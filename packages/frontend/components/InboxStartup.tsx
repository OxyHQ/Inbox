import { AppShell } from '@oxy.so/bloom/app-shell';
import { PageHeader } from '@oxy.so/bloom/page-header';
import { Screen } from '@oxy.so/bloom/screen';
import { RiDraftLine, RiInbox2Line, RiSendPlaneLine, RiStarLine } from '@oxy.so/bloom/icons';
import { LogoIcon } from '@/assets/logo';
import { useColors } from '@/constants/theme';
import { useTranslation } from '@/lib/i18n';
import { MAIL_DETAIL_PANEL, MAIL_LIST_PANEL, MAIL_PANELS, MAIL_WORKSPACE } from './mailWorkspace';

/** Public app chrome only: account queries stay behind RequireOxyAuth. */
export function InboxStartup() {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <AppShell
      {...MAIL_WORKSPACE}
      testID="inbox-startup"
      sidebar={{
        logo: { icon: <LogoIcon height={28} color={colors.primary} />, wordmark: t('app.name') },
        showSearch: false,
        showThemeToggle: false,
        selected: 'inbox',
        items: [
          { key: 'inbox', label: t('drawer.mailboxes.Inbox'), icon: RiInbox2Line },
          { key: 'sent', label: t('drawer.mailboxes.Sent'), icon: RiSendPlaneLine },
          { key: 'drafts', label: t('drawer.mailboxes.Drafts'), icon: RiDraftLine },
          { key: 'starred', label: t('drawer.starred'), icon: RiStarLine },
        ],
      }}
      panelLayout={{
        ...MAIL_PANELS,
        activePanel: 'list',
        panels: [
          {
            ...MAIL_LIST_PANEL,
            content: (
              <Screen scroll="none" header={<PageHeader title={t('drawer.mailboxes.Inbox')} />} />
            ),
          },
          MAIL_DETAIL_PANEL,
        ],
      }}
    />
  );
}
