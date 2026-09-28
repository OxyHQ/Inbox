import { Avatar as BloomAvatar } from '@oxy.so/bloom/avatar';

/** Sender images are supplied by the mail API; Bloom owns fallback, shape and color. */
export function Avatar({
  name,
  size = 40,
  avatarUrl,
}: {
  name: string;
  size?: number;
  avatarUrl?: string | null;
}) {
  return <BloomAvatar name={name} source={avatarUrl ?? null} size={size} />;
}
export function SenderAvatar({
  avatarPath,
  name,
  size,
}: {
  avatarPath?: string | null;
  name: string;
  size?: number;
}) {
  const source = avatarPath
    ? `${process.env.EXPO_PUBLIC_API_URL ?? 'https://api.oxy.so'}${avatarPath}`
    : undefined;
  return <Avatar name={name} size={size} avatarUrl={source} />;
}
