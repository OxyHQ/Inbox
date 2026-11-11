/** `@oxy.so/bloom/fab` pulls in Reanimated, which cannot load under Node. */
export function Fab({ label, onPress }: { label?: string; onPress?: () => void }) {
  return (
    <button type="button" onClick={onPress}>
      {label}
    </button>
  );
}
