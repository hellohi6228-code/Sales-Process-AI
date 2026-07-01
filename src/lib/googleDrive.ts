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

  let query = `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and description='SalesProcessAI Folder' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  } else {
    query += ` and 'me' in owners`;
  }

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
      description: 'SalesProcessAI Folder',
    }),
  });

  if (createRes.status === 404 && parentId) {
    console.warn(`Parent folder ${parentId} not found (404) during folder creation. Falling back to root.`);
    const fallbackRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [],
        description: 'SalesProcessAI Folder',
      }),
    });
    await checkDriveResponse(fallbackRes, 'creating folder fallback');
    const fallbackData = await fallbackRes.json();
    return fallbackData.id;
  }

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

export async function syncProcessLeadFolder(processName: string, leadName: string): Promise<string> {
  const processFolderId = await syncFolderStructure(processName, 'PROCESS');
  return findOrCreateFolder(leadName, processFolderId);
}

export async function initializeDefaultProcessFolders(folders: string[]) {
  const processRootId = await getRootAppFolder('PROCESS');
  for (const folder of folders) {
    await findOrCreateFolder(folder, processRootId);
  }
  // Create the LEAD root folder as well
  await getRootAppFolder('LEAD');
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

export async function getRawFileContent(fileId: string) {
  const token = await ensureValidGoogleToken();
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  await checkDriveResponse(res, 'fetching raw file content');
  return res.text();
}

export async function readAnyDriveFileText(fileId: string, mimeType: string): Promise<string> {
  try {
    if (mimeType === 'application/vnd.google-apps.document') {
      return await getFileContent(fileId);
    }
    if (mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType.includes('plain')) {
      return await getRawFileContent(fileId);
    }
  } catch (e) {
    console.error(`Failed to read file ${fileId} (${mimeType}):`, e);
  }
  return '';
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

export function getFolderIdForView(view: string): string | null {
  const folderMap: Record<string, string | null> = {
    LEAD: localStorage.getItem('lead_folder_id'),
    PROCESS: localStorage.getItem('process_folder_id'),
    DOCUMENTS: localStorage.getItem('documents_folder_id'),
  };
  return folderMap[view] ?? null;
}

export async function shareFolderWithEmail(
  folderId: string,
  email: string,
  role: 'reader' | 'writer' = 'writer'
) {
  const token = await ensureValidGoogleToken();

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}/permissions?sendNotificationEmail=false`,
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
  await checkDriveResponse(res, `sharing folder with ${email}`);
  return res.json();
}

export async function revokeFolderAccessForEmail(
  folderId: string,
  email: string
) {
  const token = await ensureValidGoogleToken();

  const permsRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}/permissions?fields=permissions(id,emailAddress)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  await checkDriveResponse(permsRes, 'loading permissions');

  const data = await permsRes.json();
  const permission = data.permissions?.find((p: any) => p.emailAddress === email);

  if (!permission) return false;

  const deleteRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}/permissions/${permission.id}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  await checkDriveResponse(deleteRes, `revoking access for ${email}`);
  return true;
}

export async function listFilesInFolder(folderId: string): Promise<Array<{ id: string; name: string; mimeType: string }>> {
  const token = await ensureValidGoogleToken();
  const query = `'${folderId}' in parents and trashed=false`;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType)&orderBy=createdTime%20desc&pageSize=100`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  await checkDriveResponse(res, 'listing files in folder');
  const data = await res.json();
  return data.files || [];
}

/**
 * Lists all folders directly under a root folder (LEAD or PROCESS).
 * Returns array of { id, name } for each sub-folder found.
 */
export async function listSubFolders(parentId: string): Promise<Array<{ id: string; name: string }>> {
  const token = await ensureValidGoogleToken();
  const query = `mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&orderBy=name&pageSize=200`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  await checkDriveResponse(res, 'listing sub-folders');
  const data = await res.json();
  return data.files || [];
}

/**
 * Finds a root-level folder by name WITHOUT creating it.
 * Returns the folder id or null if not found.
 */
export async function findFolder(name: string, parentId?: string): Promise<string | null> {
  const token = await ensureValidGoogleToken();
  let query = `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  } else {
    query += ` and 'me' in owners`;
  }

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  await checkDriveResponse(res, 'finding folder');
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

/**
 * Lists files in a folder, including all sub-folder files recursively (one level deep).
 * Used for scanning a process folder like "Proposal" that may have docs in it.
 */
export async function listFilesInFolderRecursive(folderId: string): Promise<Array<{ id: string; name: string; mimeType: string; parentId: string }>> {
  const token = await ensureValidGoogleToken();
  // First get direct files
  const query = `'${folderId}' in parents and trashed=false`;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType)&orderBy=createdTime%20desc&pageSize=200`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  await checkDriveResponse(res, 'listing files recursive');
  const data = await res.json();
  return (data.files || []).map((f: any) => ({ ...f, parentId: folderId }));
}

export async function listSharedFolders(): Promise<Array<{ id: string; name: string }>> {
  try {
    const token = await ensureValidGoogleToken();
    // 1. Get folders shared with me directly
    const query = `mimeType='application/vnd.google-apps.folder' and sharedWithMe=true and trashed=false`;
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,description)&pageSize=100`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    await checkDriveResponse(res, 'listing shared folders');
    const data = await res.json();
    const files = data.files || [];

    const initialProcessFolders = [
      'Positioning', 'Audience', 'Qualifying', 'Discovery', 'Solution design',
      'Business case', 'Proposal', 'Closing', 'Objection handling', 'Onboarding', 'Referral'
    ];
    const appFolderNames = ['PROCESS', 'LEAD', ...initialProcessFolders];

    const directFolders = files.filter((f: any) => {
      return appFolderNames.includes(f.name) || f.description === 'SalesProcessAI Folder';
    });
    
    const allFolders: Array<{ id: string; name: string }> = [...directFolders];
    
    // 2. For each shared folder, if it is named "PROCESS" or "LEAD", also fetch its subfolders
    for (const folder of directFolders) {
      if (folder.name === 'PROCESS' || folder.name === 'LEAD') {
        try {
          const subquery = `mimeType='application/vnd.google-apps.folder' and '${folder.id}' in parents and trashed=false`;
          const subres = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(subquery)}&fields=files(id,name,description)&pageSize=100`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (subres.ok) {
            const subdata = await subres.json();
            if (subdata.files) {
              const validSubs = subdata.files.filter((sf: any) => 
                initialProcessFolders.includes(sf.name) || sf.description === 'SalesProcessAI Folder'
              );
              allFolders.push(...validSubs);
            }
          }
        } catch (e) {
          console.error(`Failed to list subfolders of shared root folder "${folder.name}":`, e);
        }
      }
    }
    
    return allFolders;
  } catch (e) {
    console.error('Failed to list shared folders:', e);
    return [];
  }
}

export async function getFolderPermissions(folderId: string): Promise<Array<{ email: string; name: string; avatar: string }>> {
  try {
    const token = await ensureValidGoogleToken();
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}/permissions?fields=permissions(id,emailAddress,displayName,photoLink)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    await checkDriveResponse(res, 'loading folder permissions');
    const data = await res.json();
    return (data.permissions || [])
      .filter((p: any) => p.emailAddress)
      .map((p: any) => ({
        email: p.emailAddress,
        name: p.displayName || p.emailAddress.split('@')[0],
        avatar: p.photoLink || `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(p.emailAddress)}&backgroundColor=transparent`
      }));
  } catch (e) {
    console.error('Failed to get folder permissions:', e);
    return [];
  }
}

export async function updateTeamProfileInDrive(profile: { name: string, avatarId: number | null }) {
  try {
    const token = await getGoogleToken();
    if (!token) return;

    // 1. Update in our own PROCESS root folder
    const ownProcessRootId = await getRootAppFolder('PROCESS');
    await updateSingleProfileInFolder(ownProcessRootId, profile);

    // 2. Also find any shared PROCESS root folders, and write to them as well!
    const shared = await listSharedFolders();
    for (const folder of shared) {
      if (folder.name === 'PROCESS') {
        try {
          await updateSingleProfileInFolder(folder.id, profile);
        } catch (err) {
          console.error(`Failed to update profile in shared PROCESS folder ${folder.id}:`, err);
        }
      }
    }
  } catch (e) {
    console.error('Failed to update team profile in Drive:', e);
  }
}

async function updateSingleProfileInFolder(folderId: string, profile: { name: string, avatarId: number | null }) {
  const files = await listFilesInFolder(folderId);
  let profileFile = files.find(f => f.name === 'team_profiles.json');

  let profiles: Record<string, any> = {};
  if (profileFile) {
    try {
      const text = await getFileContent(profileFile.id);
      profiles = JSON.parse(text);
    } catch (e) {
      console.error('Failed to parse existing team profiles:', e);
    }
  }

  const email = localStorage.getItem('user_email') || '';
  if (!email) return;

  profiles[email.toLowerCase()] = {
    name: profile.name,
    avatarId: profile.avatarId,
    updatedAt: Date.now()
  };

  const content = JSON.stringify(profiles, null, 2);
  if (profileFile) {
    await updateFileContent(profileFile.id, content);
  } else {
    await uploadToDrive('team_profiles.json', content, folderId, 'application/json');
  }
}

export async function readTeamProfilesFromDrive(): Promise<Record<string, { name: string, avatarId: number | null }>> {
  try {
    const token = await getGoogleToken();
    if (!token) return {};

    const processRootId = await getRootAppFolder('PROCESS');
    const files = await listFilesInFolder(processRootId);
    const profileFile = files.find(f => f.name === 'team_profiles.json');

    if (profileFile) {
      const text = await getFileContent(profileFile.id);
      return JSON.parse(text);
    }
  } catch (e) {
    console.error('Failed to read team profiles from Drive:', e);
  }
  return {};
}
