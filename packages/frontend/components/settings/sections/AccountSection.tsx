import { Textarea } from '@oxy.so/bloom/textarea';
import { useCallback, useState } from 'react';
import {
  SettingsProfilePage,
  SettingsTextField,
  SettingsValueField,
} from '@oxy.so/bloom/settings-modal';
import { Button } from '@oxy.so/bloom/button';
import { Switch } from '@oxy.so/bloom/switch';
import { Dialog, useDialogControl } from '@oxy.so/bloom/dialog';
import { toast } from '@oxy.so/bloom/toast';
import { getNormalizedUserHandle } from '@oxy.so/core';
import { useOxy } from '@oxy.so/services';
import { useTranslation } from '@/lib/i18n';
import { useSettings, useUpdateSettings } from '@/hooks/queries/useSettings';
import type { EmailSettings } from '@/services/emailApi';
type SettingsDraft = {
  signature: string;
  autoReplyEnabled: boolean;
  autoReplySubject: string;
  autoReplyBody: string;
  autoForwardTo: string;
  autoForwardKeepCopy: boolean;
};

function toDraft(data: EmailSettings | undefined): SettingsDraft {
  return {
    signature: data?.signature ?? '',
    autoReplyEnabled: data?.autoReply.enabled ?? false,
    autoReplySubject: data?.autoReply.subject ?? '',
    autoReplyBody: data?.autoReply.body ?? '',
    autoForwardTo: data?.autoForwardTo ?? '',
    autoForwardKeepCopy: data?.autoForwardKeepCopy ?? true,
  };
}

function draftsEqual(a: SettingsDraft, b: SettingsDraft): boolean {
  return (
    a.signature === b.signature &&
    a.autoReplyEnabled === b.autoReplyEnabled &&
    a.autoReplySubject === b.autoReplySubject &&
    a.autoReplyBody === b.autoReplyBody &&
    a.autoForwardTo === b.autoForwardTo &&
    a.autoForwardKeepCopy === b.autoForwardKeepCopy
  );
}

/** React-docs derived-state pattern: re-sync the draft only when the server
 *  snapshot changes AND the user has no pending edits. No useEffect. */
function useDirtySettings(settingsData: EmailSettings | undefined) {
  const [serverSnapshot, setServerSnapshot] = useState<
    EmailSettings | undefined
  >(settingsData);
  const [draft, setDraft] = useState<SettingsDraft>(() =>
    toDraft(settingsData),
  );

  if (settingsData !== serverSnapshot) {
    const isClean = draftsEqual(draft, toDraft(serverSnapshot));
    setServerSnapshot(settingsData);
    if (isClean) {
      setDraft(toDraft(settingsData));
    }
  }

  const dirty = !draftsEqual(draft, toDraft(settingsData));

  const setField = useCallback(
    <K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) => {
      setDraft((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  return { draft, setField, dirty };
}

export function AccountSection() {
  const { t } = useTranslation();
  const { user, logout } = useOxy();
  const { data: settingsData } = useSettings();
  const updateSettings = useUpdateSettings();

  const { draft, setField, dirty } = useDirtySettings(settingsData);
  const {
    signature,
    autoReplyEnabled,
    autoReplySubject,
    autoReplyBody,
    autoForwardTo,
    autoForwardKeepCopy,
  } = draft;

  const saving = updateSettings.isPending;

  const handleSave = useCallback(() => {
    updateSettings.mutate(
      {
        signature,
        autoReply: {
          enabled: autoReplyEnabled,
          subject: autoReplySubject,
          body: autoReplyBody,
        },
        autoForwardTo,
        autoForwardKeepCopy,
      },
      {
        onSuccess: () => toast.success(t('ui.settings.account.updated')),
        onError: (err: unknown) => {
          const message =
            err instanceof Error ? err.message : 'Failed to save settings.';
          toast.error(message);
        },
      },
    );
  }, [
    signature,
    autoReplyEnabled,
    autoReplySubject,
    autoReplyBody,
    autoForwardTo,
    autoForwardKeepCopy,
    updateSettings,
    t,
  ]);

  const signOutDialog = useDialogControl();

  const fullName =
    user?.name?.displayName ?? getNormalizedUserHandle(user) ?? 'Account';

  const emailAddress = user?.email || (user ? `${user.username}@oxy.so` : '');

  const handleSignOut = useCallback(async () => {
    try {
      await logout();
      toast.success(t('ui.settings.account.signedOut'));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to sign out.';
      toast.error(message);
    }
  }, [logout, t]);

  return (
    <>
      <SettingsProfilePage
        sections={[
          {
            key: 'identity',
            rows: [
              {
                key: 'name',
                label: fullName,
                control: (
                  <SettingsValueField>{emailAddress}</SettingsValueField>
                ),
              },
            ],
          },
          {
            key: 'signature',
            label: t('ui.settings.account.signature'),
            rows: [
              {
                key: 'signature',
                label: t('ui.settings.account.signature'),
                control: (
                  <Textarea
                    accessibilityLabel={t('ui.settings.account.signature')}
                    value={signature}
                    onChangeText={(v) => setField('signature', v)}
                    placeholder={t('ui.settings.account.signaturePlaceholder')}
                    rows={4}
                    style={{ width: 202, maxWidth: '100%', flexGrow: 1 }}
                  />
                ),
              },
            ],
          },
          {
            key: 'vacation',
            label: t('ui.settings.account.autoReply'),
            rows: [
              {
                key: 'enabled',
                label: 'Vacation responder',
                description: autoReplyEnabled
                  ? 'Replies are sent automatically.'
                  : 'Off — incoming mail flows normally.',
                control: (
                  <Switch
                    accessibilityLabel="Vacation responder"
                    value={autoReplyEnabled}
                    onValueChange={(v) => setField('autoReplyEnabled', v)}
                  />
                ),
              },
              ...(autoReplyEnabled
                ? [
                    {
                      key: 'subject',
                      label: t('ui.settings.account.subjectPlaceholder'),
                      control: (
                        <SettingsTextField
                          label={t('ui.settings.account.subjectPlaceholder')}
                          value={autoReplySubject}
                          onCommit={(v) => setField('autoReplySubject', v)}
                          showSavedToast={false}
                        />
                      ),
                    },
                    {
                      key: 'body',
                      label: t('ui.settings.account.messagePlaceholder'),
                      control: (
                        <Textarea
                          accessibilityLabel={t(
                            'ui.settings.account.messagePlaceholder',
                          )}
                          value={autoReplyBody}
                          onChangeText={(v) => setField('autoReplyBody', v)}
                          rows={4}
                          style={{ width: 202, maxWidth: '100%', flexGrow: 1 }}
                        />
                      ),
                    },
                  ]
                : []),
            ],
          },
          {
            key: 'forwarding',
            label: t('ui.settings.account.forwarding'),
            rows: [
              {
                key: 'address',
                label: t('ui.settings.account.forwarding'),
                control: (
                  <SettingsTextField
                    label={t('ui.settings.account.forwarding')}
                    value={autoForwardTo}
                    onCommit={(v) => setField('autoForwardTo', v)}
                    placeholder={t('ui.settings.account.forwardingPlaceholder')}
                    keyboardType="email-address"
                    showSavedToast={false}
                  />
                ),
              },
              ...(autoForwardTo.trim()
                ? [
                    {
                      key: 'keep-copy',
                      label: 'Keep a copy in Inbox',
                      description:
                        'Recommended so you retain a record of forwarded mail.',
                      control: (
                        <Switch
                          accessibilityLabel="Keep a copy in Inbox"
                          value={autoForwardKeepCopy}
                          onValueChange={(v) =>
                            setField('autoForwardKeepCopy', v)
                          }
                        />
                      ),
                    },
                  ]
                : []),
            ],
          },
          ...(dirty
            ? [
                {
                  key: 'save',
                  rows: [
                    {
                      key: 'save',
                      label: 'Save changes',
                      control: (
                        <Button
                          size="sm"
                          onPress={handleSave}
                          disabled={saving}
                          loading={saving}
                        >
                          Save changes
                        </Button>
                      ),
                    },
                  ],
                },
              ]
            : []),
          {
            key: 'actions',
            label: t('ui.settings.account.actions'),
            rows: [
              {
                key: 'signout',
                label: 'Sign out',
                description: t('ui.settings.account.signOutDevice'),
                control: (
                  <Button
                    size="sm"
                    appearance="subtle"
                    onPress={() => signOutDialog.open()}
                  >
                    Sign out
                  </Button>
                ),
              },
            ],
          },
        ]}
      />
      <Dialog
        control={signOutDialog}
        title={t('ui.settings.account.signOutTitle')}
        description={t('ui.settings.account.signOutDescription')}
        actions={[
          {
            label: t('ui.settings.account.signOut'),
            color: 'destructive',
            onPress: handleSignOut,
          },
          { label: t('common.cancel'), color: 'cancel' },
        ]}
      />
    </>
  );
}
