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

  it('retains a short extension or common tar compression suffix when shortening', () => {
    const pdf = safeDownloadFilename(`${'x'.repeat(180)}.pdf`);
    expect(pdf).toBe(`${'x'.repeat(176)}.pdf`);
    const archive = safeDownloadFilename(`${'x'.repeat(200)}.tar.gz`);
    expect(archive).toBe(`${'x'.repeat(173)}.tar.gz`);
    expect(safeDownloadFilename('report.pdf')).toBe('report.pdf');
  });

  it('does not cut a valid surrogate pair at the length boundary', () => {
    expect(safeDownloadFilename(`${'x'.repeat(179)}😀`)).toBe('x'.repeat(179));
    expect(safeDownloadFilename(`${'x'.repeat(175)}😀.pdf`)).toBe(`${'x'.repeat(175)}.pdf`);
  });
});
