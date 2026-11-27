import { formatCardDate } from '@/utils/cardFormat';
import { useColors } from '@/constants/theme';
import type { CardData } from '@/services/emailApi';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Card, CardBody, CardHeader, CardTitle } from '@oxy.so/bloom/card';
import { Text } from '@oxy.so/bloom/typography';
import { StyleSheet } from 'react-native';
import { useTranslation } from '@/lib/i18n';

import { Embed, HStack, VStack, toElement } from '@oxy.so/bloom-language';

interface TripCardProps {
  data: CardData;
}

export function TripCard({ data }: TripCardProps) {
  const { t, locale } = useTranslation();
  const colors = useColors();

  const departureTime = data.departureTime
    ? formatCardDate(
        locale,
        data.departureTime,
        {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        },
        true,
      )
    : null;

  const arrivalTime = data.arrivalTime
    ? formatCardDate(
        locale,
        data.arrivalTime,
        {
          hour: 'numeric',
          minute: '2-digit',
        },
        true,
      )
    : null;

  return (
    <Card appearance="subtle">
      <CardHeader>
        <CardTitle>{t('cards.trip.header')}</CardTitle>
      </CardHeader>
      <CardBody>
        {toElement(
          VStack(
            Embed(
              data.airline && (
                <Text style={[styles.airline, { color: colors.text }]}>
                  {data.airline} {data.flightNumber ? `· ${data.flightNumber}` : ''}
                </Text>
              ),
            ),
            Embed(
              (data.departure || data.arrival) &&
                toElement(
                  HStack(
                    Embed(
                      <Text style={[styles.city, { color: colors.text }]}>
                        {data.departure || '—'}
                      </Text>,
                    ),
                    Embed(
                      <MaterialCommunityIcons
                        name="arrow-right"
                        size={16}
                        color={colors.secondaryText}
                      />,
                    ),
                    Embed(
                      <Text style={[styles.city, { color: colors.text }]}>
                        {data.arrival || '—'}
                      </Text>,
                    ),
                  )
                    .align('center')
                    .spacing('sm'),
                ),
            ),
            Embed(
              departureTime && (
                <Text style={[styles.time, { color: colors.secondaryText }]}>
                  {departureTime}
                  {arrivalTime ? ` → ${arrivalTime}` : ''}
                </Text>
              ),
            ),
            Embed(
              data.confirmationCode &&
                toElement(
                  HStack(
                    Embed(
                      <Text style={[styles.codeLabel, { color: colors.secondaryText }]}>
                        {t('cards.trip.confirmation')}
                      </Text>,
                    ),
                    Embed(
                      <Text style={[styles.codeValue, { color: colors.text }]}>
                        {data.confirmationCode}
                      </Text>,
                    ),
                  )
                    .align('center')
                    .spacing('6')
                    .margin('top', 'xs'),
                ),
            ),
            Embed(
              data.hotel &&
                toElement(
                  HStack(
                    Embed(
                      <MaterialCommunityIcons
                        name="bed-outline"
                        size={14}
                        color={colors.secondaryText}
                      />,
                    ),
                    Embed(
                      <Text style={[styles.hotelText, { color: colors.text }]}>{data.hotel}</Text>,
                    ),
                    Embed(
                      data.checkIn && (
                        <Text style={[styles.time, { color: colors.secondaryText }]}>
                          {formatCardDate(locale, data.checkIn, {
                            month: 'short',
                            day: 'numeric',
                          })}
                          {data.checkOut
                            ? ` – ${formatCardDate(locale, data.checkOut, { month: 'short', day: 'numeric' })}`
                            : ''}
                        </Text>
                      ),
                    ),
                  )
                    .align('center')
                    .spacing('6')
                    .margin('top', 'xs'),
                ),
            ),
          ).spacing('sm'),
        )}
      </CardBody>
    </Card>
  );
}

const styles = StyleSheet.create({
  airline: { fontSize: 15, fontWeight: '600' },
  city: { fontSize: 14, fontWeight: '500' },
  time: { fontSize: 13 },
  codeLabel: { fontSize: 12 },
  codeValue: { fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  hotelText: { fontSize: 13, flex: 1 },
});
