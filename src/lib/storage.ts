/**
 * Storage abstraction layer.
 *
 * All cloud storage providers (Google Drive, SharePoint, AWS S3, etc.)
 * implement the StorageProvider interface. The app talks only to this
 * interface, so swapping or adding providers requires no changes to
 * DocumentEditor or any page component.
 *
 * Current providers:  GoogleDriveProvider
 * Planned providers:  SharePointProvider, S3Provider
 */

// ─── Core interface ────────────────────────────────────────────────────────────

export interface RemoteDoc {
  /** Provider-specific file/document ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** URL to open the document on the provider's own web UI (optional) */
  webUrl?: string;
  /** Provider that owns this doc */
  provider: ProviderType;
}

export type ProviderType = 'google_drive' | 'sharepoint' | 'aws_s3';

export type SyncStatus =
  | 'idle'
  | 'loading'
  | 'saving'
  | 'synced'
  | 'error'
  | 'not_connected';

export interface StorageProvider {
  readonly type: ProviderType;
  readonly label: string;          // e.g. "Google Drive"
  readonly icon: string;           // emoji or short string for UI

  /** Returns true if credentials / tokens are available right now */
  isConnected(): boolean;

  /**
   * Create a new text document in the given folder.
   * Returns the RemoteDoc descriptor (including its new id).
   */
  createDoc(name: string, content: string, folderId: string): Promise<RemoteDoc>;

  /** Read the plain-text content of an existing document */
  readDoc(docId: string): Promise<string>;

  /** Overwrite the content of an existing document */
  updateDoc(docId: string, content: string): Promise<void>;

  /**
   * Find-or-create a folder hierarchy.
   * For Google Drive this is findOrCreateFolder.
   * For SharePoint this would be a drive item folder.
   * For S3 this is a key prefix.
   */
  ensureFolder(name: string, parentId?: string): Promise<string>;
}

// ─── Google Drive implementation ───────────────────────────────────────────────

import {
  ensureValidGoogleToken,
  checkDriveResponse,
  findOrCreateFolder,
} from './googleDrive';

export class GoogleDriveProvider implements StorageProvider {
  readonly type: ProviderType = 'google_drive';
  readonly label = 'Google Drive';
  readonly icon = '📄';

  isConnected(): boolean {
    return !!localStorage.getItem('google_provider_token');
  }

  async ensureFolder(name: string, parentId?: string): Promise<string> {
    return findOrCreateFolder(name, parentId);
  }

  async createDoc(name: string, content: string, folderId: string): Promise<RemoteDoc> {
    const token = await ensureValidGoogleToken();

    const metadata = {
      name,
      mimeType: 'application/vnd.google-apps.document',
      parents: [folderId],
    };

    const boundary = 'storage_boundary_001';
    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: text/plain\r\n\r\n` +
      `${content}\r\n` +
      `--${boundary}--`;

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary="${boundary}"`,
        },
        body,
      }
    );
    await checkDriveResponse(res, `creating Google Doc "${name}"`);
    const data = await res.json();

    return {
      id: data.id,
      name: data.name,
      webUrl: data.webViewLink,
      provider: 'google_drive',
    };
  }

  async readDoc(docId: string): Promise<string> {
    const token = await ensureValidGoogleToken();

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${docId}/export?mimeType=text/plain`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    await checkDriveResponse(res, 'reading Google Doc');
    return res.text();
  }

  async updateDoc(docId: string, content: string): Promise<void> {
    const token = await ensureValidGoogleToken();

    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${docId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'text/plain',
        },
        body: content,
      }
    );
    await checkDriveResponse(res, 'updating Google Doc');
  }
}

// ─── SharePoint stub (wire up when ready) ──────────────────────────────────────

export class SharePointProvider implements StorageProvider {
  readonly type: ProviderType = 'sharepoint';
  readonly label = 'SharePoint';
  readonly icon = '🔷';

  isConnected(): boolean {
    return !!localStorage.getItem('sharepoint_access_token');
  }

  async ensureFolder(name: string, _parentId?: string): Promise<string> {
    throw new Error('SharePoint provider not yet implemented');
  }

  async createDoc(name: string, _content: string, _folderId: string): Promise<RemoteDoc> {
    throw new Error('SharePoint provider not yet implemented');
  }

  async readDoc(_docId: string): Promise<string> {
    throw new Error('SharePoint provider not yet implemented');
  }

  async updateDoc(_docId: string, _content: string): Promise<void> {
    throw new Error('SharePoint provider not yet implemented');
  }
}

// ─── AWS S3 stub (wire up when ready) ─────────────────────────────────────────

export class S3Provider implements StorageProvider {
  readonly type: ProviderType = 'aws_s3';
  readonly label = 'AWS S3';
  readonly icon = '🟠';

  isConnected(): boolean {
    return !!localStorage.getItem('aws_access_key_id');
  }

  async ensureFolder(name: string, _parentId?: string): Promise<string> {
    // S3 uses key prefixes, not real folders
    return name;
  }

  async createDoc(name: string, _content: string, _folderId: string): Promise<RemoteDoc> {
    throw new Error('AWS S3 provider not yet implemented');
  }

  async readDoc(_docId: string): Promise<string> {
    throw new Error('AWS S3 provider not yet implemented');
  }

  async updateDoc(_docId: string, _content: string): Promise<void> {
    throw new Error('AWS S3 provider not yet implemented');
  }
}

// ─── Registry — add new providers here ────────────────────────────────────────

export const storageProviders: StorageProvider[] = [
  new GoogleDriveProvider(),
  new SharePointProvider(),
  new S3Provider(),
];

/**
 * Returns the first connected provider, or the Google Drive provider
 * as the default fallback (even if disconnected — the editor will
 * show the appropriate reconnect prompt).
 */
export function getActiveProvider(): StorageProvider {
  const connected = storageProviders.find((p) => p.isConnected());
  return connected ?? storageProviders[0];
}

export function getProviderByType(type: ProviderType): StorageProvider {
  return storageProviders.find((p) => p.type === type) ?? storageProviders[0];
}
