import { Textarea } from '@oxy.so/bloom/textarea';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import {
  SettingsProfilePage,
  SettingsTextField,
} from '@oxy.so/bloom/settings-modal';
import { Button, IconButton } from '@oxy.so/bloom/button';
import { Dialog, useDialogControl } from '@oxy.so/bloom/dialog';
import { toast } from '@oxy.so/bloom/toast';
import { RiEditLine, RiDeleteBin6Line } from '@oxy.so/bloom/icons';
import { useTranslation } from '@/lib/i18n';
import { Switch } from '@oxy.so/bloom/switch';
import { useContacts } from '@/hooks/queries/useContacts';
import {
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
} from '@/hooks/mutations/useContactMutations';
const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export function ContactsSection() {
  const { t } = useTranslation();

  const [search, setSearch] = useState('');
  const { data: contacts = [] } = useContacts(search);
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
    (contact: {
      _id: string;
      name: string;
      email: string;
      company?: string;
      notes?: string;
      starred: boolean;
    }) => {
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
    const payload = {
      name: name.trim(),
      email: email.trim(),
      company: company.trim() || undefined,
      notes: notes.trim() || undefined,
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
                  <SettingsTextField
                    label={t('ui.settings.contacts.search')}
                    value={search}
                    onCommit={setSearch}
                    showSavedToast={false}
                  />
                ),
              },
            ],
          },
          {
            key: 'contacts',
            label: t('ui.settings.contacts.your'),
            description: contacts.length
              ? undefined
              : t(
                  search.trim()
                    ? 'ui.settings.contacts.noMatch'
                    : 'ui.settings.contacts.empty',
                ),
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
                  <SettingsTextField
                    label={t('ui.settings.contacts.name')}
                    value={name}
                    onCommit={setName}
                    showSavedToast={false}
                  />
                ),
              },
              {
                key: 'email',
                label: t('ui.settings.contacts.email'),
                control: (
                  <SettingsTextField
                    label={t('ui.settings.contacts.email')}
                    value={email}
                    onCommit={setEmail}
                    keyboardType="email-address"
                    showSavedToast={false}
                  />
                ),
              },
              {
                key: 'company',
                label: t('ui.settings.contacts.company'),
                control: (
                  <SettingsTextField
                    label={t('ui.settings.contacts.company')}
                    value={company}
                    onCommit={setCompany}
                    showSavedToast={false}
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
                    value={starred}
                    onValueChange={setStarred}
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
                      size="sm"
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
                      <Button size="sm" appearance="subtle" onPress={resetForm}>
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
