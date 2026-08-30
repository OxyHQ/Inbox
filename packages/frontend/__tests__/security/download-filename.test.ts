import { safeDownloadFilename } from '@/utils/downloadFilename';

describe('download filenames', () => {
  it('does not allow path traversal or control characters', () => {
    expect(safeDownloadFilename('../private/secret.txt')).toBe('secret.txt');
    expect(safeDownloadFilename('..\\private\\secret.txt')).toBe('secret.txt');
    expect(safeDownloadFilename('bad\u0000name?.txt')).toBe('bad_name_.txt');
  });

  it('uses a stable fallback for empty or dot-only names and caps length', () => {
    expect(safeDownloadFilename('')).toBe('attachment');
    expect(safeDownloadFilename('..')).toBe('attachment');
    expect(safeDownloadFilename('x'.repeat(300))).toHaveLength(180);
  });
});
