const INVALID_FILENAME_CHARACTERS = /[\u0000-\u001f\u007f"<>:*?|\\/]+/g;

/** Keep user-controlled attachment names inside the app's download directory. */
export function safeDownloadFilename(filename: string, fallback = 'attachment'): string {
  const basename = filename.split(/[\\/]/).pop()?.trim() ?? '';
  const cleaned = basename.replace(INVALID_FILENAME_CHARACTERS, '_').replace(/\s+/g, ' ').trim();
  if (!cleaned || cleaned === '.' || cleaned === '..') return fallback;
  return cleaned.slice(0, 180);
}
