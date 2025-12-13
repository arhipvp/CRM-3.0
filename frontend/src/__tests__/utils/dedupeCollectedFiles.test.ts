import { describe, expect, it } from 'vitest';

import { CollectedFile, dedupeCollectedFiles } from '../../utils/fileUpload';

describe('dedupeCollectedFiles', () => {
  it('removes duplicates by key and preserves order', () => {
    const fileA = new File(['a'], 'a.txt', { lastModified: 1 });
    const fileADuplicate = new File(['a'], 'a.txt', { lastModified: 1 });
    const fileB = new File(['b'], 'b.txt', { lastModified: 2 });

    const items: CollectedFile[] = [
      { file: fileA, key: '/folder/a.txt' },
      { file: fileADuplicate, key: '/folder/a.txt' },
      { file: fileB, key: '/folder/b.txt' },
    ];

    const result = dedupeCollectedFiles(items);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('a.txt');
    expect(result[1].name).toBe('b.txt');
  });
});
