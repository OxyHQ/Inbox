import { memo } from 'react';
import { View } from 'react-native';
import { Sticker } from '@oxy.so/bloom/sticker';
import { useSticker } from '@oxy.so/stickers/react';
import { EMPTY_STATE_STICKERS, type EmptyStateStickerName } from '@/lib/stickers';

// Match Mention's empty-state artwork slot; keep the text still while loading.
const SIZE = 120;

/** Catalogue adapter only: Bloom handles animation, fallback and reduced motion. */
export const EmptyStateSticker = memo(function EmptyStateSticker({
  name,
  size = SIZE,
}: {
  name: EmptyStateStickerName;
  size?: number;
}) {
  const { data: sticker } = useSticker(EMPTY_STATE_STICKERS[name]);
  if (!sticker) return <View style={{ width: size, height: size }} />;
  return (
    <Sticker
      animation={sticker.animation.url}
      fallback={sticker.fallback.url}
      size={size}
      decorative
      testID={`empty-sticker-${name}`}
    />
  );
});
