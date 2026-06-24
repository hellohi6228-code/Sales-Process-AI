const TOKEN_KEY = 'google_provider_token';
const TOKEN_OBTAINED_AT_KEY = 'google_provider_token_obtained_at';
// Google OAuth access tokens issued via Supabase typically last ~1 hour.
// We treat anything older than 55 minutes as expired to leave a safety buffer.
const TOKEN_TTL_MS = 55 * 60 * 1000;

export class GoogleDriveError extends Error {
  status?: number;
  code: 'GOOGLE_TOKEN_EXPIRED' | 'GOOGLE_NOT_CONNECTED' | 'GOOGLE_API_ERROR';

  constructor(message: string, code: GoogleDriveError['code'], status?: number) {
    super(message);
    this.name = 'GoogleDriveError';
    this.code = code;
    this.status = status;
  }
}

export async function getGoogleToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function recordGoogleTokenObtained() {
  localStorage.setItem(TOKEN_OBTAINED_AT_KEY, String(Date.now()));
}

export function clearGoogleToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_OBTAINED_AT_KEY);
}

function isTokenExpired(): boolean {
  const obtainedAt = localStorage.getItem(TOKEN_OBTAINED_AT_KEY);
  if (!obtainedAt) return true;
  return Date.now() - Number(obtainedAt) > TOKEN_TTL_MS;
}

export async function ensureValidGoogleToken(): Promise<string> {
  const token = await getGoogleToken();
  if (!token) {
    throw new GoogleDriveError('No Google account connected.', 'GOOGLE_NOT_CONNECTED');
  }
  if (isTokenExpired()) {
    throw new GoogleDriveError(
      'Your Google session has expired. Please reconnect your Google account.',
      'GOOGLE_TOKEN_EXPIRED'
    );
  }
  return token;
}

/**
 * Exported so storage.ts providers can reuse it without duplicating error logic.
 */
export async function checkDriveResponse(res: Response, context: string): Promise<Response> {
  if (res.ok) return res;

  let message = res.statusText;
  try {
    const body = await res.json();
    message = body?.error?.message || body?.error_description || message;
  } catch {
    try {
      const text = await res.text();
      if (text) message = text;
    } catch {}
  }

  if (res.status === 401) {
    throw new GoogleDriveError(
      `Your Google session has expired. Please reconnect your Google account. (${context})`,
      'GOOGLE_TOKEN_EXPIRED',
      res.status
    );
  }

  throw new GoogleDriveError(
    `Google Drive error during ${context}: ${res.status} ${message}`,
    'GOOGLE_API_ERROR',
    res.status
  );
}

export async function findOrCreateFolder(name: string, parentId?: string): Promise<string> {
  const token = await ensureValidGoogleToken();

  let query = `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and trashed=false`;
  if (parentId) query += ` and '${parentId}' in parents`;

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  await checkDriveResponse(searchRes, 'searching for folder');
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) return searchData.files[0].id;

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : [],
    }),
  });
  await checkDriveResponse(createRes, 'creating folder');
  const createData = await createRes.json();
  return createData.id;
}

export async function getRootAppFolder(type: 'LEAD' | 'PROCESS') {
  return findOrCreateFolder(type);
}

export async function syncFolderStructure(leadOrProcessName: string, type: 'LEAD' | 'PROCESS' = 'LEAD') {
  const rootId = await getRootAppFolder(type);
  return findOrCreateFolder(leadOrProcessName, rootId);
}

export async function initializeDefaultProcessFolders(folders: string[]) {
  const processRootId = await getRootAppFolder('PROCESS');
  for (const folder of folders) {
    await findOrCreateFolder(folder, processRootId);
  }
}

export async function uploadBase64ToDrive(filename: string, base64Url: string, folderId: string) {
  const token = await ensureValidGoogleToken();
  const match = base64Url.match(/^data:(.*?);base64,(.*)$/);
  if (!match) throw new Error('Invalid base64 Data URL');
  const mimeType = match[1];
  const base64Data = match[2];

  const metadata: any = { name: filename, parents: [folderId] };
  if (mimeType.includes('text') || mimeType.includes('wordprocessing')) {
    metadata.mimeType = 'application/vnd.google-apps.document';
  }

  const boundary = 'foo_bar_baz';
  const requestBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Transfer-Encoding: base64\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n` +
    `${base64Data}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary="${boundary}"` },
      body: requestBody,
    }
  );
  await checkDriveResponse(res, `uploading file "${filename}"`);
  return res.json();
}

export async function createGoogleDocFromText(filename: string, text: string, folderId: string) {
  const token = await ensureValidGoogleToken();
  const metadata = { name: filename, mimeType: 'application/vnd.google-apps.document', parents: [folderId] };
  const boundary = 'foo_bar_baz';
  const requestBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/plain\r\n\r\n` +
    `${text}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary="${boundary}"` },
      body: requestBody,
    }
  );
  await checkDriveResponse(res, `creating Google Doc "${filename}"`);
  return res.json();
}

export async function uploadToDrive(filename: string, content: string, folderId: string, mimeType = 'text/plain') {
  const token = await ensureValidGoogleToken();
  const metadata = { name: filename, mimeType: 'application/vnd.google-apps.document', parents: [folderId] };
  const boundary = 'foo_bar_baz';
  const requestBody =
    `--${boundary}\n` +
    `Content-Type: application/json; charset=UTF-8\n\n` +
    `${JSON.stringify(metadata)}\n` +
    `--${boundary}\n` +
    `Content-Type: ${mimeType}\n\n` +
    `${content}\n` +
    `--${boundary}--`;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary="${boundary}"` },
      body: requestBody,
    }
  );
  await checkDriveResponse(res, `uploading "${filename}"`);
  return res.json();
}

export async function getFileContent(fileId: string) {
  const token = await ensureValidGoogleToken();
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  await checkDriveResponse(res, 'fetching file content');
  return res.text();
}

export async function updateFileContent(fileId: string, content: string) {
  const token = await ensureValidGoogleToken();
  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
      body: content,
    }
  );
  await checkDriveResponse(res, 'updating file content');
  return res.json();
}
// Folder registry helpers

export function getFolderIdForView(view: string): string | null {
  const folderMap: Record<string, string | null> = {
    LEAD: localStorage.getItem('lead_folder_id'),
    PROCESS: localStorage.getItem('process_folder_id'),
    DOCUMENTS: localStorage.getItem('documents_folder_id'),
  };

  return folderMap[view] ?? null;
}

// Sharing helpers

export async function shareFolderWithEmail(
  folderId: string,
  email: string,
  role: 'reader' | 'writer' = 'writer'
) {
  const token = await ensureValidGoogleToken();

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}/permissions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'user',
        role,
        emailAddress: email,
      }),
    }
  );

  await checkDriveResponse(
    res,
    `sharing folder with ${email}`
  );

  return res.json();
}

export async function revokeFolderAccessForEmail(
  folderId: string,
  email: string
) {
  const token = await ensureValidGoogleToken();

  const permsRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}/permissions?fields=permissions(id,emailAddress)`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  await checkDriveResponse(
    permsRes,
    'loading permissions'
  );

  const data = await permsRes.json();

  const permission = data.permissions?.find(
    (p: any) => p.emailAddress === email
  );

  if (!permission) {
    return false;
  }

  const deleteRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}/permissions/${permission.id}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  await checkDriveResponse(
    deleteRes,
    `revoking access for ${email}`
  );

  return true;
}

export async function listFilesInFolder(folderId: string): Promise<Array<{id: string, name: string, mimeType: string}>> {
  const token = await ensureValidGoogleToken();
  const query = `'${folderId}' in parents and trashed=false`;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType)&orderBy=createdTime desc&pageSize=100`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  await checkDriveResponse(res, 'listing files in folder');
  const data = await res.json();
  return data.files || [];
}
