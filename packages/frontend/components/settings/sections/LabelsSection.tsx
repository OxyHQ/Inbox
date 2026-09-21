import { useCallback, useState } from 'react';
import { View } from 'react-native';
import {
  SettingsProfilePage,
  SettingsValueField,
} from '@oxy.so/bloom/settings-modal';
import { Button, IconButton } from '@oxy.so/bloom/button';
import { TextFieldInput } from '@oxy.so/bloom/text-field';
import { Dialog, useDialogControl } from '@oxy.so/bloom/dialog';
import { toast } from '@oxy.so/bloom/toast';
import { RiEditLine, RiDeleteBin6Line } from '@oxy.so/bloom/icons';
import { useTranslation } from '@/lib/i18n';
import { SettingsPreferenceSelect } from '../SettingsPreferenceSelect';
import {
  useLabels,
  useCreateLabel,
  useUpdateLabel,
  useDeleteLabel,
} from '@/hooks/queries/useLabels';
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

  const handleCreate = useCallback(() => {
    const name = newLabelName.trim();
    if (!name) return;
    createLabel.mutate(
      { name, color: newLabelColor },
      {
        onSuccess: () => {
          setNewLabelName('');
          setNewLabelColor(DEFAULT_NEW_COLOR);
          toast.success(t('common.success'));
        },
        onError: (err: unknown) => {
          const message =
            err instanceof Error
              ? err.message
              : t('ui.mutations.labelCreateFailed');
          toast.error(message);
        },
      },
    );
  }, [newLabelName, newLabelColor, createLabel, t]);

  const handleUpdateName = useCallback(
    (labelId: string) => {
      const name = editingLabelName.trim();
      if (!name) return;
      updateLabel.mutate(
        { labelId, updates: { name } },
        {
          onSuccess: () => {
            setEditingLabelId(null);
            setEditingLabelName('');
          },
          onError: (err: unknown) => {
            const message =
              err instanceof Error
                ? err.message
                : t('ui.mutations.labelUpdateFailed');
            toast.error(message);
          },
        },
      );
    },
    [editingLabelName, updateLabel, t],
  );

  const handleDelete = useCallback(() => {
    if (!labelPendingDelete) return;
    deleteLabel.mutate(labelPendingDelete.id, {
      onSuccess: () => {
        toast.success(t('common.success'));
        setLabelPendingDelete(null);
      },
      onError: (err: unknown) => {
        const message =
          err instanceof Error
            ? err.message
            : t('ui.mutations.labelDeleteFailed');
        toast.error(message);
      },
    });
  }, [labelPendingDelete, deleteLabel, t]);

  return (
    <>
      <SettingsProfilePage
        sections={[
          {
            key: 'labels',
            label: t('ui.settings.labels.your'),
            description: labels.length
              ? undefined
              : t('ui.settings.labels.empty'),
            rows: labels.map((label) => ({
              key: label._id,
              label: label.name,
              control: label.system ? (
                <SettingsValueField muted>
                  {t('ui.settings.labels.builtIn')}
                </SettingsValueField>
              ) : (
                <View
                  style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}
                >
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
                        size="sm"
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
                label: 'Color',
                control: (
                  <SettingsPreferenceSelect
                    label="Label color"
                    value={newLabelColor}
                    onChange={setNewLabelColor}
                    items={LABEL_COLORS.map((value, index) => ({
                      value,
                      label: [
                        'Blue',
                        'Red',
                        'Yellow',
                        'Green',
                        'Orange',
                        'Cyan',
                        'Purple',
                        'Pink',
                        'Brown',
                        'Gray',
                      ][index],
                    }))}
                  />
                ),
              },
              {
                key: 'add',
                label: t('ui.settings.labels.add'),
                control: (
                  <Button
                    size="sm"
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
