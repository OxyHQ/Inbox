import { EmptyStateSticker } from '@/components/EmptyStateSticker';
import {
  isLabelNameTaken,
  useCreateLabel,
  useDeleteLabel,
  useLabels,
  useUpdateLabel,
} from '@/hooks/queries/useLabels';
import { useTranslation } from '@/lib/i18n';
import { Button, IconButton } from '@oxy.so/bloom/button';
import { Dialog, useDialogControl } from '@oxy.so/bloom/dialog';
import { RiDeleteBin6Line, RiEditLine } from '@oxy.so/bloom/icons';
import { SettingsValueField, SettingsProfilePage } from '@oxy.so/bloom/settings-modal';
import { TextFieldInput } from '@oxy.so/bloom/text-field';
import { toast } from '@oxy.so/bloom/toast';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { SettingsPreferenceSelect } from '../SettingsPreferenceSelect';
const LABEL_COLORS = [
  '#4285f4',
  '#ea4335',
  '#fbbc04',
  '#34a853',
  '#ff6d01',
  '#46bdc6',
  '#7b1fa2',
  '#c2185b',
  '#795548',
  '#607d8b',
] as const;

/** Names of LABEL_COLORS, in order: keys under `ui.settings.labels.colors`. */
const LABEL_COLOR_NAMES = [
  'blue',
  'red',
  'yellow',
  'green',
  'orange',
  'cyan',
  'purple',
  'pink',
  'brown',
  'gray',
] as const;
const DEFAULT_NEW_COLOR = LABEL_COLORS[0];

export function LabelsSection() {
  const { t } = useTranslation();
  const { data: labels = [] } = useLabels();
  const createLabel = useCreateLabel();
  const updateLabel = useUpdateLabel();
  const deleteLabel = useDeleteLabel();

  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState<string>(DEFAULT_NEW_COLOR);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingLabelName, setEditingLabelName] = useState('');

  const deleteConfirm = useDialogControl();
  const [labelPendingDelete, setLabelPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Failures are reported by the mutation hooks — one toast each, including
  // "a label with that name already exists" for the server's 409.
  const handleCreate = useCallback(() => {
    const name = newLabelName.trim();
    if (!name) return;
    if (isLabelNameTaken(labels, name)) {
      toast.error(t('ui.mutations.labelNameTaken', { name }));
      return;
    }
    createLabel.mutate(
      { name, color: newLabelColor },
      {
        onSuccess: () => {
          setNewLabelName('');
          setNewLabelColor(DEFAULT_NEW_COLOR);
          toast.success(t('common.success'));
        },
      },
    );
  }, [newLabelName, newLabelColor, labels, createLabel, t]);

  const handleUpdateName = useCallback(
    (labelId: string) => {
      const name = editingLabelName.trim();
      if (!name) return;
      const current = labels.find((l) => l._id === labelId);
      if (current?.name === name) {
        // Nothing changed: close the editor without a round trip.
        setEditingLabelId(null);
        setEditingLabelName('');
        return;
      }
      if (isLabelNameTaken(labels, name, labelId)) {
        toast.error(t('ui.mutations.labelNameTaken', { name }));
        return;
      }
      updateLabel.mutate(
        { labelId, updates: { name } },
        {
          onSuccess: () => {
            setEditingLabelId(null);
            setEditingLabelName('');
          },
        },
      );
    },
    [editingLabelName, labels, updateLabel, t],
  );

  const handleDelete = useCallback(() => {
    if (!labelPendingDelete) return;
    deleteLabel.mutate(labelPendingDelete.id, {
      onSuccess: () => {
        toast.success(t('common.success'));
        setLabelPendingDelete(null);
      },
    });
  }, [labelPendingDelete, deleteLabel, t]);

  return (
    <>
      <SettingsProfilePage
        sections={[
          {
            key: 'labels',
            emptyState: {
              variant: 'compact',
              illustration: <EmptyStateSticker name="conversation" size={80} />,
              title: t('empty.labelsTitle'),
              description: t('empty.labelsDescription'),
            },
            label: t('ui.settings.labels.your'),
            rows: labels.map((label) => ({
              key: label._id,
              label: label.name,
              control: label.system ? (
                <SettingsValueField muted>{t('ui.settings.labels.builtIn')}</SettingsValueField>
              ) : (
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  {editingLabelId === label._id ? (
                    <>
                      <TextFieldInput
                        size="sm"
                        label={t('ui.settings.labels.labelName')}
                        value={editingLabelName}
                        onChangeText={setEditingLabelName}
                        onSubmitEditing={() => handleUpdateName(label._id)}
                      />
                      <Button
                        onPress={() => handleUpdateName(label._id)}
                        disabled={updateLabel.isPending}
                      >
                        {t('ui.settings.labels.saveName')}
                      </Button>
                    </>
                  ) : (
                    <IconButton
                      accessibilityLabel={t('ui.settings.labels.rename', {
                        name: label.name,
                      })}
                      icon={<RiEditLine />}
                      onPress={() => {
                        setEditingLabelId(label._id);
                        setEditingLabelName(label.name);
                      }}
                    />
                  )}
                  <IconButton
                    accessibilityLabel={t('ui.settings.labels.delete', {
                      name: label.name,
                    })}
                    icon={<RiDeleteBin6Line />}
                    onPress={() => {
                      setLabelPendingDelete({
                        id: label._id,
                        name: label.name,
                      });
                      deleteConfirm.open();
                    }}
                  />
                </View>
              ),
            })),
          },
          {
            key: 'create',
            label: t('ui.settings.labels.create'),
            rows: [
              {
                key: 'name',
                label: t('ui.settings.labels.labelName'),
                control: (
                  <TextFieldInput
                    size="sm"
                    label={t('ui.settings.labels.newName')}
                    value={newLabelName}
                    onChangeText={setNewLabelName}
                    onSubmitEditing={handleCreate}
                  />
                ),
              },
              {
                key: 'color',
                label: t('ui.settings.labels.color'),
                control: (
                  <SettingsPreferenceSelect
                    label={t('ui.settings.labels.colorLabel')}
                    value={newLabelColor}
                    onChange={setNewLabelColor}
                    items={LABEL_COLORS.map((value, index) => ({
                      value,
                      label: t(`ui.settings.labels.colors.${LABEL_COLOR_NAMES[index]}`),
                    }))}
                  />
                ),
              },
              {
                key: 'add',
                label: t('ui.settings.labels.add'),
                control: (
                  <Button
                    onPress={handleCreate}
                    disabled={!newLabelName.trim() || createLabel.isPending}
                    loading={createLabel.isPending}
                  >
                    {t('ui.settings.labels.add')}
                  </Button>
                ),
              },
            ],
          },
        ]}
      />
      <Dialog
        control={deleteConfirm}
        title={t('ui.settings.labels.deleteTitle')}
        description={
          labelPendingDelete
            ? t('ui.settings.labels.deleteDescription', {
                name: labelPendingDelete.name,
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
