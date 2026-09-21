import { InboxBottomBar } from '@/components/InboxBottomBar';
/** Mail navigation is data for Bloom's Sidebar; account/mail mutations remain owned by the SDK/app. */
import { useInboxSettings } from '@/components/settings/InboxSettings';
import { useMemo, useCallback, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useOxy, openAccountDialog, ProfileButton } from '@oxy.so/services';
import { Dialog, useDialogControl } from '@oxy.so/bloom/dialog';
import { Button } from '@oxy.so/bloom/button';
import { TextFieldInput } from '@oxy.so/bloom/text-field';
import { AppShell } from '@oxy.so/bloom/app-shell';
import type { SidebarNavItem } from '@oxy.so/bloom/sidebar';
import {
  RiInbox2Line,
  RiSendPlaneLine,
  RiDraftLine,
  RiDeleteBinLine,
  RiSpamLine,
  RiArchiveLine,
  RiStarLine,
  RiTimeLine,
  RiFolderLine,
  RiPriceTag3Line,
  RiMailLine,
  RiAddLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiSettings3Line,
  RiEditLine,
} from '@oxy.so/bloom/icons';
import { useRouter, usePathname } from 'expo-router';
import { useColors } from '@/constants/theme';
import { SPECIAL_USE } from '@/constants/mailbox';
import { useEmailStore } from '@/hooks/useEmail';
import { useMailboxes } from '@/hooks/queries/useMailboxes';
import { useLabels } from '@/hooks/queries/useLabels';
import {
  useCreateMailbox,
  useDeleteMailbox,
} from '@/hooks/mutations/useMailboxMutations';
import type { Mailbox } from '@/services/emailApi';
import { LogoIcon } from '@/assets/logo';
import { useTranslation } from '@/lib/i18n';
import { DESKTOP_BREAKPOINT } from '@/hooks/useIsDesktopLayout';

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
export function MailboxShell({ children }: { children: ReactNode }) {
  const openSettings = useInboxSettings();
  const colors = useColors();
  const { t } = useTranslation();
  const { isAuthenticated } = useOxy();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const onClose = useCallback(() => setDrawerOpen(false), []);
  const collapsed = useEmailStore((s) => s.sidebarCollapsed);
  const manageFoldersControl = useDialogControl();

  const handleAddAccount = useCallback(() => {
    // Open the sign-in modal to authenticate a new account. Cache reset runs in
    // RootEffects (_layout.tsx) once a switch actually commits — not here, or
    // canceling sign-in would wipe the current inbox.
    openAccountDialog('signin');
  }, []);

  const handleNavigateManage = useCallback(() => {
    openSettings();
    onClose?.();
  }, [openSettings, onClose]);

  const pathname = usePathname();
  const moreExpanded = useEmailStore((s) => s.moreExpanded);
  const toggleMore = useEmailStore((s) => s.toggleMore);
  const { data: mailboxes = [] } = useMailboxes();
  const { data: labels = [] } = useLabels();

  const mailboxLabel = useCallback(
    (mailbox: Mailbox & { specialUse?: string }) => {
      const raw = mailbox.specialUse?.replace(/^\\+/, '') ?? mailbox.name;
      const key = `drawer.mailboxes.${raw}`;
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
  const pathSegments = useMemo(
    () => pathname.split('/').filter(Boolean),
    [pathname],
  );
  const isLabelRoute = pathSegments[0]?.toLowerCase() === 'label';
  const activeLabelName = isLabelRoute
    ? (pathSegments[1]?.toLowerCase() ?? null)
    : null;
  const currentView = isLabelRoute
    ? 'label'
    : pathSegments[0]?.toLowerCase() || 'inbox';

  const {
    primaryMailboxes,
    snoozedMailbox,
    secondaryMailboxes,
    customFolders,
  } = useMemo(() => {
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
      .filter((m): m is Mailbox & { specialUse: string } =>
        Boolean(m.specialUse),
      )
      .sort(
        (a, b) => (order[a.specialUse] ?? 99) - (order[b.specialUse] ?? 99),
      );

    return {
      primaryMailboxes: sorted.filter((m) =>
        PRIMARY_SPECIAL_USE.has(m.specialUse),
      ),
      snoozedMailbox:
        sorted.find((m) => m.specialUse === SPECIAL_USE.SNOOZED) ?? null,
      secondaryMailboxes: sorted.filter(
        (m) =>
          !PRIMARY_SPECIAL_USE.has(m.specialUse) &&
          m.specialUse !== SPECIAL_USE.SNOOZED,
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
  const [newFolderName, setNewFolderName] = useState('');
  const [folderPendingDelete, setFolderPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

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
  }, [newFolderName, createMailbox, createFolderControl]);

  const handleConfirmDeleteFolder = useCallback(() => {
    if (!folderPendingDelete) return;
    deleteMailbox.mutate(
      { mailboxId: folderPendingDelete.id },
      { onSettled: () => setFolderPendingDelete(null) },
    );
  }, [folderPendingDelete, deleteMailbox]);

  const handleSelect = useCallback(
    (mailbox: Mailbox & { specialUse: string }) => {
      // The inbox is the root view, so it is addressed as `/`, not `/inbox`.
      if (mailbox.specialUse === SPECIAL_USE.INBOX) {
        router.push('/');
        onClose?.();
        return;
      }
      const viewMap: Record<
        string,
        'sent' | 'drafts' | 'trash' | 'spam' | 'archive' | 'snoozed'
      > = {
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

  const mailboxItem = (
    mailbox: Mailbox & { specialUse: string },
  ): SidebarNavItem => ({
    key: mailbox._id,
    label: mailboxLabel(mailbox),
    icon: MAILBOX_ICONS[mailbox.specialUse] ?? RiFolderLine,
    badge: mailbox.unseenMessages || undefined,
    onPress: () => handleSelect(mailbox),
  });
  const items: SidebarNavItem[] = isAuthenticated
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
        ...(moreExpanded || collapsed
          ? secondaryMailboxes.map(mailboxItem)
          : []),
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
    : [];
  const selected = isLabelRoute
    ? `label:${activeLabelName}`
    : (mailboxes.find((mailbox) =>
        mailbox.specialUse
          ? isMailboxActive(mailbox as Mailbox & { specialUse: string })
          : currentView === mailbox._id.toLowerCase(),
      )?._id ?? currentView);

  return (
    <>
      <AppShell
        variant="dashboard"
        scroll="fixed"
        drawer="reveal"
        header={null}
        navFrom={DESKTOP_BREAKPOINT}
        gutter={12}
        contentMaxWidth={1800}
        bottomBar={<InboxBottomBar />}
        drawerOpen={drawerOpen}
        onDrawerOpenChange={setDrawerOpen}
        sidebar={{
          surface: 'plain',
          size: 'md',
          items,
          selected,
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
          primaryAction: isAuthenticated
            ? {
                label: t('inbox.composeFabLabel'),
                icon: RiEditLine,
                onPress: handleCompose,
              }
            : undefined,
          secondaryItems: [
            {
              key: 'settings',
              label: t('tabs.settings'),
              icon: RiSettings3Line,
              onPress: handleNavigateManage,
            },
          ],
          footer: ({ collapsed: compact }) => (
            <ProfileButton
              expanded={!compact}
              avatarSize={compact ? 24 : 32}
              style={compact ? { alignSelf: 'center' } : undefined}
              onNavigateManage={handleNavigateManage}
              onAddAccount={handleAddAccount}
            />
          ),
        }}
      >
        {children}
      </AppShell>
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
    </>
  );
}
