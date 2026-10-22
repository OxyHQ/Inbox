import { EmptyStateSticker } from '@/components/EmptyStateSticker';
import { PrivateInboxContent } from '@/components/PrivateInboxContent';
import { InboxList } from '@/components/InboxList';
import { SearchList } from '@/components/SearchList';
import { InboxBottomBar } from '@/components/InboxBottomBar';

import { MailScrollProvider } from './MailScrollProvider';
/** Mail navigation is data for Bloom's Sidebar; account/mail mutations remain owned by the SDK/app. */
import { LogoIcon } from '@/assets/logo';
import { useInboxSettings } from '@/components/settings/InboxSettings';
import { SPECIAL_USE } from '@/constants/mailbox';
import { useColors } from '@/constants/theme';
import { useCreateMailbox, useDeleteMailbox } from '@/hooks/mutations/useMailboxMutations';
import { useLabels } from '@/hooks/queries/useLabels';
import { useMailboxes } from '@/hooks/queries/useMailboxes';
import { useScopedState } from '@/hooks/useScopedState';
import { useEmailStore } from '@/hooks/useEmail';
import { useTranslation } from '@/lib/i18n';
import type { Mailbox } from '@/services/emailApi';
import { AppShell } from '@oxy.so/bloom/app-shell';
import { MAIL_DETAIL_PANEL, MAIL_LIST_PANEL, MAIL_PANELS, MAIL_WORKSPACE } from './mailWorkspace';
import { Button } from '@oxy.so/bloom/button';
import { Dialog, useDialogControl } from '@oxy.so/bloom/dialog';
import { RiAddLine } from '@oxy.so/bloom/icons/RiAddLine';
import { RiArchiveLine } from '@oxy.so/bloom/icons/RiArchiveLine';
import { RiArrowDownSLine } from '@oxy.so/bloom/icons/RiArrowDownSLine';
import { RiArrowUpSLine } from '@oxy.so/bloom/icons/RiArrowUpSLine';
import { RiDeleteBinLine } from '@oxy.so/bloom/icons/RiDeleteBinLine';
import { RiDraftLine } from '@oxy.so/bloom/icons/RiDraftLine';
import { RiEditLine } from '@oxy.so/bloom/icons/RiEditLine';
import { RiFolderLine } from '@oxy.so/bloom/icons/RiFolderLine';
import { RiInbox2Line } from '@oxy.so/bloom/icons/RiInbox2Line';
import { RiMailLine } from '@oxy.so/bloom/icons/RiMailLine';
import { RiPriceTag3Line } from '@oxy.so/bloom/icons/RiPriceTag3Line';
import { RiSendPlaneLine } from '@oxy.so/bloom/icons/RiSendPlaneLine';
import { RiSettings3Line } from '@oxy.so/bloom/icons/RiSettings3Line';
import { RiSpamLine } from '@oxy.so/bloom/icons/RiSpamLine';
import { RiStarLine } from '@oxy.so/bloom/icons/RiStarLine';
import { RiTimeLine } from '@oxy.so/bloom/icons/RiTimeLine';
import type { SidebarNavItem, SidebarProps } from '@oxy.so/bloom/sidebar';
import { TextFieldInput } from '@oxy.so/bloom/text-field';
import { ProfileButton, useOxy } from '@oxy.so/services/ui/client';
import { useRouter } from 'expo-router';
import { useShellPathname } from '@/hooks/useShellPathname';
import { Fragment, useCallback, useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';

const PRIMARY_SPECIAL_USE: Set<string> = new Set([
  SPECIAL_USE.INBOX,
  SPECIAL_USE.SENT,
  SPECIAL_USE.DRAFTS,
]);
const MAILBOX_ICONS: Record<string, SidebarNavItem['icon']> = {
  [SPECIAL_USE.INBOX]: RiInbox2Line,
  [SPECIAL_USE.SENT]: RiSendPlaneLine,
  [SPECIAL_USE.DRAFTS]: RiDraftLine,
  [SPECIAL_USE.TRASH]: RiDeleteBinLine,
  [SPECIAL_USE.SPAM]: RiSpamLine,
  [SPECIAL_USE.ARCHIVE]: RiArchiveLine,
  [SPECIAL_USE.SNOOZED]: RiTimeLine,
};
/** Special-use names whose translation key is not the name itself. */
const SPECIAL_USE_KEY: Record<string, string> = { Junk: 'Spam' };
export function MailboxShell({ children }: { children: ReactNode }) {
  const openSettings = useInboxSettings();
  const colors = useColors();
  const { t } = useTranslation();
  const { user, canUsePrivateApi, isAccountCacheReady, openAccountDialog } = useOxy();
  const accountReady = canUsePrivateApi && isAccountCacheReady;
  const accountScope = accountReady ? (user?.id ?? null) : null;
  const router = useRouter();
  const [listWidth, setListWidth] = useState(380);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const onClose = useCallback(() => setDrawerOpen(false), []);
  const collapsed = useEmailStore((s) => s.sidebarCollapsed);
  const viewMode = useEmailStore((s) => s.viewMode);
  const manageFoldersControl = useDialogControl();

  const handleAddAccount = useCallback(() => {
    // Open the sign-in modal to authenticate a new account. Cache reset runs in
    // RootEffects (_layout.tsx) once a switch actually commits — not here, or
    // canceling sign-in would wipe the current inbox.
    openAccountDialog('signin');
  }, [openAccountDialog]);

  const handleNavigateManage = useCallback(() => {
    openSettings();
    onClose?.();
  }, [openSettings, onClose]);

  const pathname = useShellPathname();
  const isSubscriptions = pathname === '/subscriptions';
  const moreExpanded = useEmailStore((s) => s.moreExpanded);
  const toggleMore = useEmailStore((s) => s.toggleMore);
  const mailboxQuery = useMailboxes({ enabled: accountReady });
  const labelQuery = useLabels({ enabled: accountReady });
  const mailboxes = accountReady ? (mailboxQuery.data ?? []) : [];
  const labels = accountReady ? (labelQuery.data ?? []) : [];

  const mailboxLabel = useCallback(
    (mailbox: Mailbox & { specialUse?: string }) => {
      const raw = mailbox.specialUse?.replace(/^\\+/, '') ?? mailbox.name;
      // IMAP's special-use flag for the spam folder is `\Junk` (RFC 6154);
      // the app calls it Spam everywhere else, so it shares that key.
      const key = `drawer.mailboxes.${SPECIAL_USE_KEY[raw] ?? raw}`;
      const translated = t(key);
      return translated === key ? raw : translated;
    },
    [t],
  );

  // Determine active state from URL pathname.
  // Path shapes we care about here:
  //   /                → inbox (the app's root view)
  //   /<view>          → system mailbox (sent, drafts, etc.)
  //   /label/<name>    → label view (owned by app/.../label/[name].tsx)
  const pathSegments = useMemo(() => pathname.split('/').filter(Boolean), [pathname]);
  const isLabelRoute = pathSegments[0]?.toLowerCase() === 'label';
  const activeLabelName = isLabelRoute ? (pathSegments[1]?.toLowerCase() ?? null) : null;
  const currentView = isLabelRoute ? 'label' : pathSegments[0]?.toLowerCase() || 'inbox';

  const { primaryMailboxes, snoozedMailbox, secondaryMailboxes, customFolders } = useMemo(() => {
    const order: Record<string, number> = {
      [SPECIAL_USE.INBOX]: 0,
      [SPECIAL_USE.SENT]: 1,
      [SPECIAL_USE.DRAFTS]: 2,
      [SPECIAL_USE.SNOOZED]: 3,
      [SPECIAL_USE.SPAM]: 4,
      [SPECIAL_USE.TRASH]: 5,
      [SPECIAL_USE.ARCHIVE]: 6,
    };
    const sorted = mailboxes
      .filter((m): m is Mailbox & { specialUse: string } => Boolean(m.specialUse))
      .sort((a, b) => (order[a.specialUse] ?? 99) - (order[b.specialUse] ?? 99));

    return {
      primaryMailboxes: sorted.filter((m) => PRIMARY_SPECIAL_USE.has(m.specialUse)),
      snoozedMailbox: sorted.find((m) => m.specialUse === SPECIAL_USE.SNOOZED) ?? null,
      secondaryMailboxes: sorted.filter(
        (m) => !PRIMARY_SPECIAL_USE.has(m.specialUse) && m.specialUse !== SPECIAL_USE.SNOOZED,
      ),
      // User-created folders have no specialUse. They are addressable via the
      // `[view]` route using the mailbox id as the segment.
      customFolders: mailboxes
        .filter((m) => !m.specialUse)
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [mailboxes]);

  // Custom-folder create / delete flows.
  const createMailbox = useCreateMailbox();
  const deleteMailbox = useDeleteMailbox();
  const createFolderControl = useDialogControl();
  const deleteFolderControl = useDialogControl();
  const [newFolderName, setNewFolderName] = useScopedState(accountScope, () => '');
  const [folderPendingDelete, setFolderPendingDelete] = useScopedState<{
    id: string;
    name: string;
  } | null>(accountScope, () => null);

  const handleCustomFolderSelect = useCallback(
    (mailbox: Mailbox) => {
      router.push({
        pathname: '/(drawer)/(tabs)/(inbox)/[view]',
        params: { view: mailbox._id },
      });
      onClose?.();
    },
    [router, onClose],
  );

  const handleCreateFolder = useCallback(() => {
    const name = newFolderName.trim();
    if (!name) return;
    createMailbox.mutate(
      { name },
      {
        onSuccess: () => {
          setNewFolderName('');
          createFolderControl.close();
        },
      },
    );
  }, [newFolderName, createMailbox, createFolderControl, setNewFolderName]);

  const handleConfirmDeleteFolder = useCallback(() => {
    if (!folderPendingDelete) return;
    const deletedId = folderPendingDelete.id;
    deleteMailbox.mutate(
      { mailboxId: deletedId },
      {
        onSuccess: () => {
          // Deleting the folder on screen left the user on a dead view that
          // then failed to load. Go to the Inbox instead.
          const { viewMode } = useEmailStore.getState();
          if (viewMode?.type === 'mailbox' && viewMode.mailbox._id === deletedId) {
            useEmailStore.setState({
              viewMode: null,
              currentMailbox: null,
              selectedMessageId: null,
            });
            router.replace('/');
          }
        },
        onSettled: () => setFolderPendingDelete(null),
      },
    );
  }, [folderPendingDelete, deleteMailbox, router, setFolderPendingDelete]);

  const handleSelect = useCallback(
    (mailbox: Mailbox & { specialUse: string }) => {
      // The inbox is the root view, so it is addressed as `/`, not `/inbox`.
      if (mailbox.specialUse === SPECIAL_USE.INBOX) {
        router.push('/');
        onClose?.();
        return;
      }
      const viewMap: Record<string, 'sent' | 'drafts' | 'trash' | 'spam' | 'archive' | 'snoozed'> =
        {
          [SPECIAL_USE.SENT]: 'sent',
          [SPECIAL_USE.DRAFTS]: 'drafts',
          [SPECIAL_USE.TRASH]: 'trash',
          [SPECIAL_USE.SPAM]: 'spam',
          [SPECIAL_USE.ARCHIVE]: 'archive',
          [SPECIAL_USE.SNOOZED]: 'snoozed',
        };
      const view = viewMap[mailbox.specialUse];
      if (!view) return;
      router.push({
        pathname: '/(drawer)/(tabs)/(inbox)/[view]',
        params: { view },
      });
      onClose?.();
    },
    [router, onClose],
  );

  const handleStarred = useCallback(() => {
    router.push({
      pathname: '/(drawer)/(tabs)/(inbox)/[view]',
      params: { view: 'starred' },
    });
    onClose?.();
  }, [router, onClose]);

  const handleLabelSelect = useCallback(
    (labelName: string) => {
      router.push({
        pathname: '/(drawer)/(tabs)/(inbox)/label/[name]',
        params: { name: labelName.toLowerCase() },
      });
      onClose?.();
    },
    [router, onClose],
  );

  const handleCompose = useCallback(() => {
    router.push('/compose');
    onClose?.();
  }, [router, onClose]);

  const handleSubscriptions = useCallback(() => {
    router.push('/subscriptions');
    onClose?.();
  }, [router, onClose]);

  // Check if a mailbox route is active
  const isMailboxActive = useCallback(
    (mailbox: Mailbox & { specialUse: string }): boolean => {
      const routeMap: Record<string, string> = {
        [SPECIAL_USE.INBOX]: 'inbox',
        [SPECIAL_USE.SENT]: 'sent',
        [SPECIAL_USE.DRAFTS]: 'drafts',
        [SPECIAL_USE.TRASH]: 'trash',
        [SPECIAL_USE.SPAM]: 'spam',
        [SPECIAL_USE.ARCHIVE]: 'archive',
        [SPECIAL_USE.SNOOZED]: 'snoozed',
      };
      return currentView === routeMap[mailbox.specialUse];
    },
    [currentView],
  );

  const mailboxItem = (mailbox: Mailbox & { specialUse: string }): SidebarNavItem => ({
    key: mailbox._id,
    label: mailboxLabel(mailbox),
    icon: MAILBOX_ICONS[mailbox.specialUse] ?? RiFolderLine,
    badge: mailbox.unseenMessages || undefined,
    onPress: () => handleSelect(mailbox),
  });
  const items: SidebarNavItem[] = accountReady
    ? [
        ...primaryMailboxes.map(mailboxItem),
        {
          key: 'starred',
          label: t('drawer.starred'),
          icon: RiStarLine,
          onPress: handleStarred,
        },
        ...(snoozedMailbox ? [mailboxItem(snoozedMailbox)] : []),
        {
          key: 'subscriptions',
          label: t('drawer.subscriptions'),
          icon: RiMailLine,
          onPress: handleSubscriptions,
        },
        ...(secondaryMailboxes.length
          ? [
              {
                key: 'more',
                label: t(moreExpanded ? 'drawer.less' : 'drawer.more'),
                icon: moreExpanded ? RiArrowUpSLine : RiArrowDownSLine,
                onPress: toggleMore,
              },
            ]
          : []),
        ...(moreExpanded || collapsed ? secondaryMailboxes.map(mailboxItem) : []),
        ...labels.map((label) => ({
          key: `label:${label.name.toLowerCase()}`,
          label: label.name,
          icon: ({ width, height }: { width?: number; height?: number }) => (
            <RiPriceTag3Line width={width} height={height} fill={label.color} />
          ),
          onPress: () => handleLabelSelect(label.name),
        })),
        ...customFolders.map((folder) => ({
          key: folder._id,
          label: folder.name,
          icon: RiFolderLine,
          badge: folder.unseenMessages || undefined,
          onPress: () => handleCustomFolderSelect(folder),
          onLongPress: () => {
            setFolderPendingDelete({ id: folder._id, name: folder.name });
            deleteFolderControl.open();
          },
        })),
        {
          key: 'create-folder',
          label: t('ui.drawer.createFolder'),
          icon: RiAddLine,
          onPress: () => createFolderControl.open(),
        },
        ...(customFolders.length
          ? [
              {
                key: 'manage-folders',
                label: t('ui.drawer.folders'),
                icon: RiFolderLine,
                onPress: () => manageFoldersControl.open(),
              },
            ]
          : []),
      ]
    : [
        { key: 'inbox', label: t('drawer.mailboxes.Inbox'), icon: RiInbox2Line },
        { key: 'sent', label: t('drawer.mailboxes.Sent'), icon: RiSendPlaneLine },
        { key: 'drafts', label: t('drawer.mailboxes.Drafts'), icon: RiDraftLine },
        { key: 'starred', label: t('drawer.starred'), icon: RiStarLine },
      ];
  const selectedMailbox =
    viewMode?.type === 'label'
      ? `label:${viewMode.labelName.toLowerCase()}`
      : viewMode?.type === 'starred'
        ? 'starred'
        : viewMode?.type === 'mailbox'
          ? viewMode.mailbox._id
          : mailboxes.find((mailbox) => mailbox.specialUse === SPECIAL_USE.INBOX)?._id;
  const selected =
    pathSegments[0] === 'conversation' || pathSegments[0] === 'compose'
      ? selectedMailbox
      : isLabelRoute
        ? `label:${activeLabelName}`
        : (mailboxes.find((mailbox) =>
            mailbox.specialUse
              ? isMailboxActive(mailbox as Mailbox & { specialUse: string })
              : currentView === mailbox._id.toLowerCase(),
          )?._id ?? currentView);

  const sidebarProps: SidebarProps = {
    items,
    selected: accountReady ? selected : 'inbox',
    collapsed,
    onCollapsedChange: (next) => {
      if (next !== useEmailStore.getState().sidebarCollapsed)
        useEmailStore.getState().toggleSidebar();
    },
    logo: {
      icon: <LogoIcon height={28} color={colors.primary} />,
      wordmark: t('app.name'),
      onPress: () => {
        router.push('/');
        onClose();
      },
    },
    showSearch: false,
    showThemeToggle: false,
    primaryAction: accountReady
      ? {
          label: t('inbox.composeFabLabel'),
          icon: RiEditLine,
          onPress: handleCompose,
        }
      : undefined,
    secondaryItems: accountReady
      ? [
          {
            key: 'settings',
            label: t('tabs.settings'),
            icon: RiSettings3Line,
            onPress: handleNavigateManage,
          },
        ]
      : [],
    footer: accountReady
      ? ({ collapsed: compact }) => (
          <ProfileButton expanded={!compact} placement="up" onAddAccount={handleAddAccount} />
        )
      : undefined,
  };

  return (
    <MailScrollProvider>
      <AppShell
        {...MAIL_WORKSPACE}
        testID="mail-workspace"
        drawerOpen={drawerOpen}
        onDrawerOpenChange={setDrawerOpen}
        sidebar={sidebarProps}
        bottomBar={<InboxBottomBar />}
        drawerOpenLabel={t('search.openMenu')}
        drawerCloseLabel={t('common.close')}
        panelLayout={{
          ...MAIL_PANELS,
          activePanel:
            isSubscriptions || pathname === '/compose' || pathname.includes('/conversation/')
              ? 'detail'
              : 'list',
          widths: { list: listWidth },
          onWidthsChange: (widths) => setListWidth(widths.list ?? listWidth),
          panels: [
            {
              ...MAIL_LIST_PANEL,
              visible: !isSubscriptions,
              resizable: true,
              resizeLabel: t('inbox.resizePanes'),
              errorBoundary: {
                resetKey: pathname,
                emptyState: {
                  variant: 'comfortable',
                  illustration: <EmptyStateSticker name="loadError" />,
                  title: t('empty.errorTitle'),
                  description: t('empty.errorDescription'),
                  action: { label: t('common.retry') },
                },
              },
              content: pathname.startsWith('/search') ? (
                <PrivateInboxContent>
                  <SearchList replaceNavigation={pathname.includes('/conversation/')} />
                </PrivateInboxContent>
              ) : (
                <InboxList replaceNavigation={pathname.includes('/conversation/')} />
              ),
            },
            {
              ...MAIL_DETAIL_PANEL,
              appearance: isSubscriptions ? 'solid' : 'plain',
              errorBoundary: {
                resetKey: pathname,
                emptyState: {
                  variant: 'comfortable',
                  illustration: <EmptyStateSticker name="loadError" />,
                  title: t('empty.errorTitle'),
                  description: t('empty.errorDescription'),
                  action: { label: t('common.retry') },
                },
              },
              content: children,
            },
          ],
        }}
      />
      {accountReady && (
        <Fragment key={accountScope}>
          <Dialog
            control={createFolderControl}
            title={t('ui.drawer.newFolder')}
            label={t('ui.drawer.newFolder')}
          >
            <View style={{ gap: 12 }}>
              <TextFieldInput
                label={t('ui.drawer.folderName')}
                value={newFolderName}
                onChangeText={setNewFolderName}
                autoFocus
                onSubmitEditing={handleCreateFolder}
                returnKeyType="done"
              />
              <Button
                onPress={handleCreateFolder}
                disabled={!newFolderName.trim() || createMailbox.isPending}
                loading={createMailbox.isPending}
              >
                {t('ui.drawer.createFolderButton')}
              </Button>
            </View>
          </Dialog>
          <Dialog control={manageFoldersControl} title={t('ui.drawer.folders')}>
            <View style={{ gap: 8 }}>
              {customFolders.map((folder) => (
                <Button
                  key={folder._id}
                  appearance="subtle"
                  onPress={() => {
                    manageFoldersControl.close();
                    setFolderPendingDelete({ id: folder._id, name: folder.name });
                    deleteFolderControl.open();
                  }}
                >
                  {t('common.delete')} · {folder.name}
                </Button>
              ))}
            </View>
          </Dialog>
          <Dialog
            control={deleteFolderControl}
            title={t('ui.drawer.deleteFolderTitle')}
            description={
              folderPendingDelete
                ? t('ui.drawer.deleteFolderDescription', {
                    name: folderPendingDelete.name,
                  })
                : ''
            }
            actions={[
              {
                label: t('common.delete'),
                color: 'destructive',
                onPress: handleConfirmDeleteFolder,
              },
              { label: t('common.cancel'), color: 'cancel' },
            ]}
          />
        </Fragment>
      )}
    </MailScrollProvider>
  );
}
