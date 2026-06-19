import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './lib/SupabaseClient';
import { Session } from '@supabase/supabase-js';
import { initializeDefaultProcessFolders, recordGoogleTokenObtained, GoogleDriveError } from './lib/googleDrive';

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.provider_token) {
        localStorage.setItem('google_provider_token', session.provider_token);
        recordGoogleTokenObtained();
        setGoogleToken(session.provider_token);
      }
      setLoadingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.provider_token) {
        localStorage.setItem('google_provider_token', session.provider_token);
        recordGoogleTokenObtained();
        setGoogleToken(session.provider_token);
        setNotification(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (googleToken) {
      initializeDefaultProcessFolders(initialProcessFolders).catch((e) => {
        console.error("Failed to initialize Google Drive folders:", e);
        reportGoogleError(e, 'Failed to set up Google Drive folders');
      });
    }
  }, [googleToken]);

  useEffect(() => {
    if (window.opener && session) {
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
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}