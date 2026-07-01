import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, Cloud, CloudOff, Loader2, CheckCircle2, AlertTriangle, RefreshCw, Mail } from "lucide-react";
import { useAppContext } from "../AppContext";
import { getActiveProvider, getProviderByType, SyncStatus, ProviderType } from "../lib/storage";
import { GoogleDriveError } from "../lib/googleDrive";
import { sendProposalEmail } from "../lib/gmail";
import { Modal } from "./ui/Modal";

// ─── Types ─────────────────────────────────────────────────────────────────────



interface DocumentEditorProps {
  key?: any;
  doc: any;
  onClose: () => void;
  /** Called when this doc is first created/linked to a remote ID */
  onRemoteIdCreated?: (remoteId: string, provider: ProviderType, webUrl?: string) => void;
  /** Folder ID on the storage provider to create the doc in (if it doesn't exist yet) */
  remoteFolderId?: string;
}

// ─── Sync status badge ─────────────────────────────────────────────────────────

function SyncBadge({ status, providerLabel, onRetry }: {
  status: SyncStatus;
  providerLabel: string;
  onRetry?: () => void;
}) {
  const base = "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all";

  if (status === 'not_connected') return (
    <span className={`${base} bg-neutral-100 dark:bg-neutral-800 text-neutral-500`}>
      <CloudOff className="w-3.5 h-3.5" /> Not connected
    </span>
  );

  if (status === 'loading') return (
    <span className={`${base} bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400`}>
      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading from {providerLabel}…
    </span>
  );

  if (status === 'saving') return (
    <span className={`${base} bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400`}>
      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving to {providerLabel}…
    </span>
  );

  if (status === 'synced') return (
    <span className={`${base} bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400`}>
      <CheckCircle2 className="w-3.5 h-3.5" /> Synced to {providerLabel}
    </span>
  );

  if (status === 'error') return (
    <button
      onClick={onRetry}
      className={`${base} bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 cursor-pointer`}
    >
      <AlertTriangle className="w-3.5 h-3.5" /> Sync failed — retry
    </button>
  );

  // idle
  return (
    <span className={`${base} bg-neutral-100 dark:bg-neutral-800 text-neutral-400`}>
      <Cloud className="w-3.5 h-3.5" /> {providerLabel}
    </span>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function DocumentEditor({ doc, onClose, onRemoteIdCreated, remoteFolderId }: DocumentEditorProps) {
  const { documentStates, setDocumentStates, reportGoogleError, reconnectGoogle, leadEmails, addProposalThread, session } = useAppContext();

  // Determine which storage provider to use.
  // If the doc already has a known provider, use that; otherwise use the active one.
  const provider = doc.provider
    ? getProviderByType(doc.provider as ProviderType)
    : getActiveProvider();

  // ── State ──────────────────────────────────────────────────────────────────

  const docState = documentStates[doc.name];

  // For Google Docs, content is fetched from the cloud after mount.
  // For local base64 docs, decode immediately.
  const defaultContent = (() => {
    if (doc.url && doc.url.startsWith("data:text")) {
      try { return atob(doc.url.split(",")[1]); } catch { return ""; }
    }
    if (doc.googleDocId) return ""; // will be loaded from Drive
    return "";
  })();

  const [content, setContent] = useState<string>(() => docState?.content ?? defaultContent);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    provider.isConnected() ? 'idle' : 'not_connected'
  );
  // Remote ID might be pre-loaded from doc, or assigned after first save
  // remoteId drives cloud sync — prefer googleDocId (from context summary docs)
  const [remoteId, setRemoteId] = useState<string | null>(
    doc.googleDocId ?? doc.remoteId ?? null
  );

  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedContentRef = useRef<string>(content);

  // ── Load from cloud on mount if we have a remote ID ───────────────────────

  useEffect(() => {
    if (!remoteId || !provider.isConnected()) return;

    setSyncStatus('loading');
    provider.readDoc(remoteId)
      .then((remoteContent) => {
        // Only override local content if local is still the default (i.e. not edited)
        if (content === defaultContent) {
          setContent(remoteContent);
          lastSavedContentRef.current = remoteContent;
        }
        setSyncStatus('synced');
      })
      .catch((err) => {
        console.error("Failed to load from cloud:", err);
        setSyncStatus('error');
        reportGoogleError?.(err, `Failed to load "${doc.name}" from ${provider.label}`);
      });
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist state to context ───────────────────────────────────────────────

  useEffect(() => {
    setDocumentStates((prev: any) => ({
      ...prev,
      [doc.name]: { content },
    }));
  }, [content, doc.name, setDocumentStates]);

  // ── Auto-save to cloud (debounced 2 s after last keystroke) ───────────────

  const syncToCloud = useCallback(async (textToSave: string) => {
    if (!provider.isConnected()) {
      setSyncStatus('not_connected');
      return;
    }
    if (textToSave === lastSavedContentRef.current) return;

    setSyncStatus('saving');
    try {
      if (remoteId) {
        await provider.updateDoc(remoteId, textToSave);
      } else if (remoteFolderId) {
        // First save — create the doc on the provider
        const remote = await provider.createDoc(doc.name, textToSave, remoteFolderId);
        setRemoteId(remote.id);
        onRemoteIdCreated?.(remote.id, provider.type, remote.webUrl);
      }
      lastSavedContentRef.current = textToSave;
      setSyncStatus('synced');
    } catch (err) {
      console.error("Cloud sync failed:", err);
      setSyncStatus('error');
      if (err instanceof GoogleDriveError &&
        (err.code === 'GOOGLE_TOKEN_EXPIRED' || err.code === 'GOOGLE_NOT_CONNECTED')) {
        reportGoogleError?.(err, `Sync failed for "${doc.name}"`);
      }
    }
  }, [provider, remoteId, remoteFolderId, doc.name, onRemoteIdCreated, reportGoogleError]);

  const scheduleSync = useCallback((text: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => syncToCloud(text), 2000);
  }, [syncToCloud]);

  // Cleanup timer on unmount
  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); }, []);

  // ── Edit diff helper ───────────────────────────────────────────────────────

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    setSyncStatus('idle');
    scheduleSync(newContent);
  };

  const handleManualSave = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    syncToCloud(content);
  };

  const handleSendEmail = async () => {
    if (!emailTo) {
      alert("Please enter a recipient email address.");
      return;
    }
    setSendingEmail(true);
    try {
      const thread = await sendProposalEmail({
        to: emailTo,
        subject: emailSubject,
        bodyHtml: emailBody.replace(/\n/g, "<br>"),
        leadName: doc.lead || "General Lead",
      });
      
      if (addProposalThread && doc.lead) {
        addProposalThread(doc.lead, {
          threadId: thread.threadId,
          leadName: doc.lead,
          to: emailTo,
          subject: emailSubject,
          sentAt: new Date().toISOString(),
        });
      }
      
      alert("Proposal sent successfully via Gmail!");
      setIsSendModalOpen(false);
    } catch (err) {
      console.error("Failed to send proposal email:", err);
      alert("Failed to send proposal email. Please check your Google Drive/Gmail integration.");
    } finally {
      setSendingEmail(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const driveFileId = doc.id || doc.url?.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];
  const isPdf = doc.mimeType === 'application/pdf' || doc.url?.includes('application/pdf') || doc.name?.toLowerCase().endsWith('.pdf');
  const isImage = doc.mimeType?.startsWith('image/') || doc.url?.startsWith('data:image/') || doc.name?.toLowerCase().match(/\.(png|jpe?g|gif|webp)$/);

  return (
    <div className="flex-1 lg:flex-[3] flex flex-col w-full bg-white dark:bg-neutral-900 rounded-[24px] shadow-sm border border-neutral-200 dark:border-neutral-800 overflow-hidden relative min-h-[600px] lg:max-h-[800px] ml-0 xl:ml-6">

      {/* ── Editor panel ── */}
      <div className="flex-1 overflow-y-auto flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-4 border-b border-neutral-100 dark:border-neutral-800 gap-4 flex-wrap">
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 truncate flex-1">
            {doc.name}
          </h1>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Reconnect button if not connected */}
            {syncStatus === 'not_connected' && (
              <button
                onClick={reconnectGoogle}
                className="inline-flex items-center gap-1.5 text-xs font-bold bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-3 py-1.5 rounded-full hover:opacity-90 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Connect {provider.label}
              </button>
            )}

            {/* Send via Gmail if it is a proposal */}
            {doc.name?.startsWith("Proposal") && (
              <button
                onClick={() => {
                  const resolvedEmail = doc.lead && leadEmails ? leadEmails[doc.lead] || "" : "";
                  setEmailTo(resolvedEmail);
                  setEmailSubject(`Proposal: ${doc.name}`);
                  setEmailBody(content);
                  setIsSendModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold bg-neutral-900 hover:opacity-90 dark:bg-white text-white dark:text-neutral-900 px-3.5 py-1.5 rounded-full transition"
              >
                <Mail className="w-3.5 h-3.5" /> Send to Client
              </button>
            )}

            {/* Manual save */}
            {provider.isConnected() && syncStatus !== 'saving' && syncStatus !== 'loading' && !isPdf && !isImage && (
              <button
                onClick={handleManualSave}
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-full transition"
              >
                <Cloud className="w-3.5 h-3.5" /> Save now
              </button>
            )}

            {/* Open on provider (read-only external link) */}
            {remoteId && provider.type === 'google_drive' && (
              <a
                href={`https://docs.google.com/document/d/${remoteId}/view`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] uppercase font-bold text-sky-500 hover:underline"
              >
                View in Docs ↗
              </a>
            )}

            <button
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-neutral-600 transition bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-full shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Textarea or Preview */}
        <div className="flex-1 p-8">
          {isImage ? (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              {driveFileId ? (
                <iframe
                  src={`https://drive.google.com/file/d/${driveFileId}/preview`}
                  width="100%"
                  height="600px"
                  className="rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm"
                  allow="autoplay"
                />
              ) : (
                <img src={doc.url} alt={doc.name} className="max-w-full max-h-[600px] rounded-xl shadow-sm object-contain" />
              )}
            </div>
          ) : isPdf ? (
            <div className="h-full min-h-[500px]">
              {driveFileId ? (
                <iframe
                  src={`https://drive.google.com/file/d/${driveFileId}/preview`}
                  width="100%"
                  height="600px"
                  className="rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm"
                  allow="autoplay"
                />
              ) : (
                <embed src={doc.url} width="100%" height="600px" type="application/pdf" className="rounded-xl shadow-sm" />
              )}
            </div>
          ) : syncStatus === 'loading' ? (
            <div className="flex items-center justify-center h-full min-h-[300px] text-neutral-400 text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading document from Google Drive…
            </div>
          ) : (
            <textarea
              value={content}
              onChange={handleContentChange}
              className="w-full h-full min-h-[500px] bg-transparent font-serif text-lg leading-relaxed text-neutral-800 dark:text-neutral-200 outline-none focus:ring-2 focus:ring-sky-500/50 p-4 rounded-xl transition whitespace-pre-wrap resize-none"
              placeholder="Start typing… changes sync automatically to Google Drive."
            />
          )}
        </div>
      </div>

      {isSendModalOpen && (
        <Modal
          isOpen={isSendModalOpen}
          onClose={() => setIsSendModalOpen(false)}
          title="Send Proposal via Gmail"
          className="sm:max-w-2xl"
        >
          <div className="space-y-6 pt-2">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 dark:text-neutral-500 mb-2">
                  Recipient Email
                </label>
                <input
                  type="email"
                  className="w-full p-3 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-shadow text-neutral-800 dark:text-neutral-200"
                  placeholder="client@example.com"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 dark:text-neutral-500 mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  className="w-full p-3 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-shadow text-neutral-800 dark:text-neutral-200"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 dark:text-neutral-500 mb-2">
                  Message Body
                </label>
                <textarea
                  className="w-full h-48 p-3 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-shadow text-neutral-800 dark:text-neutral-200 font-sans leading-relaxed"
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                />
              </div>

              <button
                disabled={sendingEmail}
                onClick={handleSendEmail}
                className="w-full py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold rounded-xl text-sm transition-transform active:scale-95 shadow-sm hover:shadow disabled:opacity-50"
              >
                {sendingEmail ? 'Sending...' : 'Send Proposal'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
