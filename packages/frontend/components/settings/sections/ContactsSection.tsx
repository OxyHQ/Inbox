import { TextFieldInput } from '@oxy.so/bloom/text-field';
import { EmptyStateSticker } from '@/components/EmptyStateSticker';
import {
  useCreateContact,
  useDeleteContact,
  useUpdateContact,
} from '@/hooks/mutations/useContactMutations';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useContacts } from '@/hooks/queries/useContacts';
import { useTranslation } from '@/lib/i18n';
import type { Contact } from '@/schemas/emailSchemas';
import { Button, IconButton } from '@oxy.so/bloom/button';
import { Dialog, useDialogControl } from '@oxy.so/bloom/dialog';
import { RiDeleteBin6Line, RiEditLine } from '@oxy.so/bloom/icons';
import {
  SettingsProfilePage,
} from '@oxy.so/bloom/settings-modal';
import { Switch } from '@oxy.so/bloom/switch';
import { Textarea } from '@oxy.so/bloom/textarea';
import { toast } from '@oxy.so/bloom/toast';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export function ContactsSection() {
  const { t } = useTranslation();

  const [search, setSearch] = useState('');
  // Searched once the user pauses typing, not once per keystroke.
  const searchQuery = useDebouncedValue(search, 250);
  const { data: contacts = [] } = useContacts(searchQuery);
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [notes, setNotes] = useState('');
  const [starred, setStarred] = useState(false);

  const deleteConfirm = useDialogControl();
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setName('');
    setEmail('');
    setCompany('');
    setNotes('');
    setStarred(false);
  }, []);

  const startEdit = useCallback(
    (
      contact: Pick<
        Contact,
        '_id' | 'name' | 'email' | 'company' | 'notes' | 'starred'
      >,
    ) => {
      setEditingId(contact._id);
      setName(contact.name);
      setEmail(contact.email);
      setCompany(contact.company ?? '');
      setNotes(contact.notes ?? '');
      setStarred(contact.starred);
    },
    [],
  );

  const formValid = name.trim().length > 0 && isValidEmail(email.trim());
  const submitting = editingId
    ? updateContact.isPending
    : createContact.isPending;

  const handleSubmit = useCallback(() => {
    if (!formValid) {
      toast.error(t('contacts.toast.nameEmailRequired'));
      return;
    }
    // On an edit, an emptied field is sent as '' — which the server stores as
    // "none" — not left out: left out, it kept its old value, so a company or
    // a note could never be removed.
    const optional = (value: string) => (editingId ? value.trim() : value.trim() || undefined);
    const payload = {
      name: name.trim(),
      email: email.trim(),
      company: optional(company),
      notes: optional(notes),
      starred,
    };
    if (editingId) {
      updateContact.mutate(
        { contactId: editingId, ...payload },
        {
          onSuccess: () => {
            resetForm();
            toast.success(t('contacts.toast.updated'));
          },
        },
      );
      return;
    }
    createContact.mutate(payload, {
      onSuccess: () => {
        resetForm();
        toast.success(t('contacts.toast.created'));
      },
    });
  }, [
    formValid,
    name,
    email,
    company,
    notes,
    starred,
    editingId,
    updateContact,
    createContact,
    resetForm,
    t,
  ]);

  const handleDelete = useCallback(() => {
    if (!pendingDelete) return;
    deleteContact.mutate(pendingDelete.id, {
      onSuccess: () => {
        toast.success(t('contacts.toast.deleted'));
        if (editingId === pendingDelete.id) resetForm();
        setPendingDelete(null);
      },
    });
  }, [pendingDelete, deleteContact, editingId, resetForm, t]);

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
              title: t(
                search.trim()
                  ? 'ui.settings.contacts.noMatch'
                  : 'empty.contactsTitle',
              ),
              description: t(
                search.trim()
                  ? 'empty.contactsNoMatchDescription'
                  : 'empty.contactsDescription',
              ),
              action: search.trim()
                ? { label: t('search.clear'), onPress: () => setSearch('') }
                : undefined,
            },
            label: t('ui.settings.contacts.your'),
            rows: contacts.map((contact) => ({
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
                      setPendingDelete({ id: contact._id, name: contact.name });
                      deleteConfirm.open();
                    }}
                  />
                </View>
              ),
            })),
          },
          {
            key: 'form',
            label: t(
              editingId
                ? 'ui.settings.contacts.editContact'
                : 'ui.settings.contacts.addContact',
            ),
            rows: [
              {
                key: 'name',
                label: t('ui.settings.contacts.name'),
                control: (
                  <TextFieldInput
                    label={t('ui.settings.contacts.name')}
                    value={name}
                    onChangeText={setName}
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
                    onChangeText={setEmail}
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
                    onChangeText={setCompany}
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
                    onChangeText={setNotes}
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
                    onCheckedChange={setStarred}
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
                      disabled={!formValid || submitting}
                      loading={submitting}
                    >
                      {t(
                        editingId
                          ? 'ui.settings.contacts.saveChanges'
                          : 'ui.settings.contacts.addContact',
                      )}
                    </Button>
                    {editingId ? (
                      <Button appearance="subtle" onPress={resetForm}>
                        {t('common.cancel')}
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
          pendingDelete
            ? t('ui.settings.contacts.deleteDescription', {
                name: pendingDelete.name,
              })
            : ''
        }
        actions={[
          {
            label: t('common.delete'),
            color: 'destructive',
            onPress: handleDelete,
          },
          { label: t('common.cancel'), color: 'cancel' },
        ]}
      />
    </>
  );
}
