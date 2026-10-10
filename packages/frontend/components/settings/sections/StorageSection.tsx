import { useQuota } from '@/hooks/queries/useQuota';
import { useTranslation } from '@/lib/i18n';
import { Loading } from '@oxy.so/bloom/loading';
import { SettingsGeneralPage, SettingsValueField } from '@oxy.so/bloom/settings-modal';
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * The quota's `percentage` is the API's raw ratio (`42.857142…`), and was shown
 * as-is. Formatted in the app's locale — `42.9%`, `42,9 %`, `٤٢٫٩٪` — with at
 * most one decimal.
 */
export function formatQuotaPercent(percentage: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(percentage / 100);
}

export function StorageSection() {
  const { t, locale } = useTranslation();
  const { data: quota, isLoading } = useQuota();
  return (
    <SettingsGeneralPage
      sections={[
        {
          key: 'quota',
          label: t('ui.settings.storage.usage'),
          description:
            quota && quota.percentage > 90 ? t('ui.settings.storage.nearlyFull') : undefined,
          rows: [
            {
              key: 'used',
              label: t('ui.settings.storage.usage'),
              description: quota
                ? t('ui.settings.storage.usedOf', {
                    used: formatBytes(quota.used),
                    limit: formatBytes(quota.limit),
                  })
                : undefined,
              control:
                isLoading && !quota ? (
                  <Loading variant="inline" size="sm" />
                ) : (
                  <SettingsValueField>
                    {quota ? formatQuotaPercent(quota.percentage, locale) : '—'}
                  </SettingsValueField>
                ),
            },
            ...(quota
              ? [
                  {
                    key: 'free',
                    label: t('ui.settings.storage.free', {
                      value: formatBytes(Math.max(0, quota.limit - quota.used)),
                    }),
                    control: (
                      <SettingsValueField>
                        {formatBytes(Math.max(0, quota.limit - quota.used))}
                      </SettingsValueField>
                    ),
                  },
                ]
              : []),
          ],
        },
        {
          key: 'local',
          label: t('ui.settings.storage.local'),
          description: t('ui.settings.storage.localDescription'),
          rows: [],
        },
      ]}
    />
  );
}
