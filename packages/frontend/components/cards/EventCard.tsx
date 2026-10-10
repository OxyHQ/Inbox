import { Button } from '@oxy.so/bloom/button';
import { RiCalendarLine } from '@oxy.so/bloom/icons';
import { useColors } from '@/constants/theme';
import { useTranslation } from '@/lib/i18n';
import type { CardData } from '@/services/emailApi';
import { calendarTimes, generateIcs, googleCalendarUrl } from '@/utils/calendarEvent';
import { formatCardDate } from '@/utils/cardFormat';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { toast } from '@oxy.so/bloom';
import { Card, CardBody, CardHeader, CardTitle } from '@oxy.so/bloom/card';
import { Text } from '@oxy.so/bloom/typography';
import { useCallback, useMemo } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

interface EventCardProps {
  data: CardData;
}

export function EventCard({ data }: EventCardProps) {
  const colors = useColors();
  const { t } = useTranslation();

  const times = useMemo(() => calendarTimes(data), [data]);
  const startTime = times
    ? formatCardDate(
        data.startTime,
        times.allDay
          ? { weekday: 'short', month: 'short', day: 'numeric' }
          : { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
        true,
      )
    : null;
  const endTime =
    times && !times.allDay
      ? formatCardDate(data.endTime, { hour: 'numeric', minute: '2-digit' }, true)
      : null;

  const handleAddToCalendar = useCallback(async () => {
    if (!times) return;
    const icsContent = generateIcs(data, times);

    if (Platform.OS === 'web') {
      // Web: create a Blob and trigger download
      const blob = new Blob([icsContent], {
        type: 'text/calendar;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(data.title || 'event').replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      // Native: use expo-file-system and expo-sharing
      try {
        const { File, Paths } = await import('expo-file-system');
        const Sharing = await import('expo-sharing');

        const filename = `${(data.title || 'event').replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
        const file = new File(Paths.cache, filename);
        file.write(icsContent);

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, {
            mimeType: 'text/calendar',
            dialogTitle: t('cards.event.addToCalendarDialog'),
          });
        } else {
          // Sharing not available on this device — fall back to the Google
          // Calendar web URL so the action never silently does nothing.
          toast.error(t('ui.event.sharingUnavailable'));
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : t('ui.event.openFailed');
        toast.error(message);
      }
    }
  }, [data, t, times]);

  const handleOpenGoogleCalendar = useCallback(() => {
    if (!times) return;
    void Linking.openURL(googleCalendarUrl(data, times));
  }, [data, times]);

  return (
    <Card appearance="subtle">
      <CardHeader>
        <CardTitle>{t('cards.event.header')}</CardTitle>
      </CardHeader>
      <CardBody>
        <View style={styles.body}>
          {data.title && (
            <Text style={[styles.title, { color: colors.text }]}>
              {data.title}
            </Text>
          )}
          {startTime && (
            <View style={styles.row}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={14}
                color={colors.secondaryText}
              />
              <Text style={[styles.time, { color: colors.secondaryText }]}>
                {startTime}
                {endTime ? ` – ${endTime}` : ''}
              </Text>
            </View>
          )}
          {data.location && (
            <View style={styles.row}>
              <MaterialCommunityIcons
                name="map-marker-outline"
                size={14}
                color={colors.secondaryText}
              />
              <Text style={[styles.location, { color: colors.secondaryText }]}>
                {data.location}
              </Text>
            </View>
          )}
          {data.organizer && (
            <View style={styles.row}>
              <MaterialCommunityIcons
                name="account-outline"
                size={14}
                color={colors.secondaryText}
              />
              <Text style={[styles.organizer, { color: colors.secondaryText }]}>
                {data.organizer}
              </Text>
            </View>
          )}

          {/* Calendar action buttons — only for an event whose start is known. */}
          {times && (
            <View style={styles.actions}>
              <Button
                appearance="subtle"
                leading={<RiCalendarLine />}
                onPress={handleAddToCalendar}
              >
                {t('cards.event.addToCalendar')}
              </Button>
              <Button appearance="subtle" onPress={handleOpenGoogleCalendar}>
                {t('cards.event.googleCalendar')}
              </Button>
            </View>
          )}
        </View>
      </CardBody>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { gap: 8 },
  title: { fontSize: 15, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  time: { fontSize: 13 },
  location: { fontSize: 13, flex: 1 },
  organizer: { fontSize: 13 },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
});
