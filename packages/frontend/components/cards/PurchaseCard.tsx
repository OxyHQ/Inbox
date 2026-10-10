import { useColors } from '@/constants/theme';
import { formatMoney } from '@/utils/cardFormat';
import type { CardData } from '@/services/emailApi';
import { Card, CardBody, CardHeader, CardTitle } from '@oxy.so/bloom/card';
import { Text } from '@oxy.so/bloom/typography';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from '@/lib/i18n';

interface PurchaseCardProps {
  data: CardData;
}

export function PurchaseCard({ data }: PurchaseCardProps) {
  const { t, locale } = useTranslation();
  const colors = useColors();

  const formattedAmount =
    data.amount != null ? formatMoney(locale, data.amount, data.currency) : null;

  return (
    <Card appearance="subtle">
      <CardHeader>
        <CardTitle>{t('cards.purchase.header')}</CardTitle>
      </CardHeader>
      <CardBody>
        <View style={styles.body}>
          {data.merchant && (
            <Text style={[styles.merchant, { color: colors.text }]}>{data.merchant}</Text>
          )}
          {formattedAmount && (
            <Text style={[styles.amount, { color: colors.text }]}>{formattedAmount}</Text>
          )}
          {data.orderNumber && (
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.secondaryText }]}>
                {t('cards.purchase.order')}
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>{data.orderNumber}</Text>
            </View>
          )}
          {Array.isArray(data.items) && data.items.length > 0 && (
            <View style={styles.items}>
              {data.items.slice(0, 3).map((item: string, i: number) => (
                <Text key={i} style={[styles.item, { color: colors.secondaryText }]}>
                  · {item}
                </Text>
              ))}
              {data.items.length > 3 && (
                <Text style={[styles.item, { color: colors.secondaryText }]}>
                  {t('cards.purchase.moreItems', { count: data.items.length - 3 })}
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
  body: { gap: 6 },
  merchant: { fontSize: 15, fontWeight: '600' },
  amount: { fontSize: 20, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 12 },
  value: { fontSize: 13, fontWeight: '600' },
  items: { gap: 2, marginTop: 4 },
  item: { fontSize: 13 },
});
