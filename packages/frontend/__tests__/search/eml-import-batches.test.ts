import {
  EML_IMPORT_MAX_BYTES_PER_REQUEST,
  EML_IMPORT_MAX_FILES_PER_REQUEST,
  batchImportFiles,
  createEmailApi,
} from '@/services/emailApi';

const MiB = 1024 * 1024;
const sized = (size: number, name = 'm.eml') => ({ size, name });

describe('.eml import batching', () => {
  it('keeps every batch within the per-request file and byte budget, in order', () => {
    const files = [
      ...Array.from({ length: 7 }, (_, i) => sized(MiB, `small-${i}.eml`)),
      sized(20 * MiB, 'a.eml'),
      sized(20 * MiB, 'b.eml'),
      sized(20 * MiB, 'c.eml'),
    ];
    const batches = batchImportFiles(files);
    expect(batches.flat()).toEqual(files);
    for (const batch of batches) {
      expect(batch.length).toBeLessThanOrEqual(EML_IMPORT_MAX_FILES_PER_REQUEST);
      const bytes = batch.reduce((sum, f) => sum + f.size, 0);
      expect(bytes <= EML_IMPORT_MAX_BYTES_PER_REQUEST || batch.length === 1).toBe(true);
    }
    expect(batches.map((b) => b.length)).toEqual([5, 4, 1]);
  });

  it('sends a file over the byte budget on its own', () => {
    expect(
      batchImportFiles([sized(MiB), sized(60 * MiB), sized(MiB)]).map((b) => b.length),
    ).toEqual([1, 1, 1]);
  });

  it('posts each batch and sums the counts', async () => {
    const http = {
      post: jest
        .fn()
        .mockResolvedValueOnce({ imported: 5, total: 5 })
        .mockResolvedValueOnce({ imported: 1, total: 2 }),
    };
    const api = createEmailApi(http as never);
    const files = Array.from(
      { length: 7 },
      (_, i) => new File([new Uint8Array(10)], `m-${i}.eml`, { type: 'message/rfc822' }),
    );
    await expect(api.importMessages(files)).resolves.toEqual({ imported: 6, total: 7 });
    expect(http.post).toHaveBeenCalledTimes(2);
    expect(
      http.post.mock.calls.map(([path, body]) => [path, (body as FormData).getAll('files').length]),
    ).toEqual([
      ['/email/import', 5],
      ['/email/import', 2],
    ]);
  });
});
