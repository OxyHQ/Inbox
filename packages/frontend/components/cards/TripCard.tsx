import { formatCardDate } from '@/utils/cardFormat';
import { useColors } from '@/constants/theme';
import type { CardData } from '@/services/emailApi';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Card, CardBody, CardHeader, CardTitle } from '@oxy.so/bloom/card';
import { Text } from '@oxy.so/bloom/typography';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from '@/lib/i18n';

interface TripCardProps {
  data: CardData;
}

export function TripCard({ data }: TripCardProps) {
  const { t } = useTranslation();
  const colors = useColors();

  const departureTime = data.departureTime
    ? formatCardDate(data.departureTime, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }, true)
    : null;

  const arrivalTime = data.arrivalTime
    ? formatCardDate(data.arrivalTime, {
        hour: 'numeric',
        minute: '2-digit',
      }, true)
    : null;

  return (
    <Card appearance="subtle">
      <CardHeader>
        <CardTitle>{t('cards.trip.header')}</CardTitle>
      </CardHeader>
      <CardBody>
        <View style={styles.body}>
          {data.airline && (
            <Text style={[styles.airline, { color: colors.text }]}>
              {data.airline} {data.flightNumber ? `· ${data.flightNumber}` : ''}
            </Text>
          )}
          {(data.departure || data.arrival) && (
            <View style={styles.route}>
              <Text style={[styles.city, { color: colors.text }]}>
                {data.departure || '—'}
              </Text>
              <MaterialCommunityIcons
                name="arrow-right"
                size={16}
                color={colors.secondaryText}
              />
              <Text style={[styles.city, { color: colors.text }]}>
                {data.arrival || '—'}
              </Text>
            </View>
          )}
          {departureTime && (
            <Text style={[styles.time, { color: colors.secondaryText }]}>
              {departureTime}
              {arrivalTime ? ` → ${arrivalTime}` : ''}
            </Text>
          )}
          {data.confirmationCode && (
            <View style={styles.codeRow}>
              <Text style={[styles.codeLabel, { color: colors.secondaryText }]}>
                {t('cards.trip.confirmation')}
              </Text>
              <Text style={[styles.codeValue, { color: colors.text }]}>
                {data.confirmationCode}
              </Text>
            </View>
          )}
          {data.hotel && (
            <View style={styles.codeRow}>
              <MaterialCommunityIcons
                name="bed-outline"
                size={14}
                color={colors.secondaryText}
              />
              <Text style={[styles.hotelText, { color: colors.text }]}>
                {data.hotel}
              </Text>
              {data.checkIn && (
                <Text style={[styles.time, { color: colors.secondaryText }]}>
                  {formatCardDate(data.checkIn, {
                    month: 'short',
                    day: 'numeric',
                  })}
                  {data.checkOut
                    ? ` – ${formatCardDate(data.checkOut, { month: 'short', day: 'numeric' })}`
                    : ''}
                </Text>
              )}
            </View>
          )}
        </View>
      </CardBody>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { gap: 8 },
  airline: { fontSize: 15, fontWeight: '600' },
  route: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  city: { fontSize: 14, fontWeight: '500' },
  time: { fontSize: 13 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  codeLabel: { fontSize: 12 },
  codeValue: { fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  hotelText: { fontSize: 13, flex: 1 },
});
