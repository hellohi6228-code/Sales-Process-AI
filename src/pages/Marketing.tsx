import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronLeft,
  FileText,
  CheckCircle2,
  Plus,
  FolderOpen,
  X,
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

const openInNewTab = (url: string, name: string) => {
  if (url.startsWith("data:")) {
    if (url.startsWith("data:image")) {
      const win = window.open("", "_blank");
      if (!win) return;
      win.document.write(
        `<html style="margin:0;height:100%;display:flex;align-items:center;justify-content:center;background:#0e0e0e;"><head><title>${name}</title></head><body><img src="${url}" style="max-width:100%;max-height:100%;object-fit:contain;"/></body></html>`,
      );
      win.document.close();
      return;
    } else if (url.startsWith("data:application/pdf")) {
      const win = window.open("", "_blank");
      if (!win) return;
      win.document.write(
        `<html style="margin:0;height:100%;"><head><title>${name}</title></head><body style="margin:0;height:100%;"><embed src="${url}" width="100%" height="100%"></embed></body></html>`,
      );
      win.document.close();
      return;
    } else {
      // For Word docs, Excel, CSV, text, etc. create a download link
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }
  }
  window.open(url, "_blank");
};

export function Marketing() {
  const {
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
  } = useAppContext();
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
  const [isLeadsExpanded, setIsLeadsExpanded] = useState(true);
  const [attachedFiles, setAttachedFiles] = useState<FileData[]>([]);
  const [editingDoc, setEditingDoc] = useState<any>(null); // { name: string, url: string }
  const [isSendProposalModalOpen, setIsSendProposalModalOpen] = useState(false);
  const [proposalEmail, setProposalEmail] = useState("");
  const [proposalStatus, setProposalStatus] = useState<string | null>(null);
  const [isClientActionModalOpen, setIsClientActionModalOpen] = useState(false);
  const [clientFeedback, setClientFeedback] = useState("");

  const handleSendProposal = () => {
    // Generate version proposed
    const currentProposalCards = getActiveCards();
    const versionNum = (customCards["version proposed"] || []).filter((c: any) => c.lead === selectedActiveLead).length + 1;
    const now = new Date().toLocaleString();
    const secureLinkId = Math.random().toString(36).substring(2, 10);
    const reviewLink = `${window.location.origin}/review/${secureLinkId}`;
    
    const versionRecord = {
      title: `Version ${versionNum}`,
      text: `Sent to: ${proposalEmail} at ${now}. Cards: ${JSON.stringify(currentProposalCards)}`,
      lead: selectedActiveLead,
      versionNum,
      date: now,
      sender: "Sales Agent",
      recipient: proposalEmail,
      cards: currentProposalCards,
      reviewLink,
    };

    setCustomCards((prev: Record<string, any[]>) => ({
      ...prev,
      ["version proposed"]: [...(prev["version proposed"] || []), versionRecord]
    }));

    setProposalStatus("Sent");
    setIsSendProposalModalOpen(false);
  };

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
        text: `Accepted by ${proposalEmail} on ${new Date().toLocaleString()}`,
        lead: selectedActiveLead,
        cards: currentCards,
        signerName: proposalEmail.split('@')[0],
        signerEmail: proposalEmail,
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
  }, [selectedFolder]);

  React.useEffect(() => {
    if (!isAddModalOpen) {
      setContextInput("");
      setAttachedFiles([]);
    }
  }, [isAddModalOpen]);

  React.useEffect(() => {
    if (selectedFolder && selectedFolder !== "Positioning") {
      const leads = processLeads[selectedFolder] || [];
      if (leads.length === 0 && leadFolders.length === 1 && !selectedActiveLead) {
        // Automatically add the single existing lead to this folder and select it
        setProcessLeads((prev: Record<string, string[]>) => ({
          ...prev,
          [selectedFolder]: [leadFolders[0]],
        }));
        setSelectedActiveLead(leadFolders[0]);
      } else if (leads.length > 0 && !leads.includes(selectedActiveLead || "")) {
        setSelectedActiveLead(leads[0]);
      } else if (leads.length === 0) {
        setSelectedActiveLead(null);
      }
    }
  }, [selectedFolder, processLeads, leadFolders, selectedActiveLead, setProcessLeads]);

  const getFolderCardCount = (folder: string) => {
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

  const getActiveCards = () => {
    if (!selectedFolder) return [];

    // For positioning or if no leads exist/selected
    let currentCustomCards = customCards[selectedFolder] || [];

    // If we have an active lead, potentially filter or namespace custom cards?
    // The instructions say "to let user choose which lead to be include in this process and able switch to lead that are in this process for context and cards". Let's assume custom cards can be globally or per-lead.
    // For simplicity, we just filter custom cards that might have been tagged to this lead.
    // Right now, generating adds it globally. We should tag newly generated cards with active lead.
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

  const handleSessionFolderCardGen = async () => {
    // keeping handleGenerate structure
  };

  const handleGenerate = async (isAuto = false) => {
    if (!selectedFolder) return;
    setIsGenerating(true);
    try {
      const filesBase64 = attachedFiles.map((f) => f.url);

      let finalContext = contextInput;

      const getLeadCardsStr = () => {
        if (!selectedActiveLead) return "";
        const legacyKey = `${selectedActiveLead}_form`;
        const c = [
          ...(customCardsLead[selectedActiveLead] || []),
          ...(customCardsLead[legacyKey] || []),
          ...(selectedActiveLead === "Precision Components Inc." ? (CARDS_BY_PROCESS["form"] || []) : []), // using CARDS_BY_PROCESS is wrong here, it's LEAD_DATA in Sales.tsx. We don't have LEAD_DATA here. But we can just use customCardsLead['form'].
        ];
        // wait, we don't have LEAD_DATA exported in Marketing.tsx. Let's just do:
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

      if (selectedFolder === "Proposal" && newCards.length > 0) {
        setProcessSourceDocs((prev: Record<string, any[]>) => {
          const existingDocs = prev[selectedFolder] || [];
          
          let version = 1;
          existingDocs.forEach((d: any) => {
            if (d.name && d.name.startsWith("Proposal - Version ")) {
               const v = parseInt(d.name.replace("Proposal - Version ", ""), 10);
               if (v >= version) version = v + 1;
            }
          });

          const proposalContent = newCards.map((c: any) => `${c.title}\n${c.text}`).join('\n\n');
          const proposalDoc = {
            name: `Proposal - Version ${version}.txt`,
            url: `data:text/plain;base64,` + btoa(unescape(encodeURIComponent(proposalContent))),
            lead: selectedActiveLead,
          };

          return {
            ...prev,
            [selectedFolder]: [...existingDocs, proposalDoc],
          };
        });
      }

      if (attachedFiles.length > 0) {
        setProcessSourceDocs((prev: Record<string, any[]>) => {
          const existingDocs = prev[selectedFolder] || [];
          const newDocs = attachedFiles.map((f) => ({
            name: f.name,
            url: f.url,
            lead: selectedActiveLead,
          }));
          // Keep distinct files
          const merged = [...existingDocs];
          for (const doc of newDocs) {
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

      const cards = getActiveCards();
      setCardIndex(0); // reset to first card when newly generated

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
    // cardIndex bounds check
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
                    setProposalEmail(`${selectedActiveLead.toLowerCase().replace(/[^a-z0-9]/g, '')}@example.com`);
                    setIsSendProposalModalOpen(true);
                  }}
                  className="px-4 h-10 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-full flex items-center justify-center shadow-sm text-sm font-bold hover:bg-neutral-800 transition"
                >
                  Send to Client
                </button>
                {proposalStatus === "Sent" && (
                  <button
                    onClick={() => setIsClientActionModalOpen(true)}
                    className="px-4 h-10 bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md rounded-full flex items-center justify-center shadow-sm border border-neutral-200/50 hover:bg-white dark:hover:bg-neutral-700 transition text-sm font-bold text-neutral-700 dark:text-neutral-300"
                  >
                    Simulate Client Review
                  </button>
                )}
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
          <div className="absolute left-0 top-0 lg:static lg:flex-1 z-20 flex flex-col items-start w-auto">
            <div className="w-full relative">
              <button
                onClick={() => setIsContextExpanded(!isContextExpanded)}
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

                        {processSourceDocs[selectedFolder]?.map(
                          (doc: any, i: number) => (
                            <a
                              key={i}
                              href={doc.url}
                              onClick={(e) => {
                                e.preventDefault();
                                setEditingDoc(doc);
                                setIsLeadsExpanded(false);
                              }}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full text-left text-sm font-medium text-neutral-800 dark:text-neutral-200 hover:text-sky-600 dark:hover:text-sky-400 transition-colors flex items-center gap-2"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0"></span>
                              <span className="truncate">{doc.name}</span>
                            </a>
                          ),
                        )}

                        {(!processSourceDocs[selectedFolder] ||
                          processSourceDocs[selectedFolder].length === 0) && (
                          <div className="text-sm text-neutral-500 italic">No documents attached</div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Center Column */}
              <div className="w-full max-w-[320px] sm:max-w-[360px] md:max-w-[400px] shrink-0 flex flex-col items-center justify-start relative z-10 px-2 lg:px-4 mx-auto">
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
                  drag="x"
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
                      Insight
                    </div>
                    {cards[cardIndex]?.score && (
                      <div className="flex items-end gap-1 font-black text-neutral-900 dark:text-neutral-100 text-2xl">
                        <span className="text-xs font-bold uppercase mb-1 text-neutral-400 pt-0.5">
                          Score
                        </span>{" "}
                        {cards[cardIndex].score}
                      </div>
                    )}
                  </div>
                  <h2 className="text-3xl font-black leading-tight mb-4 text-neutral-900 dark:text-neutral-100">
                    {cards[cardIndex].title}
                  </h2>
                  <p className="text-lg font-medium leading-relaxed text-neutral-600 dark:text-neutral-400">
                    {cards[cardIndex].text}
                  </p>
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
            <div className="absolute right-0 top-0 lg:static lg:flex-1 z-20 flex flex-col items-end w-auto">
              {selectedFolder !== "Positioning" && (
                <div className="relative inline-block text-right w-full">
                  <button
                    onClick={() => setIsLeadsExpanded(!isLeadsExpanded)}
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
                          {leadFolders.map((lead: string) => {
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
          isOpen={isSendProposalModalOpen}
          onClose={() => setIsSendProposalModalOpen(false)}
          title="Send Proposal"
          className="sm:max-w-md"
        >
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-2">Recipient Email</label>
              <input 
                type="email"
                className="w-full p-3 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" 
                value={proposalEmail}
                onChange={e => setProposalEmail(e.target.value)}
              />
            </div>
            <button
              onClick={handleSendProposal}
              className="w-full py-3 mt-4 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold rounded-xl text-sm transition-transform active:scale-95 shadow-sm hover:shadow"
            >
              Send Proposal
            </button>
          </div>
        </Modal>

        <Modal
          isOpen={isClientActionModalOpen}
          onClose={() => setIsClientActionModalOpen(false)}
          title="Simulate Client Action (Email/Review Link)"
          className="sm:max-w-md"
        >
          <div className="space-y-4 pt-2">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100 rounded-xl text-sm mb-4">
              <p className="font-semibold mb-1">Simulated Email Sent</p>
              <p className="opacity-90">A secure review link was sent to {proposalEmail}.</p>
              <p className="mt-2 text-xs font-mono break-all opacity-70 border-t border-blue-200/50 dark:border-blue-800 pt-2">
                {(() => {
                  const items = customCards["version proposed"] || [];
                  const activeVersion = items.filter((c: any) => c.lead === selectedActiveLead).pop();
                  return activeVersion ? activeVersion.reviewLink : "";
                })()}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-2">Client Feedback (optional)</label>
              <textarea 
                className="w-full h-24 p-3 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none" 
                placeholder="E.g., Pricing is too high, please reconsider the timeline."
                value={clientFeedback}
                onChange={e => setClientFeedback(e.target.value)}
              />
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => handleClientFeedback('reject')}
                className="flex-1 py-3 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-semibold rounded-xl text-sm transition-transform active:scale-95 shadow-sm hover:shadow"
              >
                Reject / Comment
              </button>
              <button
                onClick={() => handleClientFeedback('accept')}
                className="flex-1 py-3 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-semibold rounded-xl text-sm transition-transform active:scale-95 shadow-sm hover:shadow"
              >
                Accept & Sign
              </button>
            </div>
          </div>
        </Modal>

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
                    placeholder="E.g., Factor in a 10% material cost increase for Q3..."
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
      </div>
    );
  }

  return (
    <div className="pb-20">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-8">
        {processFolders.map((folder: string) => (
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
