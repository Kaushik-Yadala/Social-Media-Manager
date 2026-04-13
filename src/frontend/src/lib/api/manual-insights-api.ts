/**
 * Manual Instagram/Facebook CSV/ZIP upload API helpers.
 */

const BASE_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE_URL) ||
  'http://localhost:8000';
const DEFAULT_MANUAL_ACCOUNT_ID = 'ClubArtizen';

export type ManualPlatform = 'insta' | 'facebook';
export type ManualUploadMode = 'csv' | 'zip';
export type ManualInstagramUploadScope = 'channelwise' | 'posts';

export interface ManualUploadResult {
  message: string;
  source?: string;
  ig_user_id?: string;
  fb_user_id?: string;
  processed_files?: number;
  touched_dates?: number;
  created_entries?: number;
  updated_entries?: number;
  metric_keys?: string[];
  archive_name?: string;
  processed_file?: string;
  processed_posts?: number;
  [key: string]: unknown;
}

export interface ManualUploadInput {
  platform: ManualPlatform;
  mode: ManualUploadMode;
  instagramScope?: ManualInstagramUploadScope;
  accountId: string;
  files: File[];
}

function stringifyDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map(stringifyDetail).filter(Boolean).join(', ');
  }
  if (detail && typeof detail === 'object') {
    return JSON.stringify(detail);
  }
  return '';
}

export function getManualUploadPath(
  platform: ManualPlatform,
  mode: ManualUploadMode,
  accountId: string,
  instagramScope: ManualInstagramUploadScope = 'channelwise',
): string {
  const normalizedAccountId = accountId.trim() || DEFAULT_MANUAL_ACCOUNT_ID;
  const safeId = encodeURIComponent(normalizedAccountId);

  if (platform === 'insta' && instagramScope === 'posts') {
    return `/manual/insta/posts/${safeId}/csvs`;
  }

  const endpointType = mode === 'csv' ? 'csvs' : 'folders';
  return `/manual/${platform}/${endpointType}/${safeId}`;
}

export async function uploadManualInsights({
  platform,
  mode,
  instagramScope = 'channelwise',
  accountId,
  files,
}: ManualUploadInput): Promise<ManualUploadResult> {
  const path = getManualUploadPath(platform, mode, accountId, instagramScope);
  const formData = new FormData();

  if (platform === 'insta' && instagramScope === 'posts') {
    const postCsv = files[0];
    if (!postCsv) {
      throw new Error('Please choose a post CSV file to upload.');
    }
    formData.append('posts_csv', postCsv);
  } else if (mode === 'csv') {
    files.forEach((file) => formData.append('files', file));
  } else {
    const archive = files[0];
    if (!archive) {
      throw new Error('Please choose a ZIP file to upload.');
    }
    formData.append('folder_archive', archive);
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    body: formData,
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const detail =
      payload && typeof payload === 'object' && 'detail' in payload
        ? (payload as { detail: unknown }).detail
        : payload;
    const detailMessage = stringifyDetail(detail);
    throw new Error(detailMessage || `Upload failed (${response.status}).`);
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('Upload completed but response payload was invalid.');
  }

  return payload as ManualUploadResult;
}
