import { TextFieldInput } from '@oxy.so/bloom/text-field';
import { EmptyStateSticker } from '@/components/EmptyStateSticker';
import {
  useCreateContact,
  useDeleteContact,
  useUpdateContact,
} from '@/hooks/mutations/useContactMutations';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { isCurrentEmailOwner, useEmailMutationOwner } from '@/hooks/mutations/ownedEmailMutation';
import { useContacts } from '@/hooks/queries/useContacts';
import { useTranslation } from '@/lib/i18n';
import type { Contact } from '@/schemas/emailSchemas';
import { Button, IconButton } from '@oxy.so/bloom/button';
import { Dialog, useDialogControl } from '@oxy.so/bloom/dialog';
import { RiDeleteBin6Line } from '@oxy.so/bloom/icons/RiDeleteBin6Line';
import { RiEditLine } from '@oxy.so/bloom/icons/RiEditLine';
import { SettingsProfilePage } from '@oxy.so/bloom/settings-modal';
import { Switch } from '@oxy.so/bloom/switch';
import { Textarea } from '@oxy.so/bloom/textarea';
import { toast } from '@oxy.so/bloom/toast';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
type ContactFormBinding = {
  owner: ReturnType<typeof useEmailMutationOwner>;
  create: ReturnType<typeof useCreateContact>['mutate'];
  update: ReturnType<typeof useUpdateContact>['mutate'];
};
type ContactForm = {
  editingId: string | null;
  name: string;
  email: string;
  company: string;
  notes: string;
  starred: boolean;
  binding: ContactFormBinding | null;
};
const emptyContactForm = (): ContactForm => ({
  editingId: null,
  name: '',
  email: '',
  company: '',
  notes: '',
  starred: false,
  binding: null,
});

export function ContactsSection() {
  const { t } = useTranslation();

  const [search, setSearch] = useState('');
  // Searched once the user pauses typing, not once per keystroke.
  const searchQuery = useDebouncedValue(search, 250);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useContacts(searchQuery);
  // A contact created or deleted between two page reads shifts every offset
  // after it, so the next page can repeat a row already shown: keep the first.
  const contacts = useMemo(() => {
    const seen = new Set<string>();
    const rows: Contact[] = [];
    for (const page of data?.pages ?? []) {
      for (const contact of page.data) {
        if (seen.has(contact._id)) continue;
        seen.add(contact._id);
        rows.push(contact);
      }
    }
    return rows;
  }, [data]);
  const totalContacts = data?.pages.at(-1)?.pagination.total ?? contacts.length;
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();
  const contactOwner = useEmailMutationOwner(true);

  const [form, setForm] = useState(emptyContactForm);
  const { editingId, name, email, company, notes, starred, binding } = form;
  const formUnavailable = Boolean(binding && !isCurrentEmailOwner(binding.owner));
  const deleteConfirm = useDialogControl();
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
    owner: typeof contactOwner;
    mutate: typeof deleteContact.mutate;
    form: ContactForm;
  } | null>(null);

  const resetForm = () => setForm(emptyContactForm());
  const startEdit = (
    contact: Pick<Contact, '_id' | 'name' | 'email' | 'company' | 'notes' | 'starred'>,
  ) => {
    setForm({
      editingId: contact._id,
      name: contact.name,
      email: contact.email,
      company: contact.company ?? '',
      notes: contact.notes ?? '',
      starred: contact.starred,
      binding: { owner: contactOwner, create: createContact.mutate, update: updateContact.mutate },
    });
  };

  const formValid = name.trim().length > 0 && isValidEmail(email.trim());
  const submitting = editingId ? updateContact.isPending : createContact.isPending;
  const handleSubmit = () => {
    const snapshot = form;
    const captured = snapshot.binding;
    if (!formValid) {
      toast.error(t('contacts.toast.nameEmailRequired'));
      return;
    }
    if (!captured || !isCurrentEmailOwner(captured.owner)) return;
    // On edit an empty optional field explicitly clears its server value.
    const optional = (value: string) =>
      snapshot.editingId ? value.trim() : value.trim() || undefined;
    const payload = {
      name: snapshot.name.trim(),
      email: snapshot.email.trim(),
      company: optional(snapshot.company),
      notes: optional(snapshot.notes),
      starred: snapshot.starred,
    };
    const onSuccess = () => {
      if (!isCurrentEmailOwner(captured.owner)) return;
      toast.success(t(snapshot.editingId ? 'contacts.toast.updated' : 'contacts.toast.created'));
      if (!isCurrentEmailOwner(captured.owner)) return;
      setForm((current) => (current === snapshot ? emptyContactForm() : current));
    };
    if (snapshot.editingId)
      captured.update({ contactId: snapshot.editingId, ...payload }, { onSuccess });
    else captured.create(payload, { onSuccess });
  };

  const handleDelete = () => {
    const target = pendingDelete;
    if (!target) return;
    target.mutate(
      { contactId: target.id },
      {
        onSuccess: () => {
          if (!isCurrentEmailOwner(target.owner)) return;
          toast.success(t('contacts.toast.deleted'));
          if (!isCurrentEmailOwner(target.owner)) return;
          setForm((current) =>
            current === target.form && current.editingId === target.id
              ? emptyContactForm()
              : current,
          );
          setPendingDelete((current) => (current === target ? null : current));
        },
      },
    );
  };

  return (
    <>
      <SettingsProfilePage
        sections={[
          {
            key: 'search',
            rows: [
              {
                key: 'search',
                label: t('ui.settings.contacts.search'),
                control: (
                  <TextFieldInput
                    label={t('ui.settings.contacts.search')}
                    value={search}
                    onChangeText={setSearch}
                  />
                ),
              },
            ],
          },
          {
            key: 'contacts',
            emptyState: {
              variant: 'compact',
              illustration: <EmptyStateSticker name="conversation" size={80} />,
              title: t(search.trim() ? 'ui.settings.contacts.noMatch' : 'empty.contactsTitle'),
              description: t(
                search.trim() ? 'empty.contactsNoMatchDescription' : 'empty.contactsDescription',
              ),
              action: search.trim()
                ? { label: t('search.clear'), onPress: () => setSearch('') }
                : undefined,
            },
            label: t('ui.settings.contacts.your'),
            rows: [
              ...contacts.map((contact) => ({
                key: contact._id,
                label: `${contact.starred ? '★ ' : ''}${contact.name}`,
                description: contact.company
                  ? `${contact.email} · ${contact.company}`
                  : contact.email,
                control: (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <IconButton
                      accessibilityLabel={t('ui.settings.contacts.edit', {
                        name: contact.name,
                      })}
                      icon={<RiEditLine />}
                      onPress={() => startEdit(contact)}
                    />
                    <IconButton
                      accessibilityLabel={t('ui.settings.contacts.delete', {
                        name: contact.name,
                      })}
                      icon={<RiDeleteBin6Line />}
                      onPress={() => {
                        setPendingDelete({
                          id: contact._id,
                          name: contact.name,
                          form,
                          owner: contactOwner,
                          mutate: deleteContact.mutate,
                        });
                        deleteConfirm.open();
                      }}
                    />
                  </View>
                ),
              })),
              ...(hasNextPage
                ? [
                    {
                      key: 'load-more',
                      label: t('ui.settings.contacts.loadMore'),
                      description: t('ui.settings.contacts.showing', {
                        shown: contacts.length,
                        total: Math.max(totalContacts, contacts.length),
                      }),
                      control: (
                        <Button
                          appearance="subtle"
                          onPress={() => {
                            if (!isFetchingNextPage) void fetchNextPage();
                          }}
                          disabled={isFetchingNextPage}
                          loading={isFetchingNextPage}
                        >
                          {t('ui.settings.contacts.loadMore')}
                        </Button>
                      ),
                    },
                  ]
                : []),
            ],
          },
          {
            key: 'form',
            label: t(
              editingId ? 'ui.settings.contacts.editContact' : 'ui.settings.contacts.addContact',
            ),
            rows: [
              ...(formUnavailable
                ? [
                    {
                      key: 'owner-unavailable',
                      label: t('contacts.form.sessionChanged'),
                      control: null,
                    },
                  ]
                : []),
              {
                key: 'name',
                label: t('ui.settings.contacts.name'),
                control: (
                  <TextFieldInput
                    label={t('ui.settings.contacts.name')}
                    value={name}
                    onChangeText={(value) =>
                      setForm((current) => ({
                        ...current,
                        name: value,
                        binding: current.binding ?? {
                          owner: contactOwner,
                          create: createContact.mutate,
                          update: updateContact.mutate,
                        },
                      }))
                    }
                  />
                ),
              },
              {
                key: 'email',
                label: t('ui.settings.contacts.email'),
                control: (
                  <TextFieldInput
                    label={t('ui.settings.contacts.email')}
                    value={email}
                    onChangeText={(value) =>
                      setForm((current) => ({
                        ...current,
                        email: value,
                        binding: current.binding ?? {
                          owner: contactOwner,
                          create: createContact.mutate,
                          update: updateContact.mutate,
                        },
                      }))
                    }
                    keyboardType="email-address"
                  />
                ),
              },
              {
                key: 'company',
                label: t('ui.settings.contacts.company'),
                control: (
                  <TextFieldInput
                    label={t('ui.settings.contacts.company')}
                    value={company}
                    onChangeText={(value) =>
                      setForm((current) => ({
                        ...current,
                        company: value,
                        binding: current.binding ?? {
                          owner: contactOwner,
                          create: createContact.mutate,
                          update: updateContact.mutate,
                        },
                      }))
                    }
                  />
                ),
              },
              {
                key: 'notes',
                label: t('ui.settings.contacts.notes'),
                control: (
                  <Textarea
                    accessibilityLabel={t('ui.settings.contacts.notes')}
                    value={notes}
                    onChangeText={(value) =>
                      setForm((current) => ({
                        ...current,
                        notes: value,
                        binding: current.binding ?? {
                          owner: contactOwner,
                          create: createContact.mutate,
                          update: updateContact.mutate,
                        },
                      }))
                    }
                    rows={3}
                    style={{ width: 202, maxWidth: '100%', flexGrow: 1 }}
                  />
                ),
              },
              {
                key: 'star',
                label: t('ui.settings.contacts.star'),
                control: (
                  <Switch
                    accessibilityLabel={t('ui.settings.contacts.star')}
                    checked={starred}
                    onCheckedChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        starred: value,
                        binding: current.binding ?? {
                          owner: contactOwner,
                          create: createContact.mutate,
                          update: updateContact.mutate,
                        },
                      }))
                    }
                  />
                ),
              },
              {
                key: 'save',
                label: t(
                  editingId
                    ? 'ui.settings.contacts.saveChanges'
                    : 'ui.settings.contacts.addContact',
                ),
                control: (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Button
                      onPress={handleSubmit}
                      disabled={!formValid || submitting || formUnavailable}
                      loading={submitting}
                    >
                      {t(
                        editingId
                          ? 'ui.settings.contacts.saveChanges'
                          : 'ui.settings.contacts.addContact',
                      )}
                    </Button>
                    {editingId || formUnavailable ? (
                      <Button appearance="subtle" onPress={resetForm}>
                        {t(formUnavailable ? 'contacts.form.discard' : 'common.cancel')}
                      </Button>
                    ) : null}
                  </View>
                ),
              },
            ],
          },
        ]}
      />
      <Dialog
        control={deleteConfirm}
        title={t('ui.settings.contacts.deleteTitle')}
        description={
          pendingDelete && !isCurrentEmailOwner(pendingDelete.owner)
            ? t(
                isCurrentEmailOwner(contactOwner)
                  ? 'contacts.toast.selectionExpired'
                  : 'contacts.toast.sessionUnavailable',
              )
            : pendingDelete
              ? t('ui.settings.contacts.deleteDescription', {
                  name: pendingDelete.name,
                })
              : ''
        }
        actions={[
          {
            label: t('common.delete'),
            color: 'destructive',
            disabled: !pendingDelete || !isCurrentEmailOwner(pendingDelete.owner),
            onPress: handleDelete,
          },
          { label: t('common.cancel'), color: 'cancel' },
        ]}
      />
    </>
  );
}
