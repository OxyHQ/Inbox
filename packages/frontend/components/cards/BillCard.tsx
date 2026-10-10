import { useColors } from '@/constants/theme';
import { formatMoney, formatCardDate, isPastDue } from '@/utils/cardFormat';
import type { CardData } from '@/services/emailApi';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Card, CardBody, CardHeader, CardTitle } from '@oxy.so/bloom/card';
import { Text } from '@oxy.so/bloom/typography';
import { StyleSheet, View } from 'react-native';

interface BillCardProps {
  data: CardData;
}

export function BillCard({ data }: BillCardProps) {
  const colors = useColors();

  const formattedAmount =
    data.amount != null
      ? formatMoney(data.amount, data.currency)
      : null;

  const dueDate = data.dueDate
    ? formatCardDate(data.dueDate, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : null;

  const isOverdue = isPastDue(data.dueDate);

  return (
    <Card appearance="subtle">
      <CardHeader>
        <CardTitle>Bill</CardTitle>
      </CardHeader>
      <CardBody>
        <View style={styles.body}>
          {data.biller && (
            <Text style={[styles.biller, { color: colors.text }]}>
              {data.biller}
            </Text>
          )}
          {formattedAmount && (
            <Text style={[styles.amount, { color: colors.text }]}>
              {formattedAmount}
            </Text>
          )}
          {dueDate && (
            <View style={styles.row}>
              <MaterialCommunityIcons
                name="calendar-clock"
                size={14}
                color={isOverdue ? colors.danger : colors.secondaryText}
              />
              <Text
                style={[
                  styles.dueDate,
                  { color: isOverdue ? colors.danger : colors.secondaryText },
                ]}
              >
                {isOverdue ? 'Overdue · ' : 'Due '}
                {dueDate}
              </Text>
            </View>
          )}
          {data.accountNumber && (
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.secondaryText }]}>
                Account
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {data.accountNumber}
              </Text>
            </View>
          )}
        </View>
      </CardBody>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { gap: 6 },
  biller: { fontSize: 15, fontWeight: '600' },
  amount: { fontSize: 20, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dueDate: { fontSize: 13, fontWeight: '500' },
  label: { fontSize: 12 },
  value: { fontSize: 13, fontWeight: '600' },
});
