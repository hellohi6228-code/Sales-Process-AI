import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './lib/SupabaseClient';
import { Session } from '@supabase/supabase-js';
import { initializeDefaultProcessFolders } from './lib/googleDrive';

const initialProcessFolders = [
  'Positioning', 'Audience', 'Qualifying', 'Discovery', 'Solution Design',
  'Business Case', 'Proposal', 'Closing', 'Objection Handling', 'Onboarding', 'Referral'
];
const initialLeadFolders: string[] = [];

export const AppContext = createContext<any>(null);

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.provider_token) {
        localStorage.setItem('google_provider_token', session.provider_token);
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
        setGoogleToken(session.provider_token);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (googleToken) {
      initializeDefaultProcessFolders(initialProcessFolders).catch(e => console.error("Failed to initialize Google Drive folders:", e));
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
      documentStates, setDocumentStates
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
