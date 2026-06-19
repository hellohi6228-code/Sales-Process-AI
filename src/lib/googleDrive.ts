export async function getGoogleToken() {
  return localStorage.getItem('google_provider_token');
}

export async function findOrCreateFolder(name: string, parentId?: string): Promise<string> {
  const token = await getGoogleToken();
  if (!token) throw new Error("No Google Token");

  let query = `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : []
    })
  });
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
  const token = await getGoogleToken();
  if (!token) return;
  // Create folders in sequence to avoid rate limits
  for (const folder of folders) {
     await findOrCreateFolder(folder, processRootId);
  }
}


export async function uploadBase64ToDrive(filename: string, base64Url: string, folderId: string) {
  const token = await getGoogleToken();
  if (!token) throw new Error("No Google Token");

  const match = base64Url.match(/^data:(.*?);base64,(.*)$/);
  if (!match) throw new Error("Invalid base64 Data URL");
  const mimeType = match[1];
  const base64Data = match[2];

  const metadata: any = {
    name: filename,
    parents: [folderId]
  };

  // Optionally convert text or word docs to Google Docs format
  if (mimeType.includes("text") || mimeType.includes("wordprocessing")) {
    metadata.mimeType = 'application/vnd.google-apps.document';
  }

  const boundary = 'foo_bar_baz';
  let requestBody = 
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Transfer-Encoding: base64\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n` +
    `${base64Data}\r\n` +
    `--${boundary}--`;

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary="${boundary}"`
    },
    body: requestBody
  });
  return res.json();
}

export async function createGoogleDocFromText(filename: string, text: string, folderId: string) {
  const token = await getGoogleToken();
  if (!token) throw new Error("No Google Token");

  const metadata = {
    name: filename,
    mimeType: 'application/vnd.google-apps.document',
    parents: [folderId]
  };

  const boundary = 'foo_bar_baz';
  let requestBody = 
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/plain\r\n\r\n` +
    `${text}\r\n` +
    `--${boundary}--`;

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary="${boundary}"`
    },
    body: requestBody
  });
  return res.json();
}

export async function uploadToDrive(filename: string, content: string, folderId: string, mimeType = 'text/plain') {
  const token = await getGoogleToken();
  if (!token) throw new Error("No Google Token");

  const metadata = {
    name: filename,
    mimeType: 'application/vnd.google-apps.document',
    parents: [folderId]
  };

  const boundary = 'foo_bar_baz';
  let requestBody = 
    `--${boundary}\n` +
    `Content-Type: application/json; charset=UTF-8\n\n` +
    `${JSON.stringify(metadata)}\n` +
    `--${boundary}\n` +
    `Content-Type: ${mimeType}\n\n` +
    `${content}\n` +
    `--${boundary}--`;

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary="${boundary}"`
    },
    body: requestBody
  });
  return res.json();
}

export async function getFileContent(fileId: string) {
    const token = await getGoogleToken();
    if (!token) throw new Error("No Google Token");
    // For Google Docs we export it to plain text
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return res.text();
}

export async function updateFileContent(fileId: string, content: string) {
    const token = await getGoogleToken();
    if (!token) throw new Error("No Google Token");
    
    // We update the content of the file. Using uploadType=media
    // Note: updating a Google Doc directly via upload/media works to replace its text content if provided as plain text or html.
    const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'text/plain'
        },
        body: content
    });
    return res.json();
}