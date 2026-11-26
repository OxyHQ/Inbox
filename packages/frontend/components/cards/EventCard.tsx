import { Button } from '@oxy.so/bloom/button';
import { RiCalendarLine } from '@oxy.so/bloom/icons/RiCalendarLine';
import { useColors } from '@/constants/theme';
import { useTranslation } from '@/lib/i18n';
import type { CardData } from '@/services/emailApi';
import {
  calendarTimes,
  generateIcs,
  googleCalendarUrl,
  type CalendarLabels,
} from '@/utils/calendarEvent';
import { formatCardDate, isDateOnly } from '@/utils/cardFormat';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { toast } from '@oxy.so/bloom/toast';
import { Card, CardBody, CardHeader, CardTitle } from '@oxy.so/bloom/card';
import { Text } from '@oxy.so/bloom/typography';
import { useCallback, useMemo } from 'react';
import { Linking, Platform, StyleSheet } from 'react-native';

import {
  Button as LButton,
  Embed,
  HStack,
  Text as LText,
  VStack,
  toElement,
} from '@oxy.so/bloom-language';

interface EventCardProps {
  data: CardData;
}

export function EventCard({ data }: EventCardProps) {
  const colors = useColors();
  const { t, locale } = useTranslation();

  const times = useMemo(() => calendarTimes(data), [data]);
  const allDay = isDateOnly(data.startTime);
  const startTime = formatCardDate(
    locale,
    data.startTime,
    allDay
      ? { weekday: 'short', month: 'short', day: 'numeric' }
      : {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        },
    true,
  );
  const endTime =
    startTime && !allDay
      ? formatCardDate(locale, data.endTime, { hour: 'numeric', minute: '2-digit' }, true)
      : null;

  const labels = useMemo<CalendarLabels>(
    () => ({
      organizer: (name) => t('cards.event.organizer', { name }),
      untitled: t('cards.event.defaultTitle'),
    }),
    [t],
  );

  const handleAddToCalendar = useCallback(async () => {
    if (!times) return;
    const icsContent = generateIcs(data, times, new Date(), labels);

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
        await file.write(icsContent);

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
        const message = err instanceof Error ? err.message : t('ui.event.openFailed');
        toast.error(message);
      }
    }
  }, [data, labels, t, times]);

  const handleOpenGoogleCalendar = useCallback(() => {
    if (!times) return;
    void Linking.openURL(googleCalendarUrl(data, times, labels));
  }, [data, labels, times]);

  return (
    <Card appearance="subtle">
      <CardHeader>
        <CardTitle>{t('cards.event.header')}</CardTitle>
      </CardHeader>
      <CardBody>
        {toElement(
          VStack(
            Embed(
              data.title && (
                <Text style={[styles.title, { color: colors.text }]}>{data.title}</Text>
              ),
            ),
            Embed(
              startTime &&
                toElement(
                  HStack(
                    Embed(
                      <MaterialCommunityIcons
                        name="clock-outline"
                        size={14}
                        color={colors.secondaryText}
                      />,
                    ),
                    Embed(
                      <Text style={[styles.time, { color: colors.secondaryText }]}>
                        {startTime}
                        {endTime ? ` – ${endTime}` : ''}
                      </Text>,
                    ),
                  )
                    .align('center')
                    .spacing('6'),
                ),
            ),
            Embed(
              data.location &&
                toElement(
                  HStack(
                    Embed(
                      <MaterialCommunityIcons
                        name="map-marker-outline"
                        size={14}
                        color={colors.secondaryText}
                      />,
                    ),
                    Embed(
                      <Text style={[styles.location, { color: colors.secondaryText }]}>
                        {data.location}
                      </Text>,
                    ),
                  )
                    .align('center')
                    .spacing('6'),
                ),
            ),
            Embed(
              data.organizer &&
                toElement(
                  HStack(
                    Embed(
                      <MaterialCommunityIcons
                        name="account-outline"
                        size={14}
                        color={colors.secondaryText}
                      />,
                    ),
                    Embed(
                      <Text style={[styles.organizer, { color: colors.secondaryText }]}>
                        {data.organizer}
                      </Text>,
                    ),
                  )
                    .align('center')
                    .spacing('6'),
                ),
            ),
            Embed(
              startTime && !times && (
                <Text accessibilityLiveRegion="polite">{t('cards.event.exportUnavailable')}</Text>
              ),
            ),
            /* Calendar actions require a representable interval. */ Embed(
              times &&
                toElement(
                  HStack(
                    Embed(
                      <Button
                        appearance="subtle"
                        leading={<RiCalendarLine />}
                        onPress={handleAddToCalendar}
                      >
                        {t('cards.event.addToCalendar')}
                      </Button>,
                    ),
                    LButton(LText(t('cards.event.googleCalendar')))
                      .style('subtle')
                      .onPress(handleOpenGoogleCalendar),
                  )
                    .spacing('sm')
                    .margin('top', 'xs')
                    .wrap(),
                ),
            ),
          ).spacing('sm'),
        )}
      </CardBody>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 15, fontWeight: '600' },
  time: { fontSize: 13 },
  location: { fontSize: 13, flex: 1 },
  organizer: { fontSize: 13 },
});
