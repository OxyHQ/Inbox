// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are invalid in a filename and are stripped on purpose.
const INVALID_FILENAME_CHARACTERS = /[\u0000-\u001f\u007f"<>:*?|\\/]+/g;

/** Keep user-controlled attachment names inside the app's download directory. */
export function safeDownloadFilename(filename: string, fallback = 'attachment'): string {
  const basename = filename.split(/[\\/]/).pop()?.trim() ?? '';
  const cleaned = basename.replace(INVALID_FILENAME_CHARACTERS, '_').replace(/\s+/g, ' ').trim();
  if (!cleaned || cleaned === '.' || cleaned === '..') return fallback;
  if (cleaned.length <= 180) return cleaned;

  const suffix =
    /\.tar\.(?:gz|bz2|xz|zst)$/i.exec(cleaned)?.[0] ??
    /\.[a-z0-9]{1,16}$/i.exec(cleaned)?.[0] ??
    '';
  const end = 180 - suffix.length;
  let prefix = cleaned.slice(0, end);
  const last = prefix.charCodeAt(prefix.length - 1);
  const next = cleaned.charCodeAt(end);
  if (last >= 0xd800 && last <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
    prefix = prefix.slice(0, -1);
  }
  return prefix + suffix;
}

/** Encode one filename as a file-URI path segment, including malformed UTF-16. */
export function safeDownloadUriComponent(filename: string): string {
  const text = Array.from(safeDownloadFilename(filename), (character) => {
    if (character.length !== 1) return character;
    const unit = character.charCodeAt(0);
    return unit >= 0xd800 && unit <= 0xdfff ? '\uFFFD' : character;
  }).join('');
  return encodeURIComponent(text);
}
