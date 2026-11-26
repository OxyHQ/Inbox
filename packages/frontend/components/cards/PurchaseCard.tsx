import { useColors } from '@/constants/theme';
import { formatMoney } from '@/utils/cardFormat';
import type { CardData } from '@/services/emailApi';
import { Card, CardBody, CardHeader, CardTitle } from '@oxy.so/bloom/card';
import { Text } from '@oxy.so/bloom/typography';
import { StyleSheet } from 'react-native';
import { useTranslation } from '@/lib/i18n';

import { Embed, HStack, VStack, toElement } from '@oxy.so/bloom-language';

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
        {toElement(
          VStack(
            Embed(
              data.merchant && (
                <Text style={[styles.merchant, { color: colors.text }]}>{data.merchant}</Text>
              ),
            ),
            Embed(
              formattedAmount && (
                <Text style={[styles.amount, { color: colors.text }]}>{formattedAmount}</Text>
              ),
            ),
            Embed(
              data.orderNumber &&
                toElement(
                  HStack(
                    Embed(
                      <Text style={[styles.label, { color: colors.secondaryText }]}>
                        {t('cards.purchase.order')}
                      </Text>,
                    ),
                    Embed(
                      <Text style={[styles.value, { color: colors.text }]}>
                        {data.orderNumber}
                      </Text>,
                    ),
                  )
                    .align('center')
                    .spacing('6'),
                ),
            ),
            Embed(
              Array.isArray(data.items) &&
                data.items.length > 0 &&
                toElement(
                  VStack(
                    Embed(
                      data.items.slice(0, 3).map((item: string, i: number) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: a read-only list that never reorders; two items can share a name.
                        <Text key={i} style={[styles.item, { color: colors.secondaryText }]}>
                          · {item}
                        </Text>
                      )),
                    ),
                    Embed(
                      data.items.length > 3 && (
                        <Text style={[styles.item, { color: colors.secondaryText }]}>
                          {t('cards.purchase.moreItems', { count: data.items.length - 3 })}
                        </Text>
                      ),
                    ),
                  )
                    .spacing('2xs')
                    .margin('top', 'xs'),
                ),
            ),
          ).spacing('6'),
        )}
      </CardBody>
    </Card>
  );
}

const styles = StyleSheet.create({
  merchant: { fontSize: 15, fontWeight: '600' },
  amount: { fontSize: 20, fontWeight: '700' },
  label: { fontSize: 12 },
  value: { fontSize: 13, fontWeight: '600' },
  item: { fontSize: 13 },
});
