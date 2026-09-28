import { useColors } from '@/constants/theme';
import type { CardData } from '@/services/emailApi';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Badge } from '@oxy.so/bloom/badge';
import { Card, CardBody, CardHeader, CardTitle } from '@oxy.so/bloom/card';
import { Text } from '@oxy.so/bloom/typography';
import { StyleSheet, View } from 'react-native';

interface PackageCardProps {
  data: CardData;
}

export function PackageCard({ data }: PackageCardProps) {
  const colors = useColors();

  const estimatedDelivery = data.estimatedDelivery
    ? new Date(data.estimatedDelivery).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <Card variant="filled">
      <CardHeader>
        <CardTitle>Package</CardTitle>
      </CardHeader>
      <CardBody>
        <View style={styles.body}>
          {data.merchant && (
            <Text style={[styles.merchant, { color: colors.text }]}>
              {data.merchant}
            </Text>
          )}
          {data.status && (
            <Badge
              variant="subtle"
              color={getStatusTone(data.status)}
              content={data.status}
            />
          )}
          {data.carrier && (
            <View style={styles.row}>
              <MaterialCommunityIcons
                name="truck-outline"
                size={14}
                color={colors.secondaryText}
              />
              <Text style={[styles.carrier, { color: colors.secondaryText }]}>
                {data.carrier}
              </Text>
            </View>
          )}
          {data.trackingNumber && (
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.secondaryText }]}>
                Tracking
              </Text>
              <Text style={[styles.tracking, { color: colors.text }]}>
                {data.trackingNumber}
              </Text>
            </View>
          )}
          {estimatedDelivery && (
            <View style={styles.row}>
              <MaterialCommunityIcons
                name="calendar-check-outline"
                size={14}
                color={colors.secondaryText}
              />
              <Text style={[styles.delivery, { color: colors.secondaryText }]}>
                Est. {estimatedDelivery}
              </Text>
            </View>
          )}
        </View>
      </CardBody>
    </Card>
  );
}

function getStatusTone(
  status: string,
): 'success' | 'info' | 'warning' | 'default' {
  const s = status.toLowerCase();
  if (s.includes('out for')) return 'warning';
  if (s.includes('delivered')) return 'success';
  if (s.includes('transit') || s.includes('shipped')) return 'info';
  return 'default';
}

const styles = StyleSheet.create({
  body: { gap: 8 },
  merchant: { fontSize: 15, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  carrier: { fontSize: 13 },
  label: { fontSize: 12 },
  tracking: { fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  delivery: { fontSize: 13 },
});
