/** App-specific search routing around Bloom's shared search field and buttons. */
import { forwardRef } from 'react';
import { View, type TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search } from '@oxy.so/bloom/search';
import { Button, IconButton } from '@oxy.so/bloom/button';
import { RiMenuLine, RiArrowLeftLine, RiSearchLine } from '@oxy.so/bloom/icons';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { useTranslation } from '@/lib/i18n';

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

export const SearchHeader = forwardRef<TextInput, SearchHeaderProps>(function SearchHeader({ onLeftIcon, leftIcon = 'menu', hideLeftIcon = false, placeholder, onPress, value, onChangeText, onSubmitEditing, onClear, autoFocus }, ref) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const label = placeholder ?? t('search.placeholder');
  return (
    <View style={{ paddingTop: insets.top + 8, paddingBottom: 8, paddingLeft: insets.left + 12, paddingRight: insets.right + 12 }}>
      <View style={{ width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {!hideLeftIcon && <IconButton accessibilityLabel={t(leftIcon === 'menu' ? 'search.openMenu' : 'search.goBack')} icon={leftIcon === 'menu' ? <RiMenuLine /> : <RiArrowLeftLine />} onPress={onLeftIcon} />}
        <View style={{ flex: 1 }}>
          {onChangeText ? <Search ref={ref} label={label} value={value} onChangeText={onChangeText} onClearText={onClear} onSubmitEditing={onSubmitEditing} autoFocus={autoFocus} /> : <Button appearance="subtle" leading={<RiSearchLine />} onPress={onPress} accessibilityLabel={label} style={{ width: '100%', justifyContent: 'flex-start' }}>{label}</Button>}
        </View>
      </View>
    </View>
  );
});
