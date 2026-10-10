import { TextFieldInput } from '@oxy.so/bloom/text-field';
import { parseByteSize } from '@/utils/byteSize';
import { EmptyStateSticker } from '@/components/EmptyStateSticker';
import { OutboundQueueSection } from '@/components/settings/OutboundQueueSection';
import {
  useReorderBundle,
  useUpdateBundle,
} from '@/hooks/mutations/useBundleMutations';
import {
  useCreateFilter,
  useDeleteFilter,
  useUpdateFilter,
} from '@/hooks/mutations/useFilterMutations';
import {
  useCreateTemplate,
  useDeleteTemplate,
  useUpdateTemplate,
} from '@/hooks/mutations/useTemplateMutations';
import { useBundles } from '@/hooks/queries/useBundles';
import { useFilters } from '@/hooks/queries/useFilters';
import { useTemplates } from '@/hooks/queries/useTemplates';
import { useEmailStore } from '@/hooks/useEmail';
import { useTranslation } from '@/lib/i18n';
import type {
  EmailFilterAction,
  EmailFilterCondition,
} from '@/services/emailApi';
import { Button, IconButton } from '@oxy.so/bloom/button';
import { Dialog, useDialogControl } from '@oxy.so/bloom/dialog';
import {
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiDeleteBin6Line,
  RiEditLine,
} from '@oxy.so/bloom/icons';
import {
  SettingsProfilePage,
} from '@oxy.so/bloom/settings-modal';
import { Switch } from '@oxy.so/bloom/switch';
import { Textarea } from '@oxy.so/bloom/textarea';
import { toast } from '@oxy.so/bloom/toast';
import {
  EMAIL_FILTER_CONDITION_FIELDS,
  EMAIL_FILTER_CONDITION_OPERATORS,
} from '@oxy.so/contracts';
import { useCallback, useMemo, useState } from 'react';
import { Platform, View } from 'react-native';
import { SettingsPreferenceSelect } from '../SettingsPreferenceSelect';

type FilterField = EmailFilterCondition['field'];
type FilterOperator = EmailFilterCondition['operator'];
/** The rule actions this form offers; the rest are set by other surfaces. */
type FilterActionType = Extract<
  EmailFilterAction['type'],
  'archive' | 'mark-read' | 'star' | 'delete'
>;

// Keyed by the contract's vocabularies, so a field or operator the API adds
// fails typecheck here until it has a label, instead of silently not showing.
const FIELD_LABEL_KEYS: Record<FilterField, string> = {
  from: 'search.filters.from',
  to: 'compose.fields.to',
  subject: 'compose.placeholders.subject',
  'has-attachment': 'search.filters.hasAttachment',
  size: 'ui.settings.advanced.sizeBytes',
};

const OPERATOR_LABEL_KEYS: Record<FilterOperator, string> = {
  contains: 'ui.settings.advanced.contains',
  equals: 'ui.settings.advanced.equals',
  'not-contains': 'ui.settings.advanced.notContains',
  'starts-with': 'ui.settings.advanced.startsWith',
  'ends-with': 'ui.settings.advanced.endsWith',
  'greater-than': 'ui.settings.advanced.largerThan',
  'less-than': 'ui.settings.advanced.smallerThan',
};

const SIZE_OPERATOR_SET = new Set<FilterOperator>([
  'greater-than',
  'less-than',
]);

const FIELD_OPTIONS: { value: FilterField; labelKey: string }[] =
  EMAIL_FILTER_CONDITION_FIELDS.map((value) => ({
    value,
    labelKey: FIELD_LABEL_KEYS[value],
  }));

const TEXT_OPERATORS: { value: FilterOperator; labelKey: string }[] =
  EMAIL_FILTER_CONDITION_OPERATORS.filter(
    (value) => !SIZE_OPERATOR_SET.has(value),
  ).map((value) => ({ value, labelKey: OPERATOR_LABEL_KEYS[value] }));

const SIZE_OPERATORS: { value: FilterOperator; labelKey: string }[] =
  EMAIL_FILTER_CONDITION_OPERATORS.filter((value) =>
    SIZE_OPERATOR_SET.has(value),
  ).map((value) => ({ value, labelKey: OPERATOR_LABEL_KEYS[value] }));

const ACTION_OPTIONS: { value: FilterActionType; labelKey: string }[] = [
  { value: 'archive', labelKey: 'message.actions.archive' },
  { value: 'mark-read', labelKey: 'message.actions.markRead' },
  { value: 'star', labelKey: 'message.actions.star' },
  { value: 'delete', labelKey: 'message.actions.delete' },
];

function operatorsForField(field: FilterField) {
  if (field === 'size') return SIZE_OPERATORS;
  if (field === 'has-attachment') return [];
  return TEXT_OPERATORS;
}

export function AdvancedSection() {
  const { t } = useTranslation();

  const { data: filters = [] } = useFilters();
  const createFilter = useCreateFilter();
  const updateFilter = useUpdateFilter();
  const deleteFilter = useDeleteFilter();

  const { data: templates = [] } = useTemplates();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();

  const { data: bundles = [] } = useBundles();
  const updateBundle = useUpdateBundle();
  const reorderBundle = useReorderBundle();

  const sortedBundles = useMemo(
    () => [...bundles].sort((a, b) => a.order - b.order),
    [bundles],
  );

  const api = useEmailStore((s) => s._api);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    total: number;
  } | null>(null);

  // ─── Filter create form state ──────────────────────────────────────
  const [filterName, setFilterName] = useState('');
  const [filterField, setFilterField] = useState<FilterField>('from');
  const [filterOperator, setFilterOperator] =
    useState<FilterOperator>('contains');
  const [filterValue, setFilterValue] = useState('');
  const [filterAction, setFilterAction] = useState<FilterActionType>('archive');

  // ─── Template create / edit state ──────────────────────────────────
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null,
  );
  const [templateName, setTemplateName] = useState('');
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateBody, setTemplateBody] = useState('');

  const filterDelete = useDialogControl();
  const templateDelete = useDialogControl();
  const [filterPendingDelete, setFilterPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [templatePendingDelete, setTemplatePendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const handleFieldChange = useCallback((field: FilterField) => {
    setFilterField(field);
    const ops = operatorsForField(field);
    setFilterOperator(ops[0]?.value ?? 'contains');
  }, []);

  const filterValid = useMemo(() => {
    if (!filterName.trim()) return false;
    if (filterField === 'has-attachment') return true;
    if (filterField === 'size') return parseByteSize(filterValue) !== null;
    return filterValue.trim().length > 0;
  }, [filterName, filterField, filterValue]);

  const handleCreateFilter = useCallback(() => {
    if (!filterValid) return;
    const condition: EmailFilterCondition =
      filterField === 'has-attachment'
        ? { field: 'has-attachment', operator: 'equals', value: 'true' }
        : {
            field: filterField,
            operator: filterOperator,
            // The API compares bytes; "5 MB" is sent as 5242880.
            value:
              filterField === 'size'
                ? String(parseByteSize(filterValue))
                : filterValue.trim(),
          };
    const action: EmailFilterAction = { type: filterAction };
    createFilter.mutate(
      {
        name: filterName.trim(),
        conditions: [condition],
        actions: [action],
        matchAll: true,
        enabled: true,
      },
      {
        onSuccess: () => {
          setFilterName('');
          setFilterValue('');
          setFilterField('from');
          setFilterOperator('contains');
          setFilterAction('archive');
          toast.success(t('ui.settings.advanced.filterCreated'));
        },
        // A failure is reported by the mutation itself; a second toast here
        // said the same thing twice.
      },
    );
  }, [
    filterValid,
    filterField,
    filterOperator,
    filterValue,
    filterAction,
    filterName,
    createFilter,
    t,
  ]);

  const handleToggleFilter = useCallback(
    (filterId: string, enabled: boolean) => {
      updateFilter.mutate({ filterId, enabled });
    },
    [updateFilter],
  );

  const handleDeleteFilter = useCallback(() => {
    if (!filterPendingDelete) return;
    deleteFilter.mutate(filterPendingDelete.id, {
      onSuccess: () => {
        toast.success(t('ui.settings.advanced.filterDeleted'));
        setFilterPendingDelete(null);
      },
    });
  }, [filterPendingDelete, deleteFilter, t]);

  const resetTemplateForm = useCallback(() => {
    setEditingTemplateId(null);
    setTemplateName('');
    setTemplateSubject('');
    setTemplateBody('');
  }, []);

  const handleEditTemplate = useCallback(
    (id: string, name: string, subject: string, body: string) => {
      setEditingTemplateId(id);
      setTemplateName(name);
      setTemplateSubject(subject);
      setTemplateBody(body);
    },
    [],
  );

  const handleSubmitTemplate = useCallback(() => {
    const name = templateName.trim();
    const body = templateBody;
    const subject = templateSubject.trim();
    if (!name || !body.trim()) return;

    if (editingTemplateId) {
      updateTemplate.mutate(
        { templateId: editingTemplateId, name, subject, body },
        {
          onSuccess: () => {
            resetTemplateForm();
            toast.success(t('ui.settings.advanced.templateUpdated'));
          },
        },
      );
      return;
    }

    createTemplate.mutate(
      { name, subject: subject || undefined, body },
      {
        onSuccess: () => {
          resetTemplateForm();
          toast.success(t('ui.settings.advanced.templateCreated'));
        },
      },
    );
  }, [
    templateName,
    templateBody,
    templateSubject,
    editingTemplateId,
    updateTemplate,
    createTemplate,
    resetTemplateForm,
    t,
  ]);

  const handleDeleteTemplate = useCallback(() => {
    if (!templatePendingDelete) return;
    deleteTemplate.mutate(templatePendingDelete.id, {
      onSuccess: () => {
        toast.success(t('ui.settings.advanced.templateDeleted'));
        if (editingTemplateId === templatePendingDelete.id) resetTemplateForm();
        setTemplatePendingDelete(null);
      },
    });
  }, [
    templatePendingDelete,
    deleteTemplate,
    editingTemplateId,
    resetTemplateForm,
    t,
  ]);

  const handleImportFiles = useCallback(async () => {
    if (!api || Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.eml';
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      if (files.length === 0) return;
      setImporting(true);
      setImportResult(null);
      try {
        const result = await api.importMessages(files);
        setImportResult(result);
        toast.success(
          t('ui.settings.advanced.imported', { imported: result.imported, total: result.total }),
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t('ui.settings.advanced.importFailed');
        toast.error(message);
      } finally {
        setImporting(false);
      }
    };
    input.click();
  }, [api, t]);

  const templateSubmitting = editingTemplateId
    ? updateTemplate.isPending
    : createTemplate.isPending;
  const showValueInput = filterField !== 'has-attachment';
  const fieldOptions = useMemo(
    () =>
      FIELD_OPTIONS.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
      })),
    [t],
  );
  const operatorOptions = useMemo(
    () =>
      operatorsForField(filterField).map((option) => ({
        value: option.value,
        label: t(option.labelKey),
      })),
    [filterField, t],
  );
  const actionOptions = useMemo(
    () =>
      ACTION_OPTIONS.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
      })),
    [t],
  );

  return (
    <>
      <SettingsProfilePage
        sections={[
          {
            key: 'filters',
            emptyState: {
              variant: 'compact',
              illustration: <EmptyStateSticker name="conversation" size={80} />,
              title: t('empty.filtersTitle'),
              description: t('empty.filtersDescription'),
            },
            label: t('ui.settings.advanced.filters'),
            rows: filters.map((filter) => ({
              key: filter._id,
              label: filter.name,
              description: t('ui.settings.advanced.conditions', {
                conditions: filter.conditions.length,
                actions: filter.actions.length,
              }),
              control: (
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                >
                  <Switch
                    accessibilityLabel={filter.name}
                    checked={filter.enabled}
                    onCheckedChange={(v) => handleToggleFilter(filter._id, v)}
                  />
                  <IconButton
                    accessibilityLabel={t('ui.settings.advanced.deleteFilter', { name: filter.name })}
                    icon={<RiDeleteBin6Line />}
                    onPress={() => {
                      setFilterPendingDelete({
                        id: filter._id,
                        name: filter.name,
                      });
                      filterDelete.open();
                    }}
                  />
                </View>
              ),
            })),
          },
          {
            key: 'new-filter',
            label: t('ui.settings.advanced.addFilter'),
            rows: [
              {
                key: 'name',
                label: t('ui.settings.advanced.filterName'),
                control: (
                  <TextFieldInput
                    label={t('ui.settings.advanced.filterName')}
                    value={filterName}
                    onChangeText={setFilterName}
                  />
                ),
              },
              {
                key: 'field',
                label: t('ui.settings.advanced.whenMessage'),
                control: (
                  <SettingsPreferenceSelect
                    label={t('ui.settings.advanced.whenMessage')}
                    value={filterField}
                    onChange={handleFieldChange}
                    items={fieldOptions}
                  />
                ),
              },
              ...(showValueInput
                ? [
                    {
                      key: 'operator',
                      label: t('ui.settings.advanced.condition'),
                      control: (
                        <SettingsPreferenceSelect
                          label={t('ui.settings.advanced.condition')}
                          value={filterOperator}
                          onChange={setFilterOperator}
                          items={operatorOptions}
                        />
                      ),
                    },
                    {
                      key: 'value',
                      label: t('ui.settings.advanced.value'),
                      control: (
                        <TextFieldInput
                          label={t('ui.settings.advanced.value')}
                          value={filterValue}
                          onChangeText={setFilterValue}
                          placeholder={
                            filterField === 'size'
                              ? t('ui.settings.advanced.sizePlaceholder')
                              : undefined
                          }
                        />
                      ),
                    },
                  ]
                : []),
              {
                key: 'action',
                label: t('ui.settings.advanced.then'),
                control: (
                  <SettingsPreferenceSelect
                    label={t('ui.settings.advanced.then')}
                    value={filterAction}
                    onChange={setFilterAction}
                    items={actionOptions}
                  />
                ),
              },
              {
                key: 'create',
                label: t('ui.settings.advanced.addFilter'),
                control: (
                  <Button
                    onPress={handleCreateFilter}
                    disabled={!filterValid || createFilter.isPending}
                    loading={createFilter.isPending}
                  >
                    {t('ui.settings.advanced.addFilter')}
                  </Button>
                ),
              },
            ],
          },
          {
            key: 'templates',
            emptyState: {
              variant: 'compact',
              illustration: <EmptyStateSticker name="conversation" size={80} />,
              title: t('empty.templatesTitle'),
              description: t('empty.templatesDescription'),
            },
            label: t('ui.settings.advanced.templates'),
            rows: templates.map((template) => ({
              key: template._id,
              label: template.name,
              description: `${template.subject ? `${template.subject} — ` : ''}${template.body.replace(/\n/g, ' ').slice(0, 60)}`,
              control: (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <IconButton
                    accessibilityLabel={t('ui.settings.advanced.editTemplate', { name: template.name })}
                    icon={<RiEditLine />}
                    onPress={() =>
                      handleEditTemplate(
                        template._id,
                        template.name,
                        template.subject,
                        template.body,
                      )
                    }
                  />
                  <IconButton
                    accessibilityLabel={t('ui.settings.advanced.deleteTemplate', { name: template.name })}
                    icon={<RiDeleteBin6Line />}
                    onPress={() => {
                      setTemplatePendingDelete({
                        id: template._id,
                        name: template.name,
                      });
                      templateDelete.open();
                    }}
                  />
                </View>
              ),
            })),
          },
          {
            key: 'template-form',
            label: t(
              editingTemplateId
                ? 'ui.settings.advanced.editingTemplate'
                : 'ui.settings.advanced.addTemplate',
            ),
            rows: [
              {
                key: 'name',
                label: t('ui.settings.advanced.templateName'),
                control: (
                  <TextFieldInput
                    label={t('ui.settings.advanced.templateName')}
                    value={templateName}
                    onChangeText={setTemplateName}
                  />
                ),
              },
              {
                key: 'subject',
                label: t('ui.settings.advanced.subjectOptional'),
                control: (
                  <TextFieldInput
                    label={t('ui.settings.advanced.subjectOptional')}
                    value={templateSubject}
                    onChangeText={setTemplateSubject}
                  />
                ),
              },
              {
                key: 'body',
                label: t('ui.settings.advanced.templateBody'),
                control: (
                  <Textarea
                    accessibilityLabel={t('ui.settings.advanced.templateBody')}
                    value={templateBody}
                    onChangeText={setTemplateBody}
                    rows={4}
                    style={{ width: 202, maxWidth: '100%', flexGrow: 1 }}
                  />
                ),
              },
              {
                key: 'save',
                label: t(
                  editingTemplateId
                    ? 'ui.settings.advanced.saveChanges'
                    : 'ui.settings.advanced.addTemplate',
                ),
                control: (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Button
                      onPress={handleSubmitTemplate}
                      disabled={
                        !templateName.trim() ||
                        !templateBody.trim() ||
                        templateSubmitting
                      }
                      loading={templateSubmitting}
                    >
                      {t(
                        editingTemplateId
                          ? 'ui.settings.advanced.saveChanges'
                          : 'ui.settings.advanced.addTemplate',
                      )}
                    </Button>
                    {editingTemplateId ? (
                      <Button appearance="subtle" onPress={resetTemplateForm}>
                        {t('common.cancel')}
                      </Button>
                    ) : null}
                  </View>
                ),
              },
            ],
          },
          ...(sortedBundles.length
            ? [
                {
                  key: 'bundles',
                  label: t('ui.settings.advanced.bundles'),
                  description: t('ui.settings.advanced.bundleHint'),
                  rows: sortedBundles.map((bundle, index) => ({
                    key: bundle._id,
                    label: bundle.name,
                    control: (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <IconButton
                          accessibilityLabel={t('ui.settings.advanced.moveUp', {
                            name: bundle.name,
                          })}
                          icon={<RiArrowUpSLine />}
                          disabled={index === 0}
                          onPress={() =>
                            reorderBundle.mutate({
                              bundleId: bundle._id,
                              direction: 'up',
                            })
                          }
                        />
                        <IconButton
                          accessibilityLabel={t(
                            'ui.settings.advanced.moveDown',
                            {
                              name: bundle.name,
                            },
                          )}
                          icon={<RiArrowDownSLine />}
                          disabled={index === sortedBundles.length - 1}
                          onPress={() =>
                            reorderBundle.mutate({
                              bundleId: bundle._id,
                              direction: 'down',
                            })
                          }
                        />
                        <Switch
                          accessibilityLabel={bundle.name}
                          checked={bundle.enabled}
                          onCheckedChange={(v) =>
                            updateBundle.mutate({
                              bundleId: bundle._id,
                              enabled: v,
                            })
                          }
                        />
                      </View>
                    ),
                  })),
                },
              ]
            : []),
          ...(Platform.OS === 'web'
            ? [
                {
                  key: 'import',
                  label: t('ui.settings.advanced.import'),
                  description: importResult
                    ? t('ui.settings.advanced.imported', {
                        imported: importResult.imported,
                        count: importResult.total,
                      })
                    : t('ui.settings.advanced.importDescription'),
                  rows: [
                    {
                      key: 'import',
                      label: t('ui.settings.advanced.importButton'),
                      control: (
                        <Button
                          onPress={handleImportFiles}
                          disabled={importing}
                          loading={importing}
                        >
                          {t('ui.settings.advanced.importButton')}
                        </Button>
                      ),
                    },
                  ],
                },
              ]
            : []),
        ]}
      />
      <OutboundQueueSection />
      <Dialog
        control={filterDelete}
        title={t('ui.settings.advanced.deleteFilterTitle')}
        description={
          filterPendingDelete
            ? t('ui.settings.advanced.deleteFilterDescription', { name: filterPendingDelete.name })
            : ''
        }
        actions={[
          {
            label: t('common.delete'),
            color: 'destructive',
            onPress: handleDeleteFilter,
          },
          { label: t('common.cancel'), color: 'cancel' },
        ]}
      />

      <Dialog
        control={templateDelete}
        title={t('ui.settings.advanced.deleteTemplateTitle')}
        description={
          templatePendingDelete
            ? t('ui.settings.advanced.deleteTemplateDescription', { name: templatePendingDelete.name })
            : ''
        }
        actions={[
          {
            label: t('common.delete'),
            color: 'destructive',
            onPress: handleDeleteTemplate,
          },
          { label: t('common.cancel'), color: 'cancel' },
        ]}
      />
    </>
  );
}
