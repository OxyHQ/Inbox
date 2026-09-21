import {
  SettingsGeneralPage,
  SettingsValueField,
} from '@oxy.so/bloom/settings-modal';
import { Loading } from '@oxy.so/bloom/loading';
import { useTranslation } from '@/lib/i18n';
import { useQuota } from '@/hooks/queries/useQuota';
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1,
  );
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function StorageSection() {
  const { t } = useTranslation();
  const { data: quota, isLoading } = useQuota();
  return (
    <SettingsGeneralPage
      sections={[
        {
          key: 'quota',
          label: t('ui.settings.storage.usage'),
          description:
            quota && quota.percentage > 90
              ? t('ui.settings.storage.nearlyFull')
              : undefined,
          rows: [
            {
              key: 'used',
              label: t('ui.settings.storage.usage'),
              description: quota
                ? `${formatBytes(quota.used)} of ${formatBytes(quota.limit)}`
                : undefined,
              control:
                isLoading && !quota ? (
                  <Loading variant="inline" size="small" />
                ) : (
                  <SettingsValueField>
                    {quota ? `${quota.percentage}%` : '—'}
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
