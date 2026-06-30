import React, { useState } from "react";
import { supabase } from "../lib/SupabaseClient";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronLeft,
  FileText,
  CheckCircle2,
  Plus,
  FolderOpen,
  X,
  Pencil,
} from "lucide-react";
import { cn } from "../lib/utils";
import { Modal } from "../components/ui/Modal";
import { useAppContext } from "../AppContext";
import { DocumentEditor } from "../components/DocumentEditor";
import {
  FileUploadDropzone,
  FileData,
} from "../components/ui/FileUploadDropzone";

const CARDS_BY_PROCESS: Record<string, any[]> = {};

import { syncFolderStructure, uploadToDrive, uploadBase64ToDrive, createGoogleDocFromText, listFilesInFolder, syncProcessLeadFolder, findOrCreateFolder } from "../lib/googleDrive";
import { sendProposalEmail } from "../lib/gmail";

export function Marketing() {
  const {
    session,
    processFolders,
    setProcessFolders,
    customCardsProcess: customCards,
    setCustomCardsProcess: setCustomCards,
    customCardsLead,
    leadFolders,
    processLeads,
    setProcessLeads,
    processSourceDocs,
    setProcessSourceDocs,
    reportGoogleError,
    sharedProcessFolders,
    sharedProcessSourceDocs,
    setSharedProcessSourceDocs,
    sharedFoldersMap,
    sharedLeadFolders,
    leadEmails,
    setLeadEmail,
    proposalThreads,
    addProposalThread,
    threadMessages,
    syncEmailReplies,
    isSyncingEmails,
    onboardingCards,
  } = useAppContext();
  const [viewMode, setViewMode] = useState<'my' | 'shared'>('my');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [contextInput, setContextInput] = useState("");
  const [closingStatus, setClosingStatus] = useState("Signed");
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedActiveLead, setSelectedActiveLead] = useState<string | null>(
    null,
  );
  const [isLeadsExpanded, setIsLeadsExpanded] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<FileData[]>([]);
  const [editingDoc, setEditingDoc] = useState<any>(null);
  const [isSendProposalModalOpen, setIsSendProposalModalOpen] = useState(false);
  const [proposalStatus, setProposalStatus] = useState<string | null>(null);
  const [isClientActionModalOpen, setIsClientActionModalOpen] = useState(false);
  const [clientFeedback, setClientFeedback] = useState("");
  const [proposalEmail, setProposalEmail] = useState("");
  const [proposalSubject, setProposalSubject] = useState("");
  const [proposalBody, setProposalBody] = useState("");
  const [isSendingProposal, setIsSendingProposal] = useState(false);
  const [isEditingCard, setIsEditingCard] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editText, setEditText] = useState("");
  const [editScore, setEditScore] = useState("");

  const activeProcessFolders = viewMode === 'shared' ? sharedProcessFolders : processFolders;
  const activeProcessDocs = viewMode === 'shared'
    ? sharedProcessSourceDocs[selectedFolder || ''] || []
    : processSourceDocs[selectedFolder || ''] || [];
  const activeLeadFolders = viewMode === 'shared' ? sharedLeadFolders : leadFolders;

  const handleClientFeedback = (type: 'reject' | 'accept') => {
    const activeVersionNum = (customCards["version proposed"] || []).filter(c => c.lead === selectedActiveLead).length;

    if (type === 'reject') {
      const objectionData = {
        title: `Feedback on Version ${activeVersionNum}`,
        text: clientFeedback || "Client rejected the proposal.",
        lead: selectedActiveLead,
        versionRef: activeVersionNum
      };

      setCustomCards((prev: Record<string, any[]>) => ({
        ...prev,
        ["objection history"]: [...(prev["objection history"] || []), objectionData]
      }));

      setProposalStatus("Rejected");
    } else {
      const currentCards = (customCards["version proposed"] || []).filter((c: any) => c.lead === selectedActiveLead).pop()?.cards || getActiveCards();
      const signedRecord = {
        title: `Signed Proposal (v${activeVersionNum})`,
        text: `Accepted on ${new Date().toLocaleString()}`,
        lead: selectedActiveLead,
        cards: currentCards,
        signingDate: new Date().toLocaleString(),
        versionRef: activeVersionNum,
        isReadOnly: true
      };

      setCustomCards((prev: Record<string, any[]>) => ({
        ...prev,
        ["signed proposal"]: [...(prev["signed proposal"] || []), signedRecord]
      }));

      setProposalStatus("Signed");
    }

    setClientFeedback("");
    setIsClientActionModalOpen(false);
  };

  React.useEffect(() => {
    setEditingDoc(null);
    setIsEditingCard(false);
  }, [selectedFolder, selectedActiveLead, cardIndex]);

  // Load existing Drive files when a process folder is opened — always refreshes from Drive
  React.useEffect(() => {
    if (!selectedFolder) return;
    const googleToken = localStorage.getItem('google_provider_token');
    if (!googleToken) return;

    (async () => {
      try {
        const folderId = selectedFolder === "Positioning" || !selectedActiveLead
          ? (viewMode === 'shared' ? sharedFoldersMap[selectedFolder] : await syncFolderStructure(selectedFolder, 'PROCESS'))
          : (viewMode === 'shared' ? await findOrCreateFolder(selectedActiveLead, sharedFoldersMap[selectedFolder]) : await syncProcessLeadFolder(selectedFolder, selectedActiveLead));

        if (!folderId) {
          console.warn('[Drive] No folder ID found for process:', selectedFolder);
          return;
        }

        const driveFiles = await listFilesInFolder(folderId);
        const inputContextDir = driveFiles.find(f => f.name === "Input Context" && f.mimeType === 'application/vnd.google-apps.folder');
        
        let allFiles = driveFiles.filter(f => f.name !== "Input Context");
        
        if (inputContextDir) {
          try {
            const contextFiles = await listFilesInFolder(inputContextDir.id);
            allFiles = [...allFiles, ...contextFiles];
          } catch (err) {
            console.error("Failed to list files in Input Context subfolder:", err);
          }
        }

        // Always replace with latest from Drive (not just merge) so deleted files disappear too
        const docFiles = allFiles.map((f) => ({
          name: f.name,
          url: f.mimeType === 'application/vnd.google-apps.document'
            ? `https://docs.google.com/document/d/${f.id}/edit`
            : `https://drive.google.com/file/d/${f.id}/view`,
          googleDocId: f.mimeType === 'application/vnd.google-apps.document' ? f.id : null,
        }));

        if (viewMode === 'shared') {
          setSharedProcessSourceDocs((prev: Record<string, any[]>) => ({
            ...prev,
            [selectedFolder]: docFiles,
          }));
        } else {
          setProcessSourceDocs((prev: Record<string, any[]>) => ({
            ...prev,
            [selectedFolder]: docFiles,
          }));
        }
      } catch (e: any) {
        console.error('[Drive] Failed to load files:', e?.message || e);
      }
    })();
  }, [selectedFolder, selectedActiveLead, viewMode, sharedFoldersMap]);

  React.useEffect(() => {
    if (selectedFolder && selectedFolder !== "Positioning") {
      const leads = processLeads[selectedFolder] || [];
      if (leads.length === 0 && activeLeadFolders.length === 1 && !selectedActiveLead) {
        setProcessLeads((prev: Record<string, string[]>) => ({
          ...prev,
          [selectedFolder]: [activeLeadFolders[0]],
        }));
        setSelectedActiveLead(activeLeadFolders[0]);
      } else if (leads.length > 0 && !leads.includes(selectedActiveLead || "")) {
        setSelectedActiveLead(leads[0]);
      } else if (leads.length === 0) {
        setSelectedActiveLead(null);
      }
    }
  }, [selectedFolder, processLeads, activeLeadFolders, selectedActiveLead, setProcessLeads]);

  React.useEffect(() => {
    if (!isAddModalOpen) {
      setContextInput("");
      setAttachedFiles([]);
    }
  }, [isAddModalOpen]);

  const getFolderCardCount = (folder: string) => {
    const userEmail = session?.user?.email || localStorage.getItem('user_email');
    const onboardingKey = `${folder}_${userEmail}`;
    if (onboardingCards && onboardingCards[onboardingKey]) {
      return onboardingCards[onboardingKey].length;
    }

    let currentCustomCards = customCards[folder] || [];

    if (folder !== "Positioning" && selectedActiveLead) {
      currentCustomCards = currentCustomCards.filter(
        (c) => c.lead === selectedActiveLead
      );
    }

    if (currentCustomCards.length > 0) {
      return currentCustomCards.length;
    }

    return CARDS_BY_PROCESS[folder]?.length || 0;
  };

  const getContextPlaceholder = () => {
    switch (selectedFolder) {
      case "Positioning":
        return "Tell me about the work you do";
      case "Audience":
        return "Who do you want to talk to and why";
      case "Qualifying":
        return "Business need, decision maker, budget, and timeline";
      case "Discovery":
        return `Add relevant context for @${selectedActiveLead || "lead name"} <-> synth to lead`;
      case "Solution Design":
        return "Add relevant context";
      case "Business Case":
        return "Add relevant context";
      case "Proposal":
        return "Add relevant context";
      case "Closing":
        return "Add closing remark and context for future opportunities <-> synth to lead";
      case "Objection Handling":
        return "Add relevant context <-> synth to lead";
      case "Onboarding":
        return "Add relevant context <-> synth to lead";
      case "Referral":
        return "Add relevant context <-> synth to lead";
      default:
        return "Add relevant context";
    }
  };

  const getActiveCards = () => {
    if (!selectedFolder) return [];

    const userEmail = session?.user?.email || localStorage.getItem('user_email');
    const onboardingKey = `${selectedFolder}_${userEmail}`;
    if (onboardingCards && onboardingCards[onboardingKey]) {
      return onboardingCards[onboardingKey];
    }

    let currentCustomCards = customCards[selectedFolder] || [];

    if (selectedFolder !== "Positioning" && selectedActiveLead) {
      currentCustomCards = currentCustomCards.filter(
        (c) => c.lead === selectedActiveLead,
      );
    }

    if (currentCustomCards.length > 0) {
      return currentCustomCards;
    }

    return CARDS_BY_PROCESS[selectedFolder] || [];
  };

  const getLeadEmailMessages = () => {
    if (!selectedActiveLead) return [];
    const leadThreads = proposalThreads[selectedActiveLead] || [];
    const allMsgs: any[] = [];
    leadThreads.forEach((t: any) => {
      const msgs = threadMessages[t.threadId] || [];
      msgs.forEach((m: any) => {
        allMsgs.push({
          ...m,
          threadSubject: t.subject,
        });
      });
    });
    return allMsgs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const nextCard = () => {
    const cards = getActiveCards();
    if (cardIndex < cards.length - 1) setCardIndex((i) => i + 1);
  };

  const [hasAutoGenerated, setHasAutoGenerated] = useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (selectedFolder && selectedFolder !== "Positioning" && selectedActiveLead) {
      const cards = getActiveCards();
      const autoGenKey = `${selectedFolder}-${selectedActiveLead}`;
      if (cards.length === 0 && !isGenerating && !hasAutoGenerated[autoGenKey]) {
        setHasAutoGenerated(prev => ({ ...prev, [autoGenKey]: true }));
        handleGenerate(true);
      }
    }
  }, [selectedFolder, selectedActiveLead, customCards, isGenerating, hasAutoGenerated]);

  const handleGenerate = async (isAuto = false) => {
    if (!selectedFolder) return;
    setIsGenerating(true);
    try {
      const filesBase64 = attachedFiles.map((f) => f.url);

      let finalContext = contextInput;

      const getLeadCardsStr = () => {
        if (!selectedActiveLead) return "";
        const legacyKey = `${selectedActiveLead}_form`;
        const c2 = [
          ...(customCardsLead[selectedActiveLead] || []),
          ...(customCardsLead[legacyKey] || []),
          ...(customCardsLead["form"] || []),
        ];
        return "Lead Details:\n" + c2.map((x: any) => `${x.title}: ${x.text}`).join("\n");
      };

      const getProcessCardsStr = (processName: string) => {
        let pc = customCards[processName] || [];
        if (processName !== "Positioning" && selectedActiveLead) {
          pc = pc.filter((c: any) => c.lead === selectedActiveLead);
        }
        if (pc.length === 0) pc = CARDS_BY_PROCESS[processName] || [];
        return `${processName}:\n` + pc.map((x: any) => `${x.title}: ${x.text}`).join("\n");
      };

      let builtContext = "";

      const currentFolderCardsStr = getProcessCardsStr(selectedFolder);

      if (selectedFolder === "Audience") {
        builtContext = getProcessCardsStr("Positioning");
      } else if (selectedFolder === "Qualifying") {
        builtContext = getProcessCardsStr("Positioning") + "\n\n" + getLeadCardsStr();
      } else if (selectedFolder === "Discovery") {
        builtContext = getLeadCardsStr();
      } else if (selectedFolder === "Solution Design") {
        builtContext = getProcessCardsStr("Discovery");
      } else if (selectedFolder === "Business Case") {
        builtContext = getProcessCardsStr("Solution Design") + "\n\n" + getLeadCardsStr();
      } else if (selectedFolder === "Proposal") {
        builtContext = getProcessCardsStr("Discovery") + "\n\n" + getProcessCardsStr("Solution Design") + "\n\n" + getProcessCardsStr("Business Case");
      } else if (selectedFolder === "Closing") {
        builtContext = getProcessCardsStr("Discovery") + "\n\n" + getProcessCardsStr("Solution Design") + "\n\n" + getProcessCardsStr("Business Case") + "\n\n" + getProcessCardsStr("Proposal") + "\n\n" + getProcessCardsStr("Objection Handling");
      } else if (selectedFolder === "Objection Handling") {
        builtContext = getProcessCardsStr("Discovery") + "\n\n" + getProcessCardsStr("Solution Design") + "\n\n" + getProcessCardsStr("Proposal");
      } else if (selectedFolder === "Onboarding") {
        builtContext = getProcessCardsStr("Proposal") + "\n\n" + getProcessCardsStr("Solution Design") + "\n\n" + getProcessCardsStr("Business Case");
      } else if (selectedFolder === "Referral") {
        builtContext = getLeadCardsStr() + "\n\n" + getProcessCardsStr("Closing");
      }

      if (currentFolderCardsStr && !isAuto) {
        builtContext = builtContext + (builtContext ? "\n\n" : "") + "Previous Cards for " + selectedFolder + ":\n" + currentFolderCardsStr;
      }

      finalContext = builtContext ? `${builtContext}\n\nAdditional Input: ${contextInput}` : contextInput;

      const res = await fetch("/api/generate-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderType: selectedFolder,
          context: finalContext,
          status: selectedFolder === "Closing" ? closingStatus : undefined,
          filesBase64,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate");
      const data = await res.json();

      let newCards = Array.isArray(data.cards) ? data.cards : [data];
      newCards = newCards.map((c: any) => ({
        ...c,
        lead: selectedActiveLead,
      }));

      setCustomCards((prev: Record<string, any[]>) => {
        const existing = prev[selectedFolder] || [];
        const kept = existing.filter((c: any) => c.lead !== selectedActiveLead);
        return {
          ...prev,
          [selectedFolder]: [...kept, ...newCards],
        };
      });

      const targetSetter = viewMode === 'shared' ? setSharedProcessSourceDocs : setProcessSourceDocs;

      let proposalDoc: any = null;
      if (selectedFolder === "Proposal" && newCards.length > 0) {
        targetSetter((prev: Record<string, any[]>) => {
          const existingDocs = prev[selectedFolder] || [];

          let version = 1;
          existingDocs.forEach((d: any) => {
            if (d.name && d.name.startsWith("Proposal.v")) {
              const v = parseInt(d.name.replace("Proposal.v", ""), 10);
              if (v >= version) version = v + 1;
            }
          });

          const proposalContent = newCards.map((c: any) => `${c.title}\n${c.text}`).join('\n\n');
          proposalDoc = {
            name: `Proposal.v${version}`,
            url: `data:text/plain;base64,` + btoa(unescape(encodeURIComponent(proposalContent))),
            lead: selectedActiveLead,
            googleDocId: null as string | null,
          };

          return prev;
        });
      }

      let finalDocs = attachedFiles.map((f) => ({
        name: f.name,
        url: f.url,
        lead: selectedActiveLead,
        googleDocId: null as string | null,
      }));

      const googleToken = localStorage.getItem('google_provider_token');
      if (googleToken) {
        try {
          const folderId = selectedFolder === "Positioning" || !selectedActiveLead
            ? (viewMode === 'shared' ? sharedFoldersMap[selectedFolder] : await syncFolderStructure(selectedFolder, 'PROCESS'))
            : (viewMode === 'shared' ? await findOrCreateFolder(selectedActiveLead, sharedFoldersMap[selectedFolder]) : await syncProcessLeadFolder(selectedFolder, selectedActiveLead));

          if (folderId) {
            const inputContextFolderId = await findOrCreateFolder("Input Context", folderId);

            for (let i = 0; i < attachedFiles.length; i++) {
              const f = attachedFiles[i];
              if (f.url.startsWith("data:")) {
                const driveFile = await uploadBase64ToDrive(f.name, f.url, inputContextFolderId);
                finalDocs[i].googleDocId = driveFile.id;
              }
            }

            if (proposalDoc) {
              const driveFile = await uploadBase64ToDrive(proposalDoc.name, proposalDoc.url, folderId);
              proposalDoc.googleDocId = driveFile.id;
              proposalDoc.url = `https://docs.google.com/document/d/${driveFile.id}/edit`;
            }

            if (contextInput) {
              const driveFile = await createGoogleDocFromText(`${selectedFolder} Context Summary`, contextInput, inputContextFolderId);
              finalDocs.push({
                name: `${selectedFolder} Context Summary`,
                url: `https://docs.google.com/document/d/${driveFile.id}/edit`,
                lead: selectedActiveLead,
                googleDocId: driveFile.id
              } as any);

              // ALSO sync context to Lead's Input Context if in Discovery, Closing, Objection Handling, Onboarding, Referral
              const synthToLeadStages = ["Discovery", "Closing", "Objection Handling", "Onboarding", "Referral"];
              if (synthToLeadStages.includes(selectedFolder) && selectedActiveLead) {
                try {
                  const leadFolderId = viewMode === 'shared'
                    ? sharedFoldersMap[selectedActiveLead]
                    : await syncFolderStructure(selectedActiveLead, 'LEAD');
                  if (leadFolderId) {
                    const leadInputContextId = await findOrCreateFolder("Input Context", leadFolderId);
                    await createGoogleDocFromText(`${selectedFolder} Context Summary`, contextInput, leadInputContextId);
                  }
                } catch (err) {
                  console.error("Failed to automatically synchronize context to Lead Input Context folder:", err);
                }
              }
            }

            // Sync Gmail interactions to Input Context folder if Discovery stage
            if (selectedFolder === "Discovery" && selectedActiveLead) {
              try {
                const leadThreads = proposalThreads[selectedActiveLead] || [];
                const msgs: any[] = [];
                leadThreads.forEach((t: any) => {
                  const threadMsgs = threadMessages[t.threadId] || [];
                  msgs.push(...threadMsgs);
                });

                if (msgs.length > 0) {
                  msgs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                  let synthText = `=== EMAIL INTERACTIONS HISTORY FOR ${selectedActiveLead.toUpperCase()} ===\n`;
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
                  const driveFile = await createGoogleDocFromText(docName, synthText, inputContextFolderId);

                  finalDocs.push({
                    name: docName,
                    url: `https://docs.google.com/document/d/${driveFile.id}/edit`,
                    lead: selectedActiveLead,
                    googleDocId: driveFile.id
                  } as any);

                  // ALSO write it to the Lead folder's Input Context subfolder!
                  const leadFolderId = viewMode === 'shared'
                    ? sharedFoldersMap[selectedActiveLead]
                    : await syncFolderStructure(selectedActiveLead, 'LEAD');
                  if (leadFolderId) {
                    const leadInputContextId = await findOrCreateFolder("Input Context", leadFolderId);
                    await createGoogleDocFromText(docName, synthText, leadInputContextId);
                  }
                }
              } catch (err) {
                console.error("Failed to sync Gmail tracking interactions to Drive:", err);
              }
            }
          }
        } catch (e) {
          console.error("Failed to sync to Google Drive:", e);
          reportGoogleError(e, 'Failed to sync to Google Drive');
        }
      }

      if (proposalDoc) {
        targetSetter((prev: Record<string, any[]>) => {
          const existingDocs = prev[selectedFolder] || [];
          return {
            ...prev,
            [selectedFolder]: [...existingDocs, proposalDoc],
          };
        });
      }

      if (attachedFiles.length > 0) {
        targetSetter((prev: Record<string, any[]>) => {
          const existingDocs = prev[selectedFolder] || [];
          const merged = [...existingDocs];
          for (const doc of finalDocs) {
            if (!merged.find((d) => d.name === doc.name && d.url === doc.url)) {
              merged.push(doc);
            }
          }
          return {
            ...prev,
            [selectedFolder]: merged,
          };
        });
      }

      setContextInput("");
      setAttachedFiles([]);
      setIsAddModalOpen(false);

      setCardIndex(0);

      if (selectedFolder === "Positioning") {
        const posStr =
          "Positioning Strategy:\n" +
          newCards.map((c: any) => `${c.title}: ${c.text}`).join("\n");
        setTimeout(() => {
          fetch("/api/generate-insight", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              folderType: "Audience",
              context: posStr,
              filesBase64: [],
            }),
          })
            .then((r) => r.json())
            .then((audData) => {
              const audCards = Array.isArray(audData.cards)
                ? audData.cards
                : [audData];
              setCustomCards((prev: Record<string, any[]>) => ({
                ...prev,
                ["Audience"]: audCards.map((c: any) => ({ ...c, lead: null })),
              }));
            })
            .catch(console.error);
        }, 500);
      }
    } catch (e) {
      console.error(e);
      if (!isAuto) {
        alert("Failed to generate insight");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const prevCard = () => {
    if (cardIndex > 0) setCardIndex((i) => i - 1);
  };

  if (selectedFolder) {
    const cards = getActiveCards();
    if (cardIndex >= Math.max(1, cards.length))
      setCardIndex(Math.max(0, cards.length - 1));

    return (
      <div className="flex flex-col h-full bg-[#f4f4f5]/50 dark:bg-transparent rounded-3xl pb-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setSelectedFolder(null);
                setCardIndex(0);
                setIsContextExpanded(false);
              }}
              className="w-10 h-10 bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md rounded-full flex items-center justify-center shadow-sm border border-neutral-200/50 hover:bg-white dark:hover:bg-neutral-700 transition"
            >
              <ChevronLeft className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
            </button>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100">
                {selectedFolder}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedFolder === "Proposal" && selectedActiveLead && (
              <>
                <button
                  onClick={() => {
                    const clientEmail = leadEmails[selectedActiveLead] || "";
                    setProposalEmail(clientEmail);
                    setProposalSubject(`Proposal for ${selectedActiveLead} - Sales & Process AI`);
                    
                    const pCards = getActiveCards();
                    const draftBody = `Hi ${selectedActiveLead},\n\nHere is our proposed strategic outline based on our discovery and solution design sessions:\n\n` +
                      pCards.map((c: any) => `${c.title}:\n${c.text}`).join('\n\n') +
                      `\n\nWe look forward to discussing the terms with you.\n\nBest regards,\n${session?.user?.email || 'Sales Team'}`;
                    setProposalBody(draftBody);
                    
                    setIsSendProposalModalOpen(true);
                  }}
                  className="px-4 h-10 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-full flex items-center justify-center shadow-sm text-sm font-bold hover:bg-neutral-800 transition"
                >
                  Send to Client
                </button>
              </>
            )}
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="w-10 h-10 bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md rounded-full flex items-center justify-center shadow-sm border border-neutral-200/50 hover:bg-white dark:hover:bg-neutral-700 transition"
            >
              <Plus className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
            </button>
          </div>
        </div>

        <div className="relative flex w-full min-h-[450px] justify-center items-start pt-14 lg:pt-0">
          {!editingDoc ? (
            <>
          {/* Left Column */}
          <div
            className={cn(
              "absolute left-0 top-0 lg:static lg:flex-1 z-20 flex-col items-start w-auto",
              isLeadsExpanded ? "hidden lg:flex" : "flex",
            )}
          >
            <div className="w-full relative">
              <button
                onClick={() => {
                  setIsContextExpanded((prev) => !prev);
                  setIsLeadsExpanded(false);
                }}
                className="bg-white/60 dark:bg-neutral-800/60 border border-neutral-200/50 dark:border-neutral-700/50 p-3 lg:px-4 lg:py-2 rounded-2xl flex items-center gap-2 text-sm font-bold text-neutral-700 dark:text-neutral-300 shadow-sm backdrop-blur-md transition-all hover:bg-white dark:hover:bg-neutral-700"
              >
                <FileText className="w-5 h-5 lg:w-4 lg:h-4" /> <span className="hidden lg:inline">Context Summary</span>
              </button>

              <AnimatePresence>
                {isContextExpanded && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute left-0 top-full mt-4 w-[280px] lg:w-full lg:min-w-[280px] origin-top-left z-50"
                  >
                    <div className="p-5 bg-white/80 dark:bg-neutral-800/90 border border-neutral-200/50 dark:border-neutral-700/50 rounded-[20px] backdrop-blur-xl shadow-xl w-full">
                      <div className="flex flex-col gap-3">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                          Source Documents
                        </h4>

                        {activeProcessDocs?.map(
                          (doc: any, i: number) => (
                            <div key={i} className="flex flex-col gap-1 w-full mt-2">
                              <button
                                onClick={() => {
                                  setEditingDoc(doc);
                                  setIsContextExpanded(false);
                                  setIsLeadsExpanded(false);
                                }}
                                className="w-full text-left text-sm font-medium text-neutral-800 dark:text-neutral-200 hover:text-sky-600 dark:hover:text-sky-400 transition-colors flex items-center justify-between"
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0"></span>
                                  <span className="truncate">{doc.name}</span>
                                </div>
                                <span className="text-[10px] text-neutral-400 font-semibold shrink-0 ml-2">Edit</span>
                              </button>
                            </div>
                          ),
                        )}

                        {(!activeProcessDocs ||
                          activeProcessDocs.length === 0) && (
                          <div className="text-sm text-neutral-500 italic">No documents attached</div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Email Correspondence Timeline */}
            {(selectedFolder === "Proposal" || selectedFolder === "Objection Handling") && selectedActiveLead && (
              <div className="w-full mt-6 bg-white/40 dark:bg-neutral-800/40 backdrop-blur-md border border-neutral-200/50 dark:border-neutral-700/50 rounded-3xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4 border-b border-neutral-200/30 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isSyncingEmails ? 'bg-sky-400' : 'bg-green-400'}`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${isSyncingEmails ? 'bg-sky-500' : 'bg-green-500'}`}></span>
                    </span>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                      Gmail Proposal Loop
                    </h3>
                  </div>
                  <button
                    onClick={() => syncEmailReplies()}
                    disabled={isSyncingEmails}
                    className="text-[10px] font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 flex items-center gap-1 disabled:opacity-50"
                  >
                    {isSyncingEmails ? (
                      <>
                        <svg className="animate-spin h-3 w-3 text-sky-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Syncing...
                      </>
                    ) : "Check Replies"}
                  </button>
                </div>

                <div className="max-h-[300px] overflow-y-auto space-y-3 pr-1">
                  {getLeadEmailMessages().length === 0 ? (
                    <div className="text-xs text-neutral-400 dark:text-neutral-500 italic py-2">
                      No emails sent yet. Use "Send to Client" to begin.
                    </div>
                  ) : (
                    getLeadEmailMessages().map((msg: any) => {
                      const isMe = msg.isFromMe;
                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex flex-col gap-1 max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-sm",
                            isMe
                              ? "ml-auto bg-gradient-to-tr from-sky-500/10 to-blue-500/10 border border-sky-300/30 dark:border-sky-700/30 text-neutral-800 dark:text-neutral-200"
                              : "bg-white/80 dark:bg-neutral-800/80 border border-neutral-200/50 dark:border-neutral-700/50 text-neutral-800 dark:text-neutral-200"
                          )}
                        >
                          <div className="flex justify-between items-center gap-4 text-[9px] font-bold text-neutral-400 dark:text-neutral-500 border-b border-neutral-100 dark:border-neutral-700/40 pb-1 mb-1">
                            <span className="truncate">
                              {isMe ? "You (Sent)" : msg.from.split("<")[0] || msg.from}
                            </span>
                            <span>
                              {new Date(msg.date).toLocaleDateString() === new Date().toLocaleDateString()
                                ? new Date(msg.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : new Date(msg.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          <p className="font-semibold text-neutral-500 dark:text-neutral-400 text-[10px] mb-1 italic truncate">
                            Re: {msg.threadSubject}
                          </p>
                          <div className="whitespace-pre-line text-neutral-700 dark:text-neutral-300">
                            {msg.snippet || msg.body}
                          </div>
                          {!isMe && (
                            <div className="mt-1.5 pt-1.5 border-t border-dashed border-neutral-200 dark:border-neutral-700/40 flex justify-between items-center text-[9px] text-sky-600 dark:text-sky-400 font-bold">
                              <span>✓ Fed to Objection Handling</span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Center Column */}
              <div
                className={cn(
                  "w-full max-w-[320px] sm:max-w-[360px] md:max-w-[400px] shrink-0 flex-col items-center justify-start relative z-10 px-2 lg:px-4 mx-auto",
                  (isContextExpanded || isLeadsExpanded) ? "hidden lg:flex" : "flex",
                )}
              >
                {cards.length > 0 ? (
                  <div className="relative flex flex-col w-full items-center">
                <div className="h-[36px] flex items-center justify-center text-sm font-bold text-neutral-500 mb-2">
                  {cardIndex + 1} / {cards.length}
                </div>

                <motion.div
                  key={cardIndex}
                  initial={{ scale: 0.95, opacity: 0, x: 20 }}
                  animate={{ scale: 1, opacity: 1, x: 0 }}
                  exit={{ scale: 0.95, opacity: 0, x: -20 }}
                  transition={{ type: "spring", bounce: 0.3, duration: 0.5 }}
                  className={cn(
                    "w-full max-w-sm aspect-[3/4] rounded-[32px] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.06)] flex flex-col relative overflow-hidden",
                    "bg-white/80 dark:bg-neutral-800/90 backdrop-blur-xl border border-white dark:border-neutral-700",
                  )}
                  drag={isEditingCard ? false : "x"}
                  dragConstraints={{ left: 0, right: 0 }}
                  onDragEnd={(e, { offset, velocity }) => {
                    const swipe = offset.x;
                    if (swipe < -50 || velocity.x < -500) nextCard();
                    else if (swipe > 50 || velocity.x > 500) prevCard();
                  }}
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-400 to-blue-500 opacity-20" />

                  <div className="flex justify-between items-center mb-6">
                    <div className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                      {isEditingCard ? "Edit Insight" : "Insight"}
                    </div>
                    {!isEditingCard ? (
                      <div className="flex items-center gap-3">
                        {cards[cardIndex]?.score && (
                          <div className="flex items-end gap-1 font-black text-neutral-900 dark:text-neutral-100 text-2xl">
                            <span className="text-xs font-bold uppercase mb-1 text-neutral-400 pt-0.5">
                              Score
                            </span>{" "}
                            {cards[cardIndex].score}
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditTitle(cards[cardIndex]?.title || "");
                            setEditText(cards[cardIndex]?.text || "");
                            setEditScore(cards[cardIndex]?.score || "");
                            setIsEditingCard(true);
                          }}
                          className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-850 rounded text-neutral-500 hover:text-sky-500 transition-colors"
                          title="Edit Card"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold uppercase text-neutral-400 pt-0.5">Score</span>
                        <input
                          type="text"
                          className="w-12 bg-neutral-100 dark:bg-neutral-850 border border-neutral-300 dark:border-neutral-700 rounded px-1.5 py-0.5 text-xs font-bold text-center text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                          value={editScore}
                          onChange={(e) => setEditScore(e.target.value)}
                          placeholder="--"
                        />
                      </div>
                    )}
                  </div>

                  {isEditingCard ? (
                    <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto">
                      <div>
                        <label className="block text-[9px] font-bold text-neutral-400 uppercase mb-1">Title</label>
                        <input
                          type="text"
                          className="w-full bg-neutral-100 dark:bg-neutral-850 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-1.5 text-sm font-bold text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                        />
                      </div>
                      <div className="flex-1 flex flex-col min-h-0">
                        <label className="block text-[9px] font-bold text-neutral-400 uppercase mb-1">Content</label>
                        <textarea
                          className="w-full flex-1 bg-neutral-100 dark:bg-neutral-850 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none font-sans leading-relaxed min-h-[120px]"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const allFolderCards = [...(customCards[selectedFolder] || [])];
                            const isPositioning = selectedFolder === 'Positioning';
                            const activeLeadFilter = (c: any) => isPositioning ? !c.lead : c.lead === selectedActiveLead;
                            
                            let activeLeadCards = allFolderCards.filter(activeLeadFilter);
                            
                            if (activeLeadCards.length === 0) {
                              const mockCards = CARDS_BY_PROCESS[selectedFolder] || [];
                              activeLeadCards = mockCards.map(c => ({
                                ...c,
                                lead: isPositioning ? null : selectedActiveLead
                              }));
                            }

                            const updatedCard = {
                              ...activeLeadCards[cardIndex],
                              title: editTitle,
                              text: editText,
                              score: editScore || undefined
                            };
                            activeLeadCards[cardIndex] = updatedCard;

                            const otherLeadsCards = allFolderCards.filter(c => !activeLeadFilter(c));

                            setCustomCards((prev: any) => ({
                              ...prev,
                              [selectedFolder]: [...otherLeadsCards, ...activeLeadCards]
                            }));
                            setIsEditingCard(false);
                          }}
                          className="flex-1 py-2 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-bold rounded-lg text-xs transition"
                        >
                          Save
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsEditingCard(false);
                          }}
                          className="px-3 py-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-800 dark:text-neutral-200 font-bold rounded-lg text-xs transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-3xl font-black leading-tight mb-4 text-neutral-900 dark:text-neutral-100">
                        {cards[cardIndex].title}
                      </h2>
                      <p className="text-lg font-medium leading-relaxed text-neutral-600 dark:text-neutral-400">
                        {cards[cardIndex].text}
                      </p>
                    </>
                  )}
                  <div className="mt-auto flex justify-between items-center text-neutral-400">
                    <span className="text-[10px] font-bold uppercase tracking-widest">
                      Swipe
                    </span>
                    <div className="flex gap-1.5">
                      {cards.map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            "w-1.5 h-1.5 rounded-full transition-colors",
                            i === cardIndex
                              ? "bg-neutral-800 dark:bg-neutral-200"
                              : "bg-neutral-300 dark:bg-neutral-700",
                          )}
                        />
                      ))}
                    </div>
                  </div>
                 </motion.div>
                </div>
              ) : (
                <div className="w-full max-w-sm aspect-[3/4] flex flex-col items-center justify-center bg-white/40 dark:bg-neutral-800/40 rounded-[32px] border border-neutral-200/50 dark:border-neutral-700/50 p-8 text-center backdrop-blur-md">
                  <p className="text-xl font-bold text-neutral-400">
                    No cards available.
                  </p>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div
              className={cn(
                "absolute right-0 top-0 lg:static lg:flex-1 z-20 flex-col items-end w-auto",
                isContextExpanded ? "hidden lg:flex" : "flex",
              )}
            >
              {selectedFolder !== "Positioning" && (
                <div className="relative inline-block text-right w-full">
                  <button
                    onClick={() => {
                      setIsLeadsExpanded((prev) => !prev);
                      setIsContextExpanded(false);
                    }}
                    className="bg-white/60 dark:bg-neutral-800/60 border border-neutral-200/50 dark:border-neutral-700/50 p-3 lg:px-4 lg:py-2 rounded-2xl inline-flex items-center gap-2 text-sm font-bold text-neutral-700 dark:text-neutral-300 shadow-sm backdrop-blur-md transition-all hover:bg-white dark:hover:bg-neutral-700 float-right"
                  >
                    <FolderOpen className="w-5 h-5 lg:w-4 lg:h-4" /> <span className="hidden lg:inline">Lead</span>
                  </button>
                  <div className="clear-both"></div>

                  <AnimatePresence>
                    {isLeadsExpanded && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 top-full mt-4 w-[280px] lg:w-full lg:min-w-[280px] origin-top-right text-left z-50"
                      >
                        <div className="p-5 bg-white/80 dark:bg-neutral-800/90 border border-neutral-200/50 dark:border-neutral-700/50 rounded-[20px] backdrop-blur-xl shadow-xl w-full flex flex-col max-h-[400px]">
                          <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-4 px-1 hidden">
                            Lead
                          </h3>
                        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                          {activeLeadFolders.map((lead: string) => {
                            const isIncluded = (
                              processLeads[selectedFolder] || []
                            ).includes(lead);
                            const isActive = selectedActiveLead === lead;

                            return (
                              <div
                                key={lead}
                                onClick={() => {
                                  if (isIncluded) {
                                    setSelectedActiveLead(lead);
                                    setCardIndex(0);
                                  } else {
                                    setProcessLeads(
                                      (prev: Record<string, string[]>) => ({
                                        ...prev,
                                        [selectedFolder]: [
                                          ...(prev[selectedFolder] || []),
                                          lead,
                                        ],
                                      }),
                                    );
                                    if (!selectedActiveLead)
                                      setSelectedActiveLead(lead);
                                  }
                                }}
                                className={cn(
                                  "p-4 rounded-xl border shadow-sm cursor-pointer transition-colors relative group",
                                  isActive
                                    ? "bg-white dark:bg-neutral-800 border-sky-300 dark:border-sky-700"
                                    : isIncluded
                                      ? "bg-white/70 dark:bg-neutral-800/70 border-transparent hover:border-sky-300/50"
                                      : "bg-transparent border-dashed border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 opacity-60",
                                )}
                              >
                                <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100 pr-6 leading-tight">
                                  {lead}
                                </p>
                                {isIncluded && (
                                  <button
                                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full text-neutral-500 transition-all"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setProcessLeads(
                                        (prev: Record<string, string[]>) => ({
                                          ...prev,
                                          [selectedFolder]: prev[
                                            selectedFolder
                                          ].filter((l) => l !== lead),
                                        }),
                                      );
                                      if (selectedActiveLead === lead) {
                                        setSelectedActiveLead(null);
                                        setCardIndex(0);
                                      }
                                    }}
                                  >
                                    ✕
                                  </button>
                                )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </>
        ) : (
          <DocumentEditor key={editingDoc.name} doc={editingDoc} onClose={() => setEditingDoc(null)} />
        )}
      </div>

        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Add Context"
          className="sm:max-w-2xl"
        >
          <div className="space-y-6">
            <div className="pt-2">
              <div className="space-y-4">
                {selectedFolder === "Closing" && (
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-2">
                      Status
                    </label>
                    <select className="w-full p-3 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 transition-shadow">
                      <option value="Signed">Signed</option>
                      <option value="Commented">Commented</option>
                      <option value="Waiting">Waiting</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-2">
                    Context
                  </label>
                  <textarea
                    className="w-full h-24 p-3 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 resize-none transition-shadow"
                    placeholder={getContextPlaceholder()}
                    value={contextInput}
                    onChange={(e) => setContextInput(e.target.value)}
                  ></textarea>
                </div>

                <div className="mb-4">
                  <FileUploadDropzone
                    files={attachedFiles}
                    onChange={setAttachedFiles}
                  />
                </div>

                {selectedFolder === "Discovery" && selectedActiveLead && (
                  <div className="bg-neutral-50 dark:bg-neutral-900/60 p-4 rounded-2xl border border-neutral-200/50 dark:border-neutral-700/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Gmail Tracking Interactions</h4>
                      <span className="text-[10px] bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 px-2 py-0.5 rounded font-bold uppercase">Discovery Mode</span>
                    </div>
                    <p className="text-[11px] text-neutral-400 leading-relaxed">
                      Tracked client email thread replies for this lead will be consolidated and synchronized into the "Input Context" folder.
                    </p>
                    <div className="max-h-[120px] overflow-y-auto space-y-2 border-t border-neutral-200/30 pt-2 text-[11px]">
                      {(() => {
                        const emailMessages = getLeadEmailMessages();
                        if (emailMessages.length === 0) {
                          return <div className="italic text-neutral-400 py-1">No tracked emails found for this lead. Make sure client emails are active.</div>;
                        }
                        return emailMessages.map((msg: any) => (
                          <div key={msg.id} className="flex justify-between items-start gap-3 bg-white/60 dark:bg-neutral-800/40 p-2 rounded-xl border border-neutral-200/20">
                            <span className="font-semibold text-neutral-600 dark:text-neutral-400 truncate max-w-[80px] shrink-0">
                              {msg.isFromMe ? "Outbound" : "Inbound"}
                            </span>
                            <span className="truncate flex-1 text-neutral-700 dark:text-neutral-300">{msg.snippet || msg.body}</span>
                            <span className="text-[9px] text-neutral-400 shrink-0">{new Date(msg.date).toLocaleDateString()}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}

                <button
                  disabled={isGenerating}
                  className="w-full py-3 mt-4 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold rounded-xl text-sm transition-transform active:scale-95 shadow-sm hover:shadow disabled:opacity-50"
                  onClick={handleGenerate}
                >
                  {isGenerating ? "Generating..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </Modal>

        {/* Send Proposal Modal */}
        <Modal
          isOpen={isSendProposalModalOpen}
          onClose={() => setIsSendProposalModalOpen(false)}
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
                  value={proposalEmail}
                  onChange={(e) => setProposalEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 dark:text-neutral-500 mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  className="w-full p-3 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-shadow text-neutral-800 dark:text-neutral-200"
                  placeholder="Email Subject"
                  value={proposalSubject}
                  onChange={(e) => setProposalSubject(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 dark:text-neutral-500 mb-2">
                  Proposal Body
                </label>
                <textarea
                  className="w-full h-64 p-3 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none transition-shadow text-neutral-800 dark:text-neutral-200 font-sans leading-relaxed"
                  placeholder="Write proposal email..."
                  value={proposalBody}
                  onChange={(e) => setProposalBody(e.target.value)}
                ></textarea>
              </div>

              <button
                disabled={isSendingProposal || !proposalEmail}
                className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-xl text-sm transition-transform active:scale-95 shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                onClick={async () => {
                  if (!selectedActiveLead) return;
                  setIsSendingProposal(true);
                  try {
                    const formattedHtml = `
                      <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; background-color: #fff;">
                        <h2 style="color: #111; margin-top: 0; border-bottom: 2px solid #0284c7; padding-bottom: 8px;">Proposal for ${selectedActiveLead}</h2>
                        <div style="font-size: 15px; color: #333; line-height: 1.6; white-space: pre-wrap;">
                          ${proposalBody.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>")}
                        </div>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                        <p style="font-size: 11px; color: #888; text-align: center; margin-bottom: 0;">
                          Sent via Sales & Process AI Gmail Integration.
                        </p>
                      </div>
                    `;

                    const result = await sendProposalEmail({
                      to: proposalEmail,
                      subject: proposalSubject,
                      bodyHtml: formattedHtml,
                      leadName: selectedActiveLead,
                    });

                    addProposalThread(selectedActiveLead, {
                      threadId: result.threadId,
                      leadName: selectedActiveLead,
                      to: proposalEmail,
                      subject: proposalSubject,
                      sentAt: new Date().toISOString(),
                    });

                    setLeadEmail(selectedActiveLead, proposalEmail);
                    setIsSendProposalModalOpen(false);
                    alert("Proposal sent successfully via Gmail!");
                    
                    setTimeout(() => {
                      syncEmailReplies();
                    }, 500);
                  } catch (e: any) {
                    console.error(e);
                    alert(e.message || "Failed to send proposal");
                  } finally {
                    setIsSendingProposal(false);
                  }
                }}
              >
                {isSendingProposal ? "Sending..." : "Send Proposal"}
              </button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="pb-20">
      <div className="flex justify-between items-center mb-8">
        <div className="flex bg-white/40 dark:bg-neutral-800/40 backdrop-blur-md rounded-xl p-1 space-x-1 shadow-sm border border-white/40 dark:border-neutral-700">
          <button
            onClick={() => { setViewMode('my'); setSelectedFolder(null); }}
            className={cn(
              "px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center",
              viewMode === 'my' ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm" : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            )}
          >
            My Folders
          </button>
          <button
            onClick={() => { setViewMode('shared'); setSelectedFolder(null); }}
            className={cn(
              "px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center",
              viewMode === 'shared' ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm" : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            )}
          >
            Shared with me
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-8">
        {activeProcessFolders.map((folder: string) => (
          <button
            key={folder}
            onClick={() => {
              setSelectedFolder(folder);
              setIsContextExpanded(false);
            }}
            className="group bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md border border-white dark:border-neutral-700 hover:border-sky-200 dark:hover:border-sky-800 rounded-[24px] p-6 text-left aspect-square flex flex-col relative overflow-hidden transition-all active:scale-95 shadow-sm hover:shadow-md"
          >
            <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800 mb-auto flex items-center justify-center text-neutral-500 group-hover:text-sky-500 transition-colors">
              <FolderOpen className="w-5 h-5" />
            </div>

            <h3 className="text-lg font-bold leading-tight text-neutral-800 dark:text-neutral-200 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">
              {folder}
            </h3>
            <p className="text-xs font-medium text-neutral-400 mt-1">
              {getFolderCardCount(folder)} cards
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
