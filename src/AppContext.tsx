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
  listSharedFolders,
  getFolderPermissions,
  readTeamProfilesFromDrive,
  findOrCreateFolder,
  createGoogleDocFromText,
  syncFolderStructure,
  syncProcessLeadFolder,
  updateTeamProfileInDrive,
} from './lib/googleDrive';
import { TEAM_MEMBERS as DEFAULT_TEAM_MEMBERS } from './data/mockData';
import { checkForNewReplies } from './lib/gmail';

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
  const [customCardsProcess, setCustomCardsProcess] = useState<Record<string, any[]>>(() => {
    try {
      const saved = localStorage.getItem('custom_cards_process');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('custom_cards_process', JSON.stringify(customCardsProcess));
  }, [customCardsProcess]);

  const [customCardsLead, setCustomCardsLead] = useState<Record<string, any[]>>(() => {
    try {
      const saved = localStorage.getItem('custom_cards_lead');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('custom_cards_lead', JSON.stringify(customCardsLead));
  }, [customCardsLead]);

  const [onboardingCards, setOnboardingCards] = useState<Record<string, any[]>>(() => {
    try {
      const saved = localStorage.getItem('onboarding_cards');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('onboarding_cards', JSON.stringify(onboardingCards));
  }, [onboardingCards]);
  const [folderAccess, setFolderAccess] = useState<Record<string, Record<string, string[]>>>({
    'Process': {},
    'Lead': {}
  });
  const [processLeads, setProcessLeads] = useState<Record<string, string[]>>({});
  const [leadSourceDocs, setLeadSourceDocs] = useState<Record<string, any[]>>({});
  const [processSourceDocs, setProcessSourceDocs] = useState<Record<string, any[]>>({});
  const [documentStates, setDocumentStates] = useState<Record<string, { content: string, history: any[] }>>({});

  // Shared folder states
  const [sharedLeadFolders, setSharedLeadFolders] = useState<string[]>([]);
  const [sharedProcessFolders, setSharedProcessFolders] = useState<string[]>([]);
  const [sharedLeadSourceDocs, setSharedLeadSourceDocs] = useState<Record<string, any[]>>({});
  const [sharedProcessSourceDocs, setSharedProcessSourceDocs] = useState<Record<string, any[]>>({});
  const [sharedFoldersMap, setSharedFoldersMap] = useState<Record<string, string>>({});

  const [googleToken, setGoogleToken] = useState<string | null>(localStorage.getItem('google_provider_token'));
  const [notification, setNotification] = useState<Notification | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isStateLoadedFromSupabase, setIsStateLoadedFromSupabase] = useState(false);

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

      // 1. Sync Shared folders
      try {
        const sharedFolders = await listSharedFolders();
        const nextSharedLeadFolders: string[] = [];
        const nextSharedProcessFolders: string[] = [];
        const nextSharedFoldersMap: Record<string, string> = {};

        for (const folder of sharedFolders) {
          if (folder.name === 'PROCESS' || folder.name === 'LEAD') continue;
          nextSharedFoldersMap[folder.name] = folder.id;
          
          const isProcess = initialProcessFolders.includes(folder.name);
          if (isProcess) {
            if (!nextSharedProcessFolders.includes(folder.name)) {
              nextSharedProcessFolders.push(folder.name);
            }
          } else {
            if (!nextSharedLeadFolders.includes(folder.name)) {
              nextSharedLeadFolders.push(folder.name);
            }
          }

          // Fetch documents inside the shared folder
          try {
            const files = await listFilesInFolder(folder.id);
            const docFiles = files.map((f) => ({
              name: f.name,
              url: f.mimeType === 'application/vnd.google-apps.document'
                ? `https://docs.google.com/document/d/${f.id}/edit`
                : `https://drive.google.com/file/d/${f.id}/view`,
              googleDocId: f.mimeType === 'application/vnd.google-apps.document' ? f.id : null,
              lead: isProcess ? null : folder.name,
            }));

            if (isProcess) {
              setSharedProcessSourceDocs((prev) => ({ ...prev, [folder.name]: docFiles }));
            } else {
              setSharedLeadSourceDocs((prev) => ({ ...prev, [folder.name]: docFiles }));
            }
          } catch (e) {
            console.error(`[Drive sync] Failed to list files for shared folder "${folder.name}":`, e);
          }
        }

        setSharedLeadFolders(nextSharedLeadFolders);
        setSharedProcessFolders(nextSharedProcessFolders);
        setSharedFoldersMap(nextSharedFoldersMap);
      } catch (err) {
        console.error('[Drive sync] Shared folders sync failed:', err);
      }

      // 2. Sync Teammates profiles & permissions
      if (processRootId) {
        try {
          const perms = await getFolderPermissions(processRootId);
          
          const emails = perms.map((p) => p.email.toLowerCase());
          teamMembers.forEach((m: any) => {
            if (m.email) {
              const e = m.email.toLowerCase();
              if (!emails.includes(e)) {
                emails.push(e);
              }
            }
          });
          const profiles: Record<string, { name: string; avatarId: number | null }> = {};
          
          try {
            if (emails.length > 0) {
              const { data: dbProfiles } = await supabase
                .from('profiles')
                .select('email, full_name, avatar_id')
                .in('email', emails);
              if (dbProfiles) {
                dbProfiles.forEach((p) => {
                  profiles[p.email.toLowerCase()] = {
                    name: p.full_name,
                    avatarId: p.avatar_id
                  };
                });
              }
            }
          } catch (dbErr) {
            console.error('Failed to load profiles from Supabase:', dbErr);
          }

          try {
            const driveProfiles = await readTeamProfilesFromDrive();
            Object.entries(driveProfiles).forEach(([email, p]) => {
              if (!profiles[email.toLowerCase()]) {
                profiles[email.toLowerCase()] = {
                  name: p.name,
                  avatarId: p.avatarId
                };
              }
            });
          } catch (driveErr) {
            console.error('Failed to load profiles from Drive:', driveErr);
          }
          
          setTeamMembers((prev: any[]) => {
            const membersMap = new Map<string, any>();
            prev.forEach((m) => {
              if (m.email) {
                membersMap.set(m.email.toLowerCase(), m);
              }
            });

            const currentUserEmail = session?.user?.email || localStorage.getItem('user_email') || '';

            perms.forEach((p) => {
              const emailLower = p.email.toLowerCase();
              if (emailLower === currentUserEmail.toLowerCase()) return;

              if (!membersMap.has(emailLower)) {
                membersMap.set(emailLower, {
                  id: `TM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  name: p.name,
                  email: p.email,
                  role: 'Collaborator',
                  avatar: p.avatar,
                });
              }
            });

            const updatedMembers = Array.from(membersMap.values()).map((m) => {
              if (m.email) {
                const profile = profiles[m.email.toLowerCase()];
                if (profile) {
                  return {
                    ...m,
                    name: profile.name || m.name,
                    avatar: profile.avatarId != null ? `/${profile.avatarId + 1}.png` : m.avatar,
                  };
                }
              }
              return m;
            });

            return updatedMembers;
          });
        } catch (e) {
          console.error('[Drive sync] Failed to sync teammates:', e);
        }
      }
    } catch (e) {
      console.error('[Drive sync] Full sync failed:', e);
    } finally {
      setIsSyncing(false);
    }
  }, [session]);

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

  const removeTeamMember = (id: string) => {
    setTeamMembers((prev: any[]) => prev.filter((m) => m.id !== id));
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

  // --- Lead Emails Mapping ---
  const [leadEmails, setLeadEmails] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('lead_emails');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('lead_emails', JSON.stringify(leadEmails));
  }, [leadEmails]);

  const setLeadEmail = (leadName: string, email: string) => {
    setLeadEmails((prev) => ({
      ...prev,
      [leadName]: email,
    }));
  };

  // --- Gmail Thread Cache (threadId -> messages[]) ---
  const [threadMessages, setThreadMessages] = useState<Record<string, any[]>>(() => {
    try {
      const saved = localStorage.getItem('thread_messages');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('thread_messages', JSON.stringify(threadMessages));
  }, [threadMessages]);

  const [isSyncingEmails, setIsSyncingEmails] = useState(false);

  const syncEmailReplies = useCallback(async () => {
    const token = localStorage.getItem('google_provider_token');
    if (!token) return;

    setIsSyncingEmails(true);
    try {
      const allThreads: any[] = [];
      Object.keys(proposalThreads).forEach((lead) => {
        allThreads.push(...(proposalThreads[lead] || []));
      });

      if (allThreads.length === 0) return;

      const threadMessagesMap = await checkForNewReplies(allThreads);

      setThreadMessages((prev) => {
        const next = { ...prev };
        Object.keys(threadMessagesMap).forEach((tid) => {
          next[tid] = threadMessagesMap[tid];
        });
        return next;
      });

      setCustomCardsProcess((prev) => {
        const next = { ...prev };
        let updated = false;

        Object.keys(proposalThreads).forEach((lead) => {
          const leadThreads = proposalThreads[lead] || [];
          leadThreads.forEach((t: any) => {
            const messages = threadMessagesMap[t.threadId];
            if (!messages) return;

            const clientReplies = messages.filter((m: any) => !m.isFromMe);

            clientReplies.forEach((reply: any) => {
              const existingObjections = next["Objection Handling"] || [];
              const alreadyLogged = existingObjections.some(
                (c: any) => c.lead === lead && c.emailMessageId === reply.id
              );

              if (!alreadyLogged) {
                const title = `Reply: ${reply.subject || 'Gmail Objection'}`;
                const text = reply.snippet || reply.body || 'Client reply received via Gmail loop.';
                
                const newCard = {
                  title,
                  text,
                  lead,
                  emailMessageId: reply.id,
                  date: reply.date,
                  from: reply.from,
                  isEmailReply: true,
                };

                next["Objection Handling"] = [
                  ...(next["Objection Handling"] || []),
                  newCard
                ];
                updated = true;

                setNotification({
                  type: 'info',
                  title: 'New Client Reply Received',
                  message: `Lead "${lead}" replied: "${reply.snippet || 'Click to view'}"`,
                });

                // Auto-sync consolidated email interactions history to Input Context folders
                (async () => {
                  try {
                    const leadThreads = proposalThreads[lead] || [];
                    const msgs: any[] = [];
                    leadThreads.forEach((t: any) => {
                      const threadMsgs = threadMessagesMap[t.threadId] || [];
                      msgs.push(...threadMsgs);
                    });

                    if (msgs.length > 0) {
                      msgs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                      let synthText = `=== EMAIL INTERACTIONS HISTORY FOR ${lead.toUpperCase()} ===\n`;
                      synthText += `Generated on: ${new Date().toLocaleString()}\n`;
                      synthText += `Total Messages: ${msgs.length}\n\n`;

                      msgs.forEach((m, idx) => {
                        const sender = m.isFromMe ? "You (Sales Team)" : m.from;
                        synthText += `[Message #${idx + 1}] ---\n`;
                        synthText += `From: ${sender}\n`;
                        synthText += `Date: ${new Date(m.date).toLocaleString()}\n`;
                        synthText += `Subject: ${m.threadSubject || 'Re: Proposal'}\n`;
                        synthText += `Snippet: ${m.snippet || m.body || ''}\n`;
                        synthText += `--------------------------------------------------\n\n`;
                      });

                      const docName = `Email Interactions Context`;

                      const leadFolderId = await syncFolderStructure(lead, 'LEAD');
                      if (leadFolderId) {
                        const leadInputContextId = await findOrCreateFolder("Input Context", leadFolderId);
                        await createGoogleDocFromText(docName, synthText, leadInputContextId);
                      }

                      const discoveryFolderId = await syncProcessLeadFolder("Discovery", lead);
                      if (discoveryFolderId) {
                        const discoveryInputContextId = await findOrCreateFolder("Input Context", discoveryFolderId);
                        await createGoogleDocFromText(docName, synthText, discoveryInputContextId);
                      }

                      const closingFolderId = await syncProcessLeadFolder("Closing", lead);
                      if (closingFolderId) {
                        const closingInputContextId = await findOrCreateFolder("Input Context", closingFolderId);
                        await createGoogleDocFromText(docName, synthText, closingInputContextId);
                      }

                      const objectionFolderId = await syncProcessLeadFolder("Objection handling", lead);
                      if (objectionFolderId) {
                        const objectionInputContextId = await findOrCreateFolder("Input Context", objectionFolderId);
                        await createGoogleDocFromText(docName, synthText, objectionInputContextId);
                      }
                      console.log(`[Drive Sync] Automatically updated Input Context files for lead: ${lead}`);
                    }
                  } catch (err) {
                    console.error("Failed to execute background Drive interactions sync:", err);
                  }
                })();
              }
            });
          });
        });

        return updated ? next : prev;
      });
    } catch (e) {
      console.error('[Sync Emails] Error fetching replies:', e);
    } finally {
      setIsSyncingEmails(false);
    }
  }, [proposalThreads]);


  useEffect(() => {
    // Helper: sync profile from Supabase user metadata into local state + localStorage
    const syncProfile = (session: any) => {
      if (!session?.user) {
        setUserProfile(null);
        setOnboardingComplete(false);
        localStorage.removeItem('user_email');
        return;
      }
      if (session.user.email) {
        localStorage.setItem('user_email', session.user.email);
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

    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_OAUTH_SUCCESS' && event.data?.token) {
        localStorage.setItem('google_provider_token', event.data.token);
        recordGoogleTokenObtained();
        setGoogleToken(event.data.token);
        setNotification(null);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            setSession(session);
            syncProfile(session);
          }
        } catch (err) {
          console.error("Failed to sync session after OAuth popup success:", err);
        }
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

      // Auto-sync profile to Drive on login/connect if set
      if (userProfile?.full_name || userProfile?.avatar_id != null) {
        updateTeamProfileInDrive({
          name: userProfile.full_name || session?.user?.email?.split('@')[0] || 'Teammate',
          avatarId: userProfile.avatar_id
        }).catch((err) => {
          console.error('Failed to auto-sync profile to Drive on login:', err);
        });
      }
    }
  }, [googleToken, userProfile]);

  // --- Supabase State Synchronization Loader & Savers ---
  useEffect(() => {
    if (!session?.user?.id) {
      setIsStateLoadedFromSupabase(false);
      return;
    }

    const loadState = async () => {
      const userId = session.user.id;
      try {
        // 1. Load team members
        const { data: teamData } = await supabase.from('team_members').select('*').eq('user_id', userId);
        if (teamData && teamData.length > 0) {
          setTeamMembers(teamData);
        }

        // 2. Load custom cards
        const { data: cardsData } = await supabase.from('custom_cards').select('*').eq('user_id', userId);
        if (cardsData) {
          const procMap: Record<string, any[]> = {};
          const leadMap: Record<string, any[]> = {};
          cardsData.forEach(row => {
            if (row.type === 'process') {
              procMap[row.folder_name] = row.cards_json;
            } else {
              const leadKey = row.lead_name ? `${row.lead_name}-${row.folder_name}` : row.folder_name;
              leadMap[leadKey] = row.cards_json;
            }
          });
          if (Object.keys(procMap).length > 0) setCustomCardsProcess(procMap);
          if (Object.keys(leadMap).length > 0) setCustomCardsLead(leadMap);
        }

        // 3. Load onboarding cards
        const { data: onboardingData } = await supabase.from('onboarding_cards').select('*').eq('user_id', userId);
        if (onboardingData) {
          const onboardingMap: Record<string, any[]> = {};
          onboardingData.forEach(row => {
            onboardingMap[row.folder_name] = row.cards_json;
          });
          if (Object.keys(onboardingMap).length > 0) setOnboardingCards(onboardingMap);
        }

        // 4. Load folder access
        const { data: accessData } = await supabase.from('folder_access').select('*').eq('user_id', userId);
        if (accessData) {
          const accessMap: Record<string, Record<string, string[]>> = { 'Process': {}, 'Lead': {} };
          accessData.forEach(row => {
            if (row.view_type === 'Process' || row.view_type === 'Lead') {
              accessMap[row.view_type][row.folder_name] = row.member_emails;
            }
          });
          setFolderAccess(accessMap);
        }

        // 5. Load process leads
        const { data: leadsData } = await supabase.from('process_leads').select('*').eq('user_id', userId);
        if (leadsData) {
          const leadsMap: Record<string, string[]> = {};
          leadsData.forEach(row => {
            leadsMap[row.stage_name] = row.leads;
          });
          if (Object.keys(leadsMap).length > 0) setProcessLeads(leadsMap);
        }

        // 6. Load lead emails
        const { data: emailsData } = await supabase.from('lead_emails').select('*').eq('user_id', userId);
        if (emailsData) {
          const emailsMap: Record<string, string> = {};
          emailsData.forEach(row => {
            emailsMap[row.lead_name] = row.email;
          });
          if (Object.keys(emailsMap).length > 0) setLeadEmails(emailsMap);
        }

        // 7. Load proposal threads
        const { data: threadsData } = await supabase.from('proposal_threads').select('*').eq('user_id', userId);
        if (threadsData) {
          const threadsMap: Record<string, any[]> = {};
          threadsData.forEach(row => {
            threadsMap[row.lead_name] = [...(threadsMap[row.lead_name] || []), {
              threadId: row.thread_id,
              leadName: row.lead_name,
              to: row.recipient,
              subject: row.subject,
              sentAt: row.sent_at
            }];
          });
          if (Object.keys(threadsMap).length > 0) setProposalThreads(threadsMap);
        }
      } catch (err) {
        console.error('Failed to load state from Supabase:', err);
      } finally {
        setIsStateLoadedFromSupabase(true);
      }
    };

    loadState();
  }, [session]);

  // Saving: customCardsProcess & customCardsLead
  useEffect(() => {
    if (!isStateLoadedFromSupabase || !session?.user?.id) return;
    const userId = session.user.id;

    const saveCards = async () => {
      try {
        for (const [folderName, cards] of Object.entries(customCardsProcess)) {
          await supabase.from('custom_cards').upsert({
            user_id: userId,
            type: 'process',
            folder_name: folderName,
            lead_name: null,
            cards_json: cards,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,type,folder_name,lead_name' });
        }

        for (const [key, cards] of Object.entries(customCardsLead)) {
          const idx = key.indexOf('-');
          const leadName = idx !== -1 ? key.substring(0, idx) : null;
          const folderName = idx !== -1 ? key.substring(idx + 1) : key;
          await supabase.from('custom_cards').upsert({
            user_id: userId,
            type: 'lead',
            folder_name: folderName,
            lead_name: leadName,
            cards_json: cards,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,type,folder_name,lead_name' });
        }
      } catch (err) {
        console.error('Error saving custom cards to Supabase:', err);
      }
    };

    saveCards();
  }, [customCardsProcess, customCardsLead, isStateLoadedFromSupabase, session]);

  // Saving: onboardingCards
  useEffect(() => {
    if (!isStateLoadedFromSupabase || !session?.user?.id) return;
    const userId = session.user.id;

    const saveOnboarding = async () => {
      try {
        for (const [folderName, cards] of Object.entries(onboardingCards)) {
          await supabase.from('onboarding_cards').upsert({
            user_id: userId,
            folder_name: folderName,
            cards_json: cards,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,folder_name' });
        }
      } catch (err) {
        console.error('Error saving onboarding cards to Supabase:', err);
      }
    };
    saveOnboarding();
  }, [onboardingCards, isStateLoadedFromSupabase, session]);

  // Saving: teamMembers
  useEffect(() => {
    if (!isStateLoadedFromSupabase || !session?.user?.id) return;
    const userId = session.user.id;

    const saveTeam = async () => {
      try {
        await supabase.from('team_members').delete().eq('user_id', userId);
        if (teamMembers.length > 0) {
          await supabase.from('team_members').insert(
            teamMembers.map(m => ({
              user_id: userId,
              name: m.name,
              email: m.email,
              role: m.role || 'Collaborator',
              avatar: m.avatar
            }))
          );
        }
      } catch (err) {
        console.error('Error saving team members to Supabase:', err);
      }
    };
    saveTeam();
  }, [teamMembers, isStateLoadedFromSupabase, session]);

  // Saving: folderAccess
  useEffect(() => {
    if (!isStateLoadedFromSupabase || !session?.user?.id) return;
    const userId = session.user.id;

    const saveFolderAccess = async () => {
      try {
        for (const [viewType, folders] of Object.entries(folderAccess)) {
          for (const [folderName, members] of Object.entries(folders)) {
            await supabase.from('folder_access').upsert({
              user_id: userId,
              view_type: viewType,
              folder_name: folderName,
              member_emails: members,
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,view_type,folder_name' });
          }
        }
      } catch (err) {
        console.error('Error saving folder access to Supabase:', err);
      }
    };
    saveFolderAccess();
  }, [folderAccess, isStateLoadedFromSupabase, session]);

  // Saving: processLeads
  useEffect(() => {
    if (!isStateLoadedFromSupabase || !session?.user?.id) return;
    const userId = session.user.id;

    const saveProcessLeads = async () => {
      try {
        for (const [stageName, leads] of Object.entries(processLeads)) {
          await supabase.from('process_leads').upsert({
            user_id: userId,
            stage_name: stageName,
            leads: leads,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,stage_name' });
        }
      } catch (err) {
        console.error('Error saving process leads to Supabase:', err);
      }
    };
    saveProcessLeads();
  }, [processLeads, isStateLoadedFromSupabase, session]);

  // Saving: leadEmails
  useEffect(() => {
    if (!isStateLoadedFromSupabase || !session?.user?.id) return;
    const userId = session.user.id;

    const saveLeadEmails = async () => {
      try {
        for (const [leadName, email] of Object.entries(leadEmails)) {
          await supabase.from('lead_emails').upsert({
            user_id: userId,
            lead_name: leadName,
            email: email,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,lead_name' });
        }
      } catch (err) {
        console.error('Error saving lead emails to Supabase:', err);
      }
    };
    saveLeadEmails();
  }, [leadEmails, isStateLoadedFromSupabase, session]);

  // Saving: proposalThreads
  useEffect(() => {
    if (!isStateLoadedFromSupabase || !session?.user?.id) return;
    const userId = session.user.id;

    const saveProposalThreads = async () => {
      try {
        for (const [leadName, threads] of Object.entries(proposalThreads)) {
          for (const t of (threads as any[])) {
            await supabase.from('proposal_threads').upsert({
              user_id: userId,
              lead_name: leadName,
              thread_id: t.threadId,
              recipient: t.to,
              subject: t.subject,
              sent_at: t.sentAt || new Date().toISOString()
            }, { onConflict: 'user_id,thread_id' });
          }
        }
      } catch (err) {
        console.error('Error saving proposal threads to Supabase:', err);
      }
    };
    saveProposalThreads();
  }, [proposalThreads, isStateLoadedFromSupabase, session]);

  useEffect(() => {
    if (googleToken) {
      syncEmailReplies();
      const interval = setInterval(() => {
        syncEmailReplies();
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [googleToken, syncEmailReplies]);

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
      teamMembers, setTeamMembers, inviteTeamMember, removeTeamMember,
      proposalThreads, setProposalThreads, addProposalThread,
      syncDriveToState,
      isSyncing,
      onboardingComplete, setOnboardingComplete,
      userProfile, setUserProfile,
      sharedLeadFolders, setSharedLeadFolders,
      sharedProcessFolders, setSharedProcessFolders,
      sharedLeadSourceDocs, setSharedLeadSourceDocs,
      sharedProcessSourceDocs, setSharedProcessSourceDocs,
      sharedFoldersMap, setSharedFoldersMap,
      leadEmails, setLeadEmail,
      threadMessages, syncEmailReplies, isSyncingEmails,
      onboardingCards, setOnboardingCards,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
