import { useAppShell } from '@oxy.so/bloom/app-shell';
/** App-specific search routing around Bloom's shared search field and buttons. */
import { useTranslation } from '@/lib/i18n';
import { Button } from '@oxy.so/bloom/button';
import { ButtonGroup, ButtonGroupItem } from '@oxy.so/bloom/button-group';
import { PageHeader } from '@oxy.so/bloom/page-header';
import { RiMenuLine, RiSearchLine } from '@oxy.so/bloom/icons';
import { Search } from '@oxy.so/bloom/search';
import { forwardRef } from 'react';
import type { TextInput } from 'react-native';

interface SearchHeaderProps {
  onLeftIcon: () => void;
  leftIcon?: 'menu' | 'arrow-left';
  hideLeftIcon?: boolean;
  placeholder?: string;
  onPress?: () => void;
  value?: string;
  onChangeText?: (text: string) => void;
  onSubmitEditing?: () => void;
  onClear?: () => void;
  autoFocus?: boolean;
}

export const SearchHeader = forwardRef<TextInput, SearchHeaderProps>(function SearchHeader(
  {
    onLeftIcon,
    leftIcon = 'menu',
    hideLeftIcon = false,
    placeholder,
    onPress,
    value,
    onChangeText,
    onSubmitEditing,
    onClear,
    autoFocus,
  },
  ref,
) {
  const { t } = useTranslation();
  const shell = useAppShell();
  const label = placeholder ?? t('search.placeholder');
  return (
    <PageHeader
      sticky={false}
      scrim="none"
      safeArea={false}
      onBack={!hideLeftIcon && leftIcon === 'arrow-left' ? onLeftIcon : undefined}
      backLabel={t('search.goBack')}
      leading={
        shell.drawerAvailable ? (
          <ButtonGroup accessibilityLabel={t('search.openMenu')}>
            <ButtonGroupItem
              iconOnly
              leadingIcon={RiMenuLine}
              accessibilityLabel={t('search.openMenu')}
              onPress={shell.openDrawer}
            />
          </ButtonGroup>
        ) : undefined
      }
      title={
        onChangeText ? (
          <Search
            ref={ref}
            label={label}
            value={value}
            onChangeText={onChangeText}
            onClearText={onClear}
            onSubmitEditing={onSubmitEditing}
            autoFocus={autoFocus}
          />
        ) : (
          <Button
            appearance="subtle"
            leading={<RiSearchLine />}
            onPress={onPress}
            accessibilityLabel={label}
          >
            {label}
          </Button>
        )
      }
    />
  );
});
