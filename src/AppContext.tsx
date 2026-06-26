import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/SupabaseClient';
import { Session } from '@supabase/supabase-js';
import {
  initializeDefaultProcessFolders,
  recordGoogleTokenObtained,
  GoogleDriveError,
  findFolder,
  listSubFolders,
  listFilesInFolder,
} from './lib/googleDrive';
import { TEAM_MEMBERS as DEFAULT_TEAM_MEMBERS } from './data/mockData';

const initialProcessFolders = [
  'Positioning', 'Audience', 'Qualifying', 'Discovery', 'Solution Design',
  'Business Case', 'Proposal', 'Closing', 'Objection Handling', 'Onboarding', 'Referral'
];
const initialLeadFolders: string[] = [];

// Keep these in sync with SignUp.tsx / Login.tsx OAuth scopes.
const GOOGLE_OAUTH_SCOPES =
  'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify';

export const AppContext = createContext<any>(null);

export type Notification = {
  type: 'info' | 'warning' | 'error';
  title: string;
  message?: string;
  showReconnect?: boolean;
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // ── ONBOARDING STATE ──
  const [onboardingComplete, setOnboardingComplete] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<any>(null);


  const [processFolders, setProcessFolders] = useState<string[]>(initialProcessFolders);
  const [leadFolders, setLeadFolders] = useState<string[]>(initialLeadFolders);
  const [customCardsProcess, setCustomCardsProcess] = useState<Record<string, any[]>>({});
  const [customCardsLead, setCustomCardsLead] = useState<Record<string, any[]>>({});
  const [folderAccess, setFolderAccess] = useState<Record<string, Record<string, string[]>>>({
    'Process': {},
    'Lead': {}
  });
  const [processLeads, setProcessLeads] = useState<Record<string, string[]>>({});
  const [leadSourceDocs, setLeadSourceDocs] = useState<Record<string, any[]>>({});
  const [processSourceDocs, setProcessSourceDocs] = useState<Record<string, any[]>>({});
  const [documentStates, setDocumentStates] = useState<Record<string, { content: string, history: any[] }>>({});

  const [googleToken, setGoogleToken] = useState<string | null>(localStorage.getItem('google_provider_token'));
  const [notification, setNotification] = useState<Notification | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  /** Surfaces any caught Drive/Google error as a user-visible banner instead of only console.error. */
  const reportGoogleError = (error: unknown, fallbackTitle = 'Google Drive error') => {
    if (error instanceof GoogleDriveError) {
      if (error.code === 'GOOGLE_NOT_CONNECTED') {
        setNotification({
          type: 'warning',
          title: 'Not connected to Google',
          message: 'Connect your Google account to sync documents to Drive.',
          showReconnect: true,
        });
        return;
      }
      if (error.code === 'GOOGLE_TOKEN_EXPIRED') {
        setNotification({
          type: 'warning',
          title: 'Google session expired',
          message: 'Please reconnect your Google account to continue syncing.',
          showReconnect: true,
        });
        return;
      }
      setNotification({
        type: 'error',
        title: fallbackTitle,
        message: error.message,
      });
      return;
    }
    setNotification({
      type: 'error',
      title: fallbackTitle,
      message: error instanceof Error ? error.message : String(error),
    });
  };

  const reconnectGoogle = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          skipBrowserRedirect: true,
          scopes: GOOGLE_OAUTH_SCOPES,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });
      if (error) {
        setNotification({ type: 'error', title: 'Reconnect failed', message: error.message });
        return;
      }
      if (data?.url) {
        window.open(data.url, 'oauth_popup', 'width=600,height=700');
      }
    } catch (err: any) {
      setNotification({ type: 'error', title: 'Reconnect failed', message: err.message });
    }
  };

  /**
   * Scans Google Drive for existing LEAD and PROCESS folders/files
   * and populates React state. Called on login and can be triggered manually.
   */
  const syncDriveToState = useCallback(async () => {
    const token = localStorage.getItem('google_provider_token');
    if (!token) {
      reconnectGoogle();
      return;
    }
    setIsSyncing(true);
    try {
      // Sync LEAD folders
      const leadRootId = await findFolder('LEAD');
      if (leadRootId) {
        const leadSubFolders = await listSubFolders(leadRootId);
        if (leadSubFolders.length > 0) {
          const leadNames = leadSubFolders.map((f) => f.name);
          setLeadFolders((prev: string[]) => {
            const merged = [...prev];
            for (const name of leadNames) {
              if (!merged.includes(name)) merged.push(name);
            }
            return merged;
          });

          // Load docs for each lead folder
          for (const folder of leadSubFolders) {
            try {
              const files = await listFilesInFolder(folder.id);
              if (files.length === 0) continue;
              const docFiles = files.map((f) => ({
                name: f.name,
                url: f.mimeType === 'application/vnd.google-apps.document'
                  ? `https://docs.google.com/document/d/${f.id}/edit`
                  : `https://drive.google.com/file/d/${f.id}/view`,
                googleDocId: f.mimeType === 'application/vnd.google-apps.document' ? f.id : null,
              }));
              setLeadSourceDocs((prev: Record<string, any[]>) => {
                const existing = prev[folder.name] || [];
                const merged = [...existing];
                for (const doc of docFiles) {
                  if (!merged.find((d) => d.googleDocId && d.googleDocId === doc.googleDocId)) {
                    merged.push(doc);
                  }
                }
                return { ...prev, [folder.name]: merged };
              });
            } catch (e) {
              console.error(`[Drive sync] Failed to list files for lead "${folder.name}":`, e);
            }
          }
        }
      }

      // Sync PROCESS folders
      const processRootId = await findFolder('PROCESS');
      if (processRootId) {
        const processSubFolders = await listSubFolders(processRootId);
        // Load docs for each process sub-folder (e.g. Proposal, Discovery, etc.)
        for (const folder of processSubFolders) {
          try {
            const files = await listFilesInFolder(folder.id);
            if (files.length === 0) continue;
            const docFiles = files.map((f) => ({
              name: f.name,
              url: f.mimeType === 'application/vnd.google-apps.document'
                ? `https://docs.google.com/document/d/${f.id}/edit`
                : `https://drive.google.com/file/d/${f.id}/view`,
              googleDocId: f.mimeType === 'application/vnd.google-apps.document' ? f.id : null,
            }));
            setProcessSourceDocs((prev: Record<string, any[]>) => {
              const existing = prev[folder.name] || [];
              const merged = [...existing];
              for (const doc of docFiles) {
                if (!merged.find((d) => d.googleDocId && d.googleDocId === doc.googleDocId)) {
                  merged.push(doc);
                }
              }
              return { ...prev, [folder.name]: merged };
            });
          } catch (e) {
            console.error(`[Drive sync] Failed to list files for process "${folder.name}":`, e);
          }
        }
      }
    } catch (e) {
      console.error('[Drive sync] Full sync failed:', e);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // --- Team Pool (used by the Executive tab's drag-to-folder Drive sharing) ---
  const [teamMembers, setTeamMembers] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('team_members');
      return saved ? JSON.parse(saved) : DEFAULT_TEAM_MEMBERS;
    } catch {
      return DEFAULT_TEAM_MEMBERS;
    }
  });

  useEffect(() => {
    localStorage.setItem('team_members', JSON.stringify(teamMembers));
  }, [teamMembers]);

  const inviteTeamMember = (name: string, email: string, role = 'Invited') => {
    setTeamMembers((prev: any[]) => {
      if (prev.some(m => m.email?.toLowerCase() === email.toLowerCase())) return prev;
      return [...prev, {
        id: `TM-${Date.now()}`,
        name,
        email,
        role,
        avatar: `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(name)}&backgroundColor=transparent`,
      }];
    });
  };

  // --- Gmail proposal tracking (keyed by lead name) ---
  const [proposalThreads, setProposalThreads] = useState<Record<string, any[]>>(() => {
    try {
      const saved = localStorage.getItem('proposal_threads');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('proposal_threads', JSON.stringify(proposalThreads));
  }, [proposalThreads]);

  const addProposalThread = (leadName: string, thread: any) => {
    setProposalThreads((prev) => ({
      ...prev,
      [leadName]: [...(prev[leadName] || []), thread],
    }));
  };


  useEffect(() => {
    // Helper: sync profile from Supabase user metadata into local state + localStorage
    const syncProfile = (session: any) => {
      if (!session?.user) {
        setUserProfile(null);
        setOnboardingComplete(false);
        return;
      }
      const userId = session.user.id;
      const meta = session.user.user_metadata ?? {};
      // Merge with any existing localStorage data for this specific user
      let local: any = {};
      try { local = JSON.parse(localStorage.getItem(`user_profile_${userId}`) ?? '{}'); } catch {}
      const merged = { ...meta, ...local };
      // If Supabase says onboarding is complete, trust it (handles cross-device / re-login)
      if (meta.onboarding_complete === true) {
        merged.onboarding_complete = true;
      }
      localStorage.setItem(`user_profile_${userId}`, JSON.stringify(merged));
      // Clean up legacy key if it exists
      localStorage.removeItem('user_profile');
      setUserProfile(merged);
      setOnboardingComplete(merged.onboarding_complete === true);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      syncProfile(session);
      if (session?.provider_token) {
        localStorage.setItem('google_provider_token', session.provider_token);
        recordGoogleTokenObtained();
        setGoogleToken(session.provider_token);
      } else {
        const storedToken = localStorage.getItem('google_provider_token');
        if (storedToken) setGoogleToken(storedToken);
      }
      setLoadingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      syncProfile(session);
      if (session?.provider_token) {
        localStorage.setItem('google_provider_token', session.provider_token);
        recordGoogleTokenObtained();
        setGoogleToken(session.provider_token);
        setNotification(null);
      } else {
        const storedToken = localStorage.getItem('google_provider_token');
        if (storedToken) {
          setGoogleToken(storedToken);
          setNotification(null);
        }
      }
    });

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_OAUTH_SUCCESS' && event.data?.token) {
        localStorage.setItem('google_provider_token', event.data.token);
        recordGoogleTokenObtained();
        setGoogleToken(event.data.token);
        setNotification(null);
      }
    };
    window.addEventListener('message', handleMessage);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  useEffect(() => {
    if (googleToken) {
      // Initialize default process folder structure in Drive
      initializeDefaultProcessFolders(initialProcessFolders).catch((e) => {
        console.error('Failed to initialize Google Drive folders:', e);
        reportGoogleError(e, 'Failed to set up Google Drive folders');
      });
      // Sync all existing Drive files to app state
      syncDriveToState();
    }
  }, [googleToken]);

  useEffect(() => {
    if (window.opener && session) {
      const providerToken = session.provider_token || localStorage.getItem('google_provider_token');
      if (providerToken) {
        window.opener.postMessage({ type: 'GOOGLE_OAUTH_SUCCESS', token: providerToken }, '*');
      }
      window.close();
    }
  }, [session]);

  if (loadingSession) {
    return <div className="h-screen w-screen flex items-center justify-center dark:bg-[#09090b] dark:text-neutral-100">Loading...</div>;
  }

  return (
    <AppContext.Provider value={{
      session, setSession,
      processFolders, setProcessFolders,
      leadFolders, setLeadFolders,
      customCardsProcess, setCustomCardsProcess,
      customCardsLead, setCustomCardsLead,
      folderAccess, setFolderAccess,
      processLeads, setProcessLeads,
      leadSourceDocs, setLeadSourceDocs,
      processSourceDocs, setProcessSourceDocs,
      documentStates, setDocumentStates,
      notification, setNotification,
      reportGoogleError,
      reconnectGoogle,
      teamMembers, setTeamMembers, inviteTeamMember,
      proposalThreads, setProposalThreads, addProposalThread,
      syncDriveToState,
      isSyncing,
      onboardingComplete, setOnboardingComplete,
      userProfile, setUserProfile,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
