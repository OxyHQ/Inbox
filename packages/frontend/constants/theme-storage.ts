import AsyncStorage from '@react-native-async-storage/async-storage';
import { webLocalStorage } from '@oxy.so/bloom/theme';
import { Platform } from 'react-native';

/** Bloom remembers the last account palette; the SDK still selects the active account's color. */
export const INBOX_THEME_STORAGE = Platform.OS === 'web' ? webLocalStorage : AsyncStorage;
