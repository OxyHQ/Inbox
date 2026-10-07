import { Field } from '@oxy.so/bloom/field';
import { useTranslation } from '@/lib/i18n';
import type { Mailbox } from '@/services/emailApi';
import {
  dateRangeFilters,
  filtersDateRange,
  type SearchFilters,
} from '@/utils/searchFilters';
import { Button } from '@oxy.so/bloom/button';
import { Chip } from '@oxy.so/bloom/chip';
import { DateRangePicker } from '@oxy.so/bloom/date-picker';
import { Dialog } from '@oxy.so/bloom/dialog';
import {
  RiAttachmentLine,
  RiFilterLine,
  RiMailLine,
  RiStarLine,
} from '@oxy.so/bloom/icons';
import {
  Select,
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from '@oxy.so/bloom/select';
import { TextFieldInput } from '@oxy.so/bloom/text-field';
import { Text } from '@oxy.so/bloom/typography';
import { useState } from 'react';
import { View } from 'react-native';

function FilterSelect({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: string;
  items: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <View className="gap-2">
      <Text variant="body-2-medium">{label}</Text>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger label={label}>
          <SelectValue>
            {() => items.find((item) => item.value === value)?.label ?? value}
          </SelectValue>
          <SelectIcon />
        </SelectTrigger>
        <SelectContent
          label={label}
          items={items}
          renderItem={(item) => (
            <SelectItem value={item.value} label={item.label}>
              <SelectItemIndicator />
              <SelectItemText>{item.label}</SelectItemText>
            </SelectItem>
          )}
        />
      </Select>
    </View>
  );
}

/** Mail-specific filter data; Bloom owns dialogs, calendars, selection and chips. */
export function SearchFiltersBar({
  filters,
  mailboxes,
  onChange,
}: {
  filters: SearchFilters;
  mailboxes: Mailbox[];
  onChange: (filters: SearchFilters) => void;
}) {
  const { t, locale } = useTranslation();
  const [draft, setDraft] = useState<SearchFilters | null>(null);
  const open = () => setDraft({ ...filters });
  const updateDraft = (patch: Partial<SearchFilters>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const active = Object.entries(filters).filter(([key, value]) =>
    key === 'unread' ? typeof value === 'boolean' : Boolean(value),
  );
  const activeCount =
    active.length - (filters.dateAfter && filters.dateBefore ? 1 : 0);
  const dateLabel = (value: string) => {
    const date = new Date(
      /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value,
    );
    return Number.isFinite(date.getTime())
      ? date.toLocaleDateString(locale, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : value;
  };
  const details: { key: keyof SearchFilters; label: string }[] = [
    ...(filters.from
      ? [
          {
            key: 'from' as const,
            label: `${t('search.filters.from')}: ${filters.from}`,
          },
        ]
      : []),
    ...(filters.to
      ? [
          {
            key: 'to' as const,
            label: `${t('compose.fields.to')}: ${filters.to}`,
          },
        ]
      : []),
    ...(filters.subject
      ? [
          {
            key: 'subject' as const,
            label: `${t('compose.placeholders.subject')}: ${filters.subject}`,
          },
        ]
      : []),
    ...(filters.mailbox
      ? [
          {
            key: 'mailbox' as const,
            label:
              mailboxes.find((m) => m._id === filters.mailbox)?.name ??
              filters.mailbox,
          },
        ]
      : []),
    ...(filters.label
      ? [
          {
            key: 'label' as const,
            label: `${t('message.actions.label')}: ${filters.label}`,
          },
        ]
      : []),
    ...(filters.unread === false
      ? [{ key: 'unread' as const, label: t('search.ui.read') }]
      : []),
    ...(filters.dateAfter
      ? [
          {
            key: 'dateAfter' as const,
            label: `${dateLabel(filters.dateAfter)} →${filters.dateBefore ? ` ${dateLabel(filters.dateBefore)}` : ''}`,
          },
        ]
      : []),
    ...(filters.dateBefore && !filters.dateAfter
      ? [
          {
            key: 'dateBefore' as const,
            label: `→ ${dateLabel(filters.dateBefore)}`,
          },
        ]
      : []),
  ];
  return (
    <>
      <View className="gap-2 px-4 pb-3">
        <View className="flex-row flex-wrap items-center gap-2">
          <Button
            appearance={active.length ? 'subtle' : 'outline'}
            leading={<RiFilterLine />}
            onPress={open}
          >
            {t('search.ui.filtersTitle')}
            {activeCount ? ` (${activeCount})` : ''}
          </Button>
          <Chip
            appearance="outline"
            role="checkbox"
            checked={filters.hasAttachment === true}
            onCheckedChange={(checked) =>
              onChange({ ...filters, hasAttachment: checked || undefined })
            }
            leadingIcon={RiAttachmentLine}
          >
            {t('search.filters.hasAttachment')}
          </Chip>
          <Chip
            appearance="outline"
            role="checkbox"
            checked={filters.unread === true}
            onCheckedChange={(checked) =>
              onChange({ ...filters, unread: checked ? true : undefined })
            }
            leadingIcon={RiMailLine}
          >
            {t('search.ui.unread')}
          </Chip>
          <Chip
            appearance="outline"
            role="checkbox"
            checked={filters.starred === true}
            onCheckedChange={(checked) =>
              onChange({ ...filters, starred: checked || undefined })
            }
            leadingIcon={RiStarLine}
          >
            {t('drawer.starred')}
          </Chip>
        </View>
        {details.length > 0 && (
          <View className="flex-row flex-wrap gap-2">
            {details.map(({ key, label }) => (
              <Chip
                key={key}
                selected
                onPress={open}
                onClose={() =>
                  onChange({
                    ...filters,
                    [key]: undefined,
                    ...(key === 'dateAfter' && filters.dateBefore
                      ? { dateBefore: undefined }
                      : {}),
                  })
                }
                closeLabel={`${t('common.remove')} ${label}`}
                style={{ maxWidth: '100%' }}
              >
                {label}
              </Chip>
            ))}
          </View>
        )}
      </View>
      <Dialog
        open={draft !== null}
        onClose={() => setDraft(null)}
        placement={{ base: 'bottom', md: 'center' }}
        header={{
          title: t('search.ui.filtersTitle'),
          subtitle: t('search.ui.filtersDescription'),
          primaryAction: {
            label: t('common.search'),
            onPress: () => {
              if (draft) onChange(draft);
              setDraft(null);
            },
          },
        }}
        testID="search-filters-dialog"
      >
        {draft && (
          <View className="gap-4 px-5">
            <Field label={t('search.filters.from')}>
              <TextFieldInput
                label={t('search.filters.from')}
                value={draft.from ?? ''}
                onChangeText={(from) =>
                  updateDraft({ from: from.trim() ? from : undefined })
                }
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Field>
            <Field label={t('compose.fields.to')}>
              <TextFieldInput
                label={t('compose.fields.to')}
                value={draft.to ?? ''}
                onChangeText={(to) =>
                  updateDraft({ to: to.trim() ? to : undefined })
                }
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Field>
            <Field label={t('compose.placeholders.subject')}>
              <TextFieldInput
                label={t('compose.placeholders.subject')}
                value={draft.subject ?? ''}
                onChangeText={(subject) =>
                  updateDraft({ subject: subject.trim() ? subject : undefined })
                }
              />
            </Field>
            <FilterSelect
              label={t('search.ui.mailbox')}
              value={draft.mailbox ?? 'all'}
              onChange={(mailbox) =>
                updateDraft({
                  mailbox: mailbox === 'all' ? undefined : mailbox,
                })
              }
              items={[
                { value: 'all', label: t('search.ui.anyMailbox') },
                ...mailboxes.map((m) => ({ value: m._id, label: m.name })),
              ]}
            />
            <FilterSelect
              label={t('search.ui.readState')}
              value={
                draft.unread === undefined
                  ? 'all'
                  : draft.unread
                    ? 'unread'
                    : 'read'
              }
              onChange={(status) =>
                updateDraft({
                  unread: status === 'all' ? undefined : status === 'unread',
                })
              }
              items={[
                { value: 'all', label: t('search.ui.anyReadState') },
                { value: 'unread', label: t('search.ui.unread') },
                { value: 'read', label: t('search.ui.read') },
              ]}
            />
            <View className="gap-2">
              <Text variant="body-2-medium">{t('search.ui.dateRange')}</Text>
              <DateRangePicker
                value={filtersDateRange(draft)}
                onChange={(range) => updateDraft(dateRangeFilters(range))}
                locale={locale}
                placeholder={t('search.ui.dateRange')}
                accessibilityLabel={t('search.ui.dateRange')}
                testID="search-date-range"
              />
            </View>
            <Field label={t('message.actions.label')}>
              <TextFieldInput
                label={t('message.actions.label')}
                value={draft.label ?? ''}
                onChangeText={(label) =>
                  updateDraft({ label: label.trim() ? label : undefined })
                }
              />
            </Field>
            <View className="flex-row flex-wrap gap-2">
              <Chip
                appearance="outline"
                role="checkbox"
                checked={draft.hasAttachment === true}
                onCheckedChange={(checked) =>
                  updateDraft({ hasAttachment: checked || undefined })
                }
                leadingIcon={RiAttachmentLine}
              >
                {t('search.filters.hasAttachment')}
              </Chip>
              <Chip
                appearance="outline"
                role="checkbox"
                checked={draft.starred === true}
                onCheckedChange={(checked) =>
                  updateDraft({ starred: checked || undefined })
                }
                leadingIcon={RiStarLine}
              >
                {t('drawer.starred')}
              </Chip>
            </View>
            <Button appearance="plain" onPress={() => setDraft({})}>
              {t('search.ui.clearFilters')}
            </Button>
          </View>
        )}
      </Dialog>
    </>
  );
}
