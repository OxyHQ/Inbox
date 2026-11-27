import { useColors } from '@/constants/theme';
import { formatMoney, formatCardDate, isPastDue } from '@/utils/cardFormat';
import type { CardData } from '@/services/emailApi';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Card, CardBody, CardHeader, CardTitle } from '@oxy.so/bloom/card';
import { Text } from '@oxy.so/bloom/typography';
import { StyleSheet } from 'react-native';
import { useTranslation } from '@/lib/i18n';

import { Embed, HStack, VStack, toElement } from '@oxy.so/bloom-language';

interface BillCardProps {
  data: CardData;
}

export function BillCard({ data }: BillCardProps) {
  const { t, locale } = useTranslation();
  const colors = useColors();

  const formattedAmount =
    data.amount != null ? formatMoney(locale, data.amount, data.currency) : null;

  const dueDate = data.dueDate
    ? formatCardDate(locale, data.dueDate, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : null;

  const isOverdue = isPastDue(data.dueDate);

  return (
    <Card appearance="subtle">
      <CardHeader>
        <CardTitle>{t('cards.bill.header')}</CardTitle>
      </CardHeader>
      <CardBody>
        {toElement(
          VStack(
            Embed(
              data.biller && (
                <Text style={[styles.biller, { color: colors.text }]}>{data.biller}</Text>
              ),
            ),
            Embed(
              formattedAmount && (
                <Text style={[styles.amount, { color: colors.text }]}>{formattedAmount}</Text>
              ),
            ),
            Embed(
              dueDate &&
                toElement(
                  HStack(
                    Embed(
                      <MaterialCommunityIcons
                        name="calendar-clock"
                        size={14}
                        color={isOverdue ? colors.danger : colors.secondaryText}
                      />,
                    ),
                    Embed(
                      <Text
                        style={[
                          styles.dueDate,
                          { color: isOverdue ? colors.danger : colors.secondaryText },
                        ]}
                      >
                        {t(isOverdue ? 'cards.bill.overdue' : 'cards.bill.due', { date: dueDate })}
                      </Text>,
                    ),
                  )
                    .align('center')
                    .spacing('6'),
                ),
            ),
            Embed(
              data.accountNumber &&
                toElement(
                  HStack(
                    Embed(
                      <Text style={[styles.label, { color: colors.secondaryText }]}>
                        {t('cards.bill.account')}
                      </Text>,
                    ),
                    Embed(
                      <Text style={[styles.value, { color: colors.text }]}>
                        {data.accountNumber}
                      </Text>,
                    ),
                  )
                    .align('center')
                    .spacing('6'),
                ),
            ),
          ).spacing('6'),
        )}
      </CardBody>
    </Card>
  );
}

const styles = StyleSheet.create({
  biller: { fontSize: 15, fontWeight: '600' },
  amount: { fontSize: 20, fontWeight: '700' },
  dueDate: { fontSize: 13, fontWeight: '500' },
  label: { fontSize: 12 },
  value: { fontSize: 13, fontWeight: '600' },
});
