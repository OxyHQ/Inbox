import { useSettings, useUpdateSettings } from '@/hooks/queries/useSettings';
import { isCurrentEmailOwner, useEmailMutationOwner } from '@/hooks/mutations/ownedEmailMutation';
import { useTranslation } from '@/lib/i18n';
import { isValidRecipientEmail } from '@/schemas/emailSchemas';
import type { EmailSettings } from '@/services/emailApi';
import { Button } from '@oxy.so/bloom/button';
import { Dialog, useDialogControl } from '@oxy.so/bloom/dialog';
import { SettingsProfilePage, SettingsValueField } from '@oxy.so/bloom/settings-modal';
import { Switch } from '@oxy.so/bloom/switch';
import { Textarea } from '@oxy.so/bloom/textarea';
import { toast } from '@oxy.so/bloom/toast';
import { getNormalizedUserHandle } from '@oxy.so/core';
import { useOxy } from '@oxy.so/services/ui/client';
import { useCallback, useState } from 'react';
import { TextFieldInput } from '@oxy.so/bloom/text-field';
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

/** Carry the user's changed fields forward while refreshing untouched fields. */
function mergeSettingsDraft(
  draft: SettingsDraft,
  previous: SettingsDraft,
  next: SettingsDraft,
): SettingsDraft {
  const field = <T,>(value: T, old: T, incoming: T): T =>
    Object.is(value, old) ? incoming : value;
  return {
    signature: field(draft.signature, previous.signature, next.signature),
    autoReplyEnabled: field(
      draft.autoReplyEnabled,
      previous.autoReplyEnabled,
      next.autoReplyEnabled,
    ),
    autoReplySubject: field(
      draft.autoReplySubject,
      previous.autoReplySubject,
      next.autoReplySubject,
    ),
    autoReplyBody: field(draft.autoReplyBody, previous.autoReplyBody, next.autoReplyBody),
    autoForwardTo: field(draft.autoForwardTo, previous.autoForwardTo, next.autoForwardTo),
    autoForwardKeepCopy: field(
      draft.autoForwardKeepCopy,
      previous.autoForwardKeepCopy,
      next.autoForwardKeepCopy,
    ),
  };
}

type SettingsBinding = {
  owner: ReturnType<typeof useEmailMutationOwner>;
  mutate: ReturnType<typeof useUpdateSettings>['mutate'];
};
type SettingsForm = {
  serverSnapshot: EmailSettings | undefined;
  draft: SettingsDraft;
  binding: SettingsBinding | null;
};

/** Keep edits while the server snapshot changes, binding them to their starting session. */
function useDirtySettings(
  settingsData: EmailSettings | undefined,
  owner: SettingsBinding['owner'],
  mutate: SettingsBinding['mutate'],
) {
  const [form, setForm] = useState<SettingsForm>(() => ({
    serverSnapshot: settingsData,
    draft: toDraft(settingsData),
    binding: null,
  }));

  if (settingsData !== form.serverSnapshot) {
    const draft = mergeSettingsDraft(
      form.draft,
      toDraft(form.serverSnapshot),
      toDraft(settingsData),
    );
    setForm({
      serverSnapshot: settingsData,
      draft,
      binding: draftsEqual(draft, toDraft(settingsData)) ? null : form.binding,
    });
  }

  const setField = useCallback(
    <K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) => {
      setForm((current) => {
        const draft = { ...current.draft, [key]: value };
        return {
          ...current,
          draft,
          binding: draftsEqual(draft, toDraft(current.serverSnapshot))
            ? null
            : (current.binding ?? { owner, mutate }),
        };
      });
    },
    [owner, mutate],
  );
  const discard = useCallback(() => {
    setForm({ serverSnapshot: settingsData, draft: toDraft(settingsData), binding: null });
  }, [settingsData]);

  return {
    draft: form.draft,
    setField,
    discard,
    binding: form.binding,
    dirty: !draftsEqual(form.draft, toDraft(settingsData)),
  };
}

export function AccountSection() {
  const { t } = useTranslation();
  const { user, logout } = useOxy();
  const { data: settingsData, fetchStatus } = useSettings();
  const updateSettings = useUpdateSettings();
  const owner = useEmailMutationOwner(true);
  const { draft, setField, discard, binding, dirty } = useDirtySettings(
    settingsData,
    owner,
    updateSettings.mutate,
  );
  const draftUnavailable = Boolean(binding && !isCurrentEmailOwner(binding.owner));
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
    if (!settingsData) return;
    // Only what changed. Every save used to send the whole object: the
    // vacation window's dates (which this form does not show) were wiped, and a
    // draft seeded from a stale cache reverted changes made on another device.
    const saved = toDraft(settingsData);
    const forwardTo = autoForwardTo.trim();
    if (forwardTo && !isValidRecipientEmail(forwardTo)) {
      toast.error(t('compose.toast.invalidEmail'));
      return;
    }
    const autoReplyChanged =
      autoReplyEnabled !== saved.autoReplyEnabled ||
      autoReplySubject !== saved.autoReplySubject ||
      autoReplyBody !== saved.autoReplyBody;
    const captured = binding;
    if (!captured || !isCurrentEmailOwner(captured.owner)) return;
    captured.mutate(
      {
        ...(signature !== saved.signature ? { signature } : {}),
        ...(autoReplyChanged
          ? {
              autoReply: {
                enabled: autoReplyEnabled,
                subject: autoReplySubject,
                body: autoReplyBody,
                // The server rewrites the whole responder; keep its window.
                startDate: settingsData?.autoReply.startDate ?? null,
                endDate: settingsData?.autoReply.endDate ?? null,
              },
            }
          : {}),
        ...(forwardTo !== saved.autoForwardTo.trim() ? { autoForwardTo: forwardTo } : {}),
        ...(autoForwardKeepCopy !== saved.autoForwardKeepCopy ? { autoForwardKeepCopy } : {}),
      },
      {
        onSuccess: () => toast.success(t('ui.settings.account.updated')),
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : t('ui.settings.account.saveFailed');
          toast.error(message);
        },
      },
    );
  }, [
    settingsData,
    signature,
    autoReplyEnabled,
    autoReplySubject,
    autoReplyBody,
    autoForwardTo,
    autoForwardKeepCopy,
    binding,
    t,
  ]);

  const signOutDialog = useDialogControl();

  const fullName =
    user?.name?.displayName ?? getNormalizedUserHandle(user) ?? t('ui.settings.account.title');

  const emailAddress = user?.email || (user ? `${user.username}@oxy.so` : '');

  const handleSignOut = useCallback(async () => {
    try {
      await logout();
      toast.success(t('ui.settings.account.signedOut'));
    } catch (err) {
      const message = err instanceof Error ? err.message : t('ui.settings.account.signOutFailed');
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
                control: <SettingsValueField>{emailAddress}</SettingsValueField>,
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
                label: t('ui.settings.account.vacation'),
                description: autoReplyEnabled
                  ? t('ui.settings.account.vacationOn')
                  : t('ui.settings.account.vacationOff'),
                control: (
                  <Switch
                    accessibilityLabel={t('ui.settings.account.vacation')}
                    checked={autoReplyEnabled}
                    onCheckedChange={(v) => setField('autoReplyEnabled', v)}
                  />
                ),
              },
              ...(autoReplyEnabled
                ? [
                    {
                      key: 'subject',
                      label: t('ui.settings.account.subjectPlaceholder'),
                      control: (
                        <TextFieldInput
                          label={t('ui.settings.account.subjectPlaceholder')}
                          value={autoReplySubject}
                          onChangeText={(v) => setField('autoReplySubject', v)}
                        />
                      ),
                    },
                    {
                      key: 'body',
                      label: t('ui.settings.account.messagePlaceholder'),
                      control: (
                        <Textarea
                          accessibilityLabel={t('ui.settings.account.messagePlaceholder')}
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
                  <TextFieldInput
                    label={t('ui.settings.account.forwarding')}
                    value={autoForwardTo}
                    onChangeText={(v) => setField('autoForwardTo', v)}
                    placeholder={t('ui.settings.account.forwardingPlaceholder')}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                ),
              },
              ...(autoForwardTo.trim()
                ? [
                    {
                      key: 'keep-copy',
                      label: t('ui.settings.account.keepCopy'),
                      description: t('ui.settings.account.keepCopyDescription'),
                      control: (
                        <Switch
                          accessibilityLabel={t('ui.settings.account.keepCopy')}
                          checked={autoForwardKeepCopy}
                          onCheckedChange={(v) => setField('autoForwardKeepCopy', v)}
                        />
                      ),
                    },
                  ]
                : []),
            ],
          },
          ...(!settingsData
            ? [
                {
                  key: 'settings-unavailable',
                  rows: [
                    {
                      key: 'settings-unavailable',
                      label: t(
                        fetchStatus === 'fetching'
                          ? 'ui.settings.account.loadingSettings'
                          : 'ui.settings.account.settingsUnavailable',
                      ),
                      control: null,
                    },
                  ],
                },
              ]
            : []),
          ...(draftUnavailable
            ? [
                {
                  key: 'draft-unavailable',
                  rows: [
                    {
                      key: 'draft-unavailable',
                      label: t('ui.settings.account.draftSessionChanged'),
                      control: (
                        <Button appearance="subtle" onPress={discard}>
                          {t('ui.settings.account.discardDraft')}
                        </Button>
                      ),
                    },
                  ],
                },
              ]
            : []),
          ...(dirty
            ? [
                {
                  key: 'save',
                  rows: [
                    {
                      key: 'save',
                      label: t('ui.settings.account.saveChanges'),
                      control: (
                        <Button
                          onPress={handleSave}
                          disabled={saving || draftUnavailable || !settingsData}
                          loading={saving}
                        >
                          {t('ui.settings.account.saveChanges')}
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
                label: t('ui.settings.account.signOut'),
                description: t('ui.settings.account.signOutDevice'),
                control: (
                  <Button appearance="subtle" onPress={() => signOutDialog.open()}>
                    {t('ui.settings.account.signOut')}
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
