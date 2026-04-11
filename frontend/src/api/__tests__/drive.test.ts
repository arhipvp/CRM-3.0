import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  downloadDealDriveFiles,
  fetchDealDriveFiles,
  renameDealDriveFile,
  trashDealDriveFiles,
  uploadDealDriveFile,
} from '../drive';
import { request, requestBlobWithHeaders } from '../request';

vi.mock('../request', () => ({
  request: vi.fn(),
  requestBlobWithHeaders: vi.fn(),
}));

describe('deal drive API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests drive files for closed deals by default', async () => {
    vi.mocked(request).mockResolvedValue({ files: [], folder_id: 'folder-1' });

    await fetchDealDriveFiles('deal-1');

    expect(request).toHaveBeenCalledWith('/deals/deal-1/drive-files/?show_closed=1');
  });

  it('preserves deleted and parent flags alongside show_closed for drive listing', async () => {
    vi.mocked(request).mockResolvedValue({ files: [], folder_id: 'folder-1' });

    await fetchDealDriveFiles('deal-1', true, 'parent-1');

    expect(request).toHaveBeenCalledWith(
      '/deals/deal-1/drive-files/?show_closed=1&show_deleted=1&parent_id=parent-1',
    );
  });

  it('uses show_closed for rename, trash, upload, and download operations', async () => {
    vi.mocked(request)
      .mockResolvedValueOnce({ file: { id: 'file-1', name: 'renamed.pdf', is_folder: false } })
      .mockResolvedValueOnce({ moved_file_ids: ['file-1'] })
      .mockResolvedValueOnce({ file: { id: 'file-1', name: 'uploaded.pdf', is_folder: false } });
    vi.mocked(requestBlobWithHeaders).mockResolvedValue({
      blob: new Blob(['data']),
      headers: new Headers(),
    });

    await renameDealDriveFile('deal-1', 'file-1', 'renamed.pdf');
    await trashDealDriveFiles('deal-1', ['file-1']);
    await uploadDealDriveFile('deal-1', new File(['data'], 'uploaded.pdf'));
    await downloadDealDriveFiles('deal-1', ['file-1']);

    expect(request).toHaveBeenNthCalledWith(1, '/deals/deal-1/drive-files/?show_closed=1', {
      method: 'PATCH',
      body: JSON.stringify({ file_id: 'file-1', name: 'renamed.pdf' }),
    });
    expect(request).toHaveBeenNthCalledWith(2, '/deals/deal-1/drive-files/?show_closed=1', {
      method: 'DELETE',
      body: JSON.stringify({ file_ids: ['file-1'] }),
    });
    expect(request).toHaveBeenNthCalledWith(3, '/deals/deal-1/drive-files/?show_closed=1', {
      method: 'POST',
      body: expect.any(FormData),
    });
    expect(requestBlobWithHeaders).toHaveBeenCalledWith(
      '/deals/deal-1/drive-files/download/?show_closed=1',
      {
        method: 'POST',
        body: JSON.stringify({ file_ids: ['file-1'] }),
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  });
});
