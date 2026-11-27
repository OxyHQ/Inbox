import { useInboxPrefs } from '@/contexts/inbox-prefs-context';
import { useTranslation } from '@/lib/i18n';
import { Text, toElement, VStack } from '@oxy.so/bloom-language';
import { Admonition, GroupedSection, GroupedSectionItem } from '@oxy.so/bloom-language/containers';
import { Toggle } from '@oxy.so/bloom-language/inputs';

type AIPref = 'aiBrief' | 'aiSmartReply' | 'aiThreadSummary' | 'aiCategorization';

/** Each AI feature: its preference, the section's title and the row's title and description. */
const FEATURES: readonly { pref: AIPref; section: string; title: string; description: string }[] = [
  {
    pref: 'aiBrief',
    section: 'dailyBrief',
    title: 'recap',
    description: 'recapDescription',
  },
  {
    pref: 'aiSmartReply',
    section: 'smartReply',
    title: 'suggestions',
    description: 'suggestionsDescription',
  },
  {
    pref: 'aiThreadSummary',
    section: 'summary',
    title: 'summaryTitle',
    description: 'summaryDescription',
  },
  {
    pref: 'aiCategorization',
    section: 'priority',
    title: 'priorityTitle',
    description: 'priorityDescription',
  },
];

export function AISection() {
  const { prefs, setPref } = useInboxPrefs();
  const { t } = useTranslation();
  const row = ({ pref, section, title, description }: (typeof FEATURES)[number]) => {
    const label = t(`ui.settings.ai.${title}`);
    return GroupedSection(
      GroupedSectionItem(label)
        .lines(0)
        .descriptionLines(0)
        .wrapControl()
        .description(t(`ui.settings.ai.${description}`))
        .trailing(Toggle([prefs[pref], (v: boolean) => setPref(pref, v)]).label(label)),
    ).title(t(`ui.settings.ai.${section}`));
  };
  return toElement(
    VStack(...FEATURES.map(row), Admonition(Text(t('ui.settings.ai.tip'))).style('tip')).spacing(
      '2xl',
    ),
  );
}
