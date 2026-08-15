/**
 * Contacts subscreen — create, edit, star, and delete saved contacts.
 *
 * screen → mutation hook (`useContactMutations`) → API. The list reacts
 * instantly via the optimistic updates in the mutation hooks; this component
 * only orchestrates form state and confirmation dialogs.
 */

import React, { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Button } from '@oxyhq/bloom/button';
import { Switch } from '@oxyhq/bloom/switch';
import { Text } from '@oxyhq/bloom/typography';
import { useTheme } from '@oxyhq/bloom/theme';
import { Admonition } from '@oxyhq/bloom/admonition';
import { Dialog, useDialogControl, toast } from '@oxyhq/bloom';
import {
  UserCircle_Stroke2_Corner0_Rounded,
  MagnifyingGlass_Stroke2_Corner0_Rounded,
  Pencil_Stroke2_Corner0_Rounded,
  Trash_Stroke2_Corner0_Rounded,
  PlusSmall_Stroke2_Corner0_Rounded,
  CircleCheck_Stroke2_Corner0_Rounded,
} from '@oxyhq/bloom/icons';

import { useColors } from '@/constants/theme';
import { useTranslation } from '@/lib/i18n';
import { SectionHeader } from '@/components/settings/SectionHeader';
import { useContacts } from '@/hooks/queries/useContacts';
import {
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
} from '@/hooks/mutations/useContactMutations';

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export function ContactsSection() {
  const colors = useColors();
  const theme = useTheme();
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
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setName('');
    setEmail('');
    setCompany('');
    setNotes('');
    setStarred(false);
  }, []);

  const startEdit = useCallback(
    (contact: { _id: string; name: string; email: string; company?: string; notes?: string; starred: boolean }) => {
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
  const submitting = editingId ? updateContact.isPending : createContact.isPending;

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
  }, [formValid, name, email, company, notes, starred, editingId, updateContact, createContact, resetForm, t]);

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

  const inputStyle = {
    color: colors.text,
    backgroundColor: theme.colors.background,
    borderColor: colors.border,
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      {/* Search + list */}
      <View style={styles.subsection}>
        <SectionHeader icon={UserCircle_Stroke2_Corner0_Rounded} title={t('ui.settings.contacts.your')} />
        <View style={[styles.searchRow, { borderColor: colors.border, backgroundColor: theme.colors.background }]}>
          <MagnifyingGlass_Stroke2_Corner0_Rounded size="sm" style={{ color: colors.secondaryText }} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('ui.settings.contacts.search')}
            placeholderTextColor={colors.secondaryText}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>
        {contacts.length === 0 ? (
          <Admonition type="info">
            {search.trim()
              ? t('ui.settings.contacts.noMatch')
              : t('ui.settings.contacts.empty')}
          </Admonition>
        ) : (
          <View style={[styles.itemList, { borderColor: colors.border }]}>
            {contacts.map((c, idx) => (
              <View
                key={c._id}
                style={[
                  styles.itemRow,
                  idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                  editingId === c._id && { backgroundColor: theme.colors.background },
                ]}
              >
                <View style={styles.itemMain}>
                  <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
                    {c.starred ? '★ ' : ''}{c.name}
                  </Text>
                  <Text style={[styles.itemSub, { color: colors.secondaryText }]} numberOfLines={1}>
                    {c.company ? `${c.email} · ${c.company}` : c.email}
                  </Text>
                </View>
                <Pressable
                  onPress={() => startEdit(c)}
                  style={styles.iconBtn}
                  accessibilityRole="button"
                  accessibilityLabel={t('ui.settings.contacts.edit', { name: c.name })}
                >
                  <Pencil_Stroke2_Corner0_Rounded size="sm" style={{ color: colors.icon }} />
                </Pressable>
                <Pressable
                  onPress={() => {
                    setPendingDelete({ id: c._id, name: c.name });
                    deleteConfirm.open();
                  }}
                  style={styles.iconBtn}
                  accessibilityRole="button"
                  accessibilityLabel={t('ui.settings.contacts.delete', { name: c.name })}
                >
                  <Trash_Stroke2_Corner0_Rounded size="sm" style={{ color: colors.error }} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Create / edit form */}
      <View style={styles.subsection}>
        <SectionHeader
          icon={editingId ? Pencil_Stroke2_Corner0_Rounded : PlusSmall_Stroke2_Corner0_Rounded}
          title={editingId ? t('ui.settings.contacts.editContact') : t('ui.settings.contacts.addContact')}
        />
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('ui.settings.contacts.name')}
          placeholderTextColor={colors.secondaryText}
          style={[styles.input, inputStyle]}
        />
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder={t('ui.settings.contacts.email')}
          placeholderTextColor={colors.secondaryText}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, inputStyle]}
        />
        <TextInput
          value={company}
          onChangeText={setCompany}
          placeholder={t('ui.settings.contacts.company')}
          placeholderTextColor={colors.secondaryText}
          style={[styles.input, inputStyle]}
        />
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder={t('ui.settings.contacts.notes')}
          placeholderTextColor={colors.secondaryText}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          style={[styles.textArea, inputStyle]}
        />
        <View style={styles.starRow}>
          <Text style={[styles.starLabel, { color: colors.text }]}>{t('ui.settings.contacts.star')}</Text>
          <Switch value={starred} onValueChange={setStarred} />
        </View>
        <View style={styles.buttonRow}>
          <Button
            onPress={handleSubmit}
            disabled={!formValid || submitting}
            icon={
              editingId ? (
                <CircleCheck_Stroke2_Corner0_Rounded size="sm" style={{ color: '#FFFFFF' }} />
              ) : (
                <PlusSmall_Stroke2_Corner0_Rounded size="sm" style={{ color: '#FFFFFF' }} />
              )
            }
            iconPosition="left"
          >
            {submitting
              ? editingId
                ? t('ui.settings.contacts.saving')
                : t('ui.settings.contacts.adding')
              : editingId
                ? t('ui.settings.contacts.saveChanges')
                : t('ui.settings.contacts.addContact')}
          </Button>
          {editingId ? (
            <Button variant="text" onPress={resetForm}>
              {t('common.cancel')}
            </Button>
          ) : null}
        </View>
      </View>

      <Dialog
        control={deleteConfirm}
        title={t('ui.settings.contacts.deleteTitle')}
        description={
          pendingDelete ? t('ui.settings.contacts.deleteDescription', { name: pendingDelete.name }) : ''
        }
        actions={[
          { label: t('common.delete'), color: 'destructive', onPress: handleDelete },
          { label: t('common.cancel'), color: 'cancel' },
        ]}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 28,
  },
  subsection: {
    gap: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 2,
  },
  itemList: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  itemMain: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  itemSub: {
    fontSize: 13,
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 72,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  starLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
});
