/**
 * A size typed by a person — `5000`, `5 KB`, `2.5MB` — as bytes, or null. The
 * filter API compares `Number(value)` with the message size, so "5MB" saved
 * fine and then never matched anything.
 */
export function parseByteSize(input: string): number | null {
  const match = /^\s*(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?\s*$/i.exec(input);
  if (!match) return null;
  const unit = (match[2] ?? 'b').toLowerCase();
  const factor = unit === 'gb' ? 1024 ** 3 : unit === 'mb' ? 1024 ** 2 : unit === 'kb' ? 1024 : 1;
  return Math.round(Number(match[1]) * factor);
}
