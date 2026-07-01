import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, FolderOpen, FileText, Plus, X, Pencil } from "lucide-react";
import { cn } from "../lib/utils";
import { Modal } from "../components/ui/Modal";
import { useAppContext } from "../AppContext";
import { DocumentEditor } from "../components/DocumentEditor";
import {
  FileUploadDropzone,
  FileData,
} from "../components/ui/FileUploadDropzone";

const LEAD_DATA: Record<string, any[]> = {};

import { syncFolderStructure, uploadToDrive, uploadBase64ToDrive, createGoogleDocFromText, listFilesInFolder, findOrCreateFolder } from "../lib/googleDrive";

export function Sales() {
  const {
    leadFolders: leadsList,
    setLeadFolders: setLeadsList,
    customCardsLead: customCards,
    setCustomCardsLead: setCustomCards,
    leadSourceDocs,
    setLeadSourceDocs,
    reportGoogleError,
    sharedLeadFolders,
    sharedLeadSourceDocs,
    setSharedLeadSourceDocs,
    sharedFoldersMap,
    leadEmails,
    setLeadEmail,
    session,
    onboardingCards,
  } = useAppContext();
  const [viewMode, setViewMode] = useState<'my' | 'shared'>('my');
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [contextInput, setContextInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<FileData[]>([]);
  const [editingDoc, setEditingDoc] = useState<any>(null); // { name: string, url: string }
  const [isEditingCard, setIsEditingCard] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [isInputContextDocsExpanded, setIsInputContextDocsExpanded] = useState(false);
  const [editText, setEditText] = useState("");
  const [editScore, setEditScore] = useState("");

  const hasAutoSelected = React.useRef(false);

  const activeLeadsList = viewMode === 'shared' ? sharedLeadFolders : leadsList;
  const activeLeadDocs = viewMode === 'shared'
    ? sharedLeadSourceDocs[selectedLead || ''] || []
    : leadSourceDocs[selectedLead || ''] || [];

  React.useEffect(() => {
    if (activeLeadsList.length === 1 && !selectedLead && !hasAutoSelected.current) {
      hasAutoSelected.current = true;
      setSelectedLead(activeLeadsList[0]);
    }
  }, [activeLeadsList, selectedLead]);

  React.useEffect(() => {
    setEditingDoc(null);
    setIsEditingCard(false);
  }, [selectedLead, cardIndex]);

  // Load existing Drive files when a lead folder is opened
  React.useEffect(() => {
    if (!selectedLead) return;
    const googleToken = localStorage.getItem('google_provider_token');
    if (!googleToken) return;

    (async () => {
      try {
        const folderId = viewMode === 'shared'
          ? sharedFoldersMap[selectedLead]
          : await syncFolderStructure(selectedLead, 'LEAD');

        if (!folderId) {
          console.warn('[Drive] No folder ID found for shared lead:', selectedLead);
          return;
        }

        const driveFiles = await listFilesInFolder(folderId);
        const inputContextDir = driveFiles.find(f => f.name === "Input Context" && f.mimeType === 'application/vnd.google-apps.folder');
        
        let rootFiles = driveFiles.filter(f => f.name !== "Input Context");
        let contextFiles: any[] = [];
        
        if (inputContextDir) {
          try {
            contextFiles = await listFilesInFolder(inputContextDir.id);
          } catch (err) {
            console.error("Failed to list files in Input Context subfolder:", err);
          }
        }

        // Always replace with latest from Drive so dropped files appear immediately
        const docFiles = rootFiles.map((f) => ({
          name: f.name,
          url: f.mimeType === 'application/vnd.google-apps.document'
            ? `https://docs.google.com/document/d/${f.id}/edit`
            : `https://drive.google.com/file/d/${f.id}/view`,
          googleDocId: f.mimeType === 'application/vnd.google-apps.document' ? f.id : null,
          mimeType: f.mimeType,
        }));

        if (inputContextDir) {
          docFiles.push({
            name: "Input Context",
            isInputContextFolder: true,
            googleDocId: null,
            files: contextFiles.map((f) => ({
              name: f.name,
              url: f.mimeType === 'application/vnd.google-apps.document'
                ? `https://docs.google.com/document/d/${f.id}/edit`
                : `https://drive.google.com/file/d/${f.id}/view`,
              googleDocId: f.mimeType === 'application/vnd.google-apps.document' ? f.id : null,
              mimeType: f.mimeType,
            }))
          } as any);
        }

        if (viewMode === 'shared') {
          setSharedLeadSourceDocs((prev: Record<string, any[]>) => ({
            ...prev,
            [selectedLead]: docFiles,
          }));
        } else {
          setLeadSourceDocs((prev: Record<string, any[]>) => ({
            ...prev,
            [selectedLead]: docFiles,
          }));
        }
      } catch (e: any) {
        console.error('[Drive] Failed to load files:', e?.message || e);
      }
    })();
  }, [selectedLead, viewMode, sharedFoldersMap]);

  const getActiveCards = () => {
    if (selectedLead) {
      const userEmail = session?.user?.email || localStorage.getItem('user_email');
      const onboardingKey = `${selectedLead}_${userEmail}`;
      if (onboardingCards && onboardingCards[onboardingKey]) {
        return onboardingCards[onboardingKey];
      }
    }

    const isMockLead = selectedLead === "Precision Components Inc.";
    // Fallback to legacy keys if they exist
    const legacyKey = `${selectedLead}_form`;
    const custom = [
      ...(customCards[selectedLead] || []),
      ...(customCards[legacyKey] || []),
      ...(customCards["form"] || []),
    ];

    if (custom.length > 0) {
      return custom;
    }

    if (isMockLead) {
      return LEAD_DATA["form"] || [];
    }

    return custom;
  };

  const getLeadCardCount = (lead: string) => {
    const userEmail = session?.user?.email || localStorage.getItem('user_email');
    const onboardingKey = `${lead}_${userEmail}`;
    if (onboardingCards && onboardingCards[onboardingKey]) {
      return onboardingCards[onboardingKey].length;
    }

    const isMockLead = lead === "Precision Components Inc.";
    const legacyKey = `${lead}_form`;
    const customLength =
      (customCards[lead] || []).length +
      (customCards[legacyKey] || []).length +
      (customCards["form"] || []).length;
    if (customLength > 0) return customLength;
    if (isMockLead) return LEAD_DATA["form"]?.length || 0;
    return 0;
  };

  const nextCard = () => {
    const cards = getActiveCards();
    if (cardIndex < cards.length - 1) setCardIndex((i) => i + 1);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const filesBase64 = attachedFiles.map((f) => f.url);

      const targetSetter = viewMode === 'shared' ? setSharedLeadSourceDocs : setLeadSourceDocs;

      if (!selectedLead) {
        // Root context, generating new lead
        const res = await fetch("/api/generate-lead-cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            context: contextInput,
            filesBase64,
          }),
        });

        if (!res.ok) throw new Error("Failed to generate lead");
        const data = await res.json();

        const newLeadName = data.companyName || "New Lead";
        setLeadsList((prev: string[]) => [...prev, newLeadName]);

        setCustomCards((prev: Record<string, any[]>) => ({
          ...prev,
          [newLeadName]: data.cards,
        }));

        let finalDocs = attachedFiles.map((f) => ({
          name: f.name,
          url: f.url,
          googleDocId: null as string | null,
        }));

        const googleToken = localStorage.getItem('google_provider_token');
        if (googleToken) {
          try {
            const folderId = viewMode === 'shared'
              ? sharedFoldersMap[selectedLead || newLeadName]
              : await syncFolderStructure(selectedLead || newLeadName, 'LEAD');
            if (folderId) {
              const inputContextFolderId = await findOrCreateFolder("Input Context", folderId);

              for (let i = 0; i < attachedFiles.length; i++) {
                const f = attachedFiles[i];
                if (f.url.startsWith("data:")) {
                  const driveFile = await uploadBase64ToDrive(f.name, f.url, inputContextFolderId);
                  finalDocs[i].googleDocId = driveFile.id;
                }
              }
              if (contextInput) {
                 const driveFile = await createGoogleDocFromText(`${selectedLead || newLeadName} Context Summary`, contextInput, inputContextFolderId);
                 finalDocs.push({
                   name: `${selectedLead || newLeadName} Context Summary`,
                   url: `https://docs.google.com/document/d/${driveFile.id}/edit`,
                   googleDocId: driveFile.id
                 } as any);
              }
            }
          } catch (e) {
            console.error("Failed to sync to Google Drive:", e);
            reportGoogleError(e, 'Failed to sync to Google Drive');
          }
        }

        if (finalDocs.length > 0) {
          targetSetter((prev: Record<string, any[]>) => {
            const existingDocs = prev[selectedLead || newLeadName] || [];
            const merged = [...existingDocs];
            for (const doc of finalDocs) {
              if (!merged.find((d) => d.name === doc.name && d.url === doc.url)) {
                merged.push(doc);
              }
            }
            return {
              ...prev,
              [selectedLead || newLeadName]: merged,
            };
          });
        }
      } else {
        // Inside a lead folder
        const res = await fetch("/api/generate-insight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            processName: selectedLead,
            folderType: "Lead Data",
            context: contextInput,
            filesBase64,
          }),
        });
        if (!res.ok) throw new Error("Failed to generate");
        const data = await res.json();

        const newCards = Array.isArray(data.cards) ? data.cards : [data];

        setCustomCards((prev: Record<string, any[]>) => ({
          ...prev,
          [selectedLead]: newCards,
        }));

        setCardIndex(0);

        let finalDocs = attachedFiles.map((f) => ({
          name: f.name,
          url: f.url,
          googleDocId: null as string | null,
        }));

        const googleToken = localStorage.getItem('google_provider_token');
        if (googleToken) {
          try {
            const folderId = viewMode === 'shared'
              ? sharedFoldersMap[selectedLead]
              : await syncFolderStructure(selectedLead, 'LEAD');
            if (folderId) {
              const inputContextFolderId = await findOrCreateFolder("Input Context", folderId);

              for (let i = 0; i < attachedFiles.length; i++) {
                const f = attachedFiles[i];
                if (f.url.startsWith("data:")) {
                  const driveFile = await uploadBase64ToDrive(f.name, f.url, inputContextFolderId);
                  finalDocs[i].googleDocId = driveFile.id;
                }
              }
              if (contextInput) {
                 const driveFile = await createGoogleDocFromText(`Context Add (${new Date().toLocaleString()})`, contextInput, inputContextFolderId);
                 finalDocs.push({
                   name: `Context Add (${new Date().toLocaleString()})`,
                   url: `https://docs.google.com/document/d/${driveFile.id}/edit`,
                   googleDocId: driveFile.id
                 } as any);
              }
            }
          } catch (e) {
            console.error("Failed to sync to Google Drive:", e);
            reportGoogleError(e, 'Failed to sync to Google Drive');
          }
        }

        if (finalDocs.length > 0) {
          targetSetter((prev: Record<string, any[]>) => {
            const existingDocs = prev[selectedLead] || [];
            const merged = [...existingDocs];
            for (const doc of finalDocs) {
              if (
                !merged.find((d) => d.name === doc.name && d.url === doc.url)
              ) {
                merged.push(doc);
              }
            }
            return {
              ...prev,
              [selectedLead]: merged,
            };
          });
        }
      }

      setContextInput("");
      setAttachedFiles([]);
      setIsAddModalOpen(false);
    } catch (e) {
      console.error(e);
      alert("Failed to generate insight");
    } finally {
      setIsGenerating(false);
    }
  };

  const prevCard = () => {
    if (cardIndex > 0) setCardIndex((i) => i - 1);
  };

  if (selectedLead) {
    const cards = getActiveCards();

    return (
      <div className="flex flex-col h-full bg-[#f4f4f5]/50 dark:bg-transparent rounded-3xl pb-8">
        {!editingDoc && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setSelectedLead(null);
                  setCardIndex(0);
                  setIsContextExpanded(false);
                }}
                className="w-10 h-10 bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md rounded-full flex items-center justify-center shadow-sm border border-neutral-200/50 hover:bg-white dark:hover:bg-neutral-700 transition"
              >
                <ChevronLeft className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
              </button>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100">
                  {selectedLead}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-semibold text-neutral-400 dark:text-neutral-500">Client Email:</span>
                  <input
                    type="email"
                    value={leadEmails[selectedLead] || ""}
                    onChange={(e) => setLeadEmail(selectedLead, e.target.value)}
                    placeholder="Enter email..."
                    className="bg-transparent border-b border-transparent hover:border-neutral-300 dark:hover:border-neutral-600 focus:border-sky-500 text-xs text-neutral-600 dark:text-neutral-300 focus:outline-none py-0.5 px-1 transition-colors w-52 font-semibold"
                  />
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="w-10 h-10 bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md rounded-full flex items-center justify-center shadow-sm border border-neutral-200/50 hover:bg-white dark:hover:bg-neutral-700 transition"
            >
              <Plus className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
            </button>
          </div>
        )}

        <div className="relative flex w-full min-h-[450px] justify-center items-start pt-14 lg:pt-0">
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

                        {activeLeadDocs?.map((doc: any, i: number) => {
                          if (doc.isInputContextFolder) {
                            return (
                              <div key={i} className="flex flex-col gap-1 w-full mt-2">
                                <button
                                  onClick={() => setIsInputContextDocsExpanded(prev => !prev)}
                                  className="w-full text-left text-sm font-bold text-neutral-700 dark:text-neutral-300 hover:text-sky-600 dark:hover:text-sky-400 transition-colors flex items-center justify-between bg-neutral-100/50 dark:bg-neutral-800/40 px-3 py-2 rounded-xl"
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <FolderOpen className={cn("w-4 h-4 text-sky-500 transition-transform flex-shrink-0", isInputContextDocsExpanded ? "rotate-90" : "")} />
                                    <span className="truncate">{doc.name}</span>
                                  </div>
                                  <span className="text-[10px] text-neutral-400 shrink-0 ml-2">
                                    {isInputContextDocsExpanded ? "Hide" : "Show"}
                                  </span>
                                </button>

                                {isInputContextDocsExpanded && (
                                  <div className="pl-4 border-l border-neutral-200 dark:border-neutral-700/60 mt-1 space-y-1.5 py-1">
                                    {doc.files && doc.files.map((subDoc: any, subIdx: number) => (
                                      <button
                                        key={subIdx}
                                        onClick={() => {
                                          setEditingDoc(subDoc);
                                          setIsContextExpanded(false);
                                        }}
                                        className="w-full text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors flex items-center justify-between"
                                      >
                                        <div className="flex items-center gap-1.5 truncate">
                                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400/80 flex-shrink-0"></span>
                                          <span className="truncate">{subDoc.name}</span>
                                        </div>
                                        <span className="text-[9px] text-neutral-400 shrink-0 ml-1">View</span>
                                      </button>
                                    ))}
                                    {(!doc.files || doc.files.length === 0) && (
                                      <div className="text-[11px] text-neutral-500 italic pl-3">No context files</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          }

                          return (
                            <div key={i} className="flex flex-col gap-1 w-full mt-2">
                              <button
                                onClick={() => {
                                  setEditingDoc(doc);
                                  setIsContextExpanded(false);
                                }}
                                className="w-full text-left text-sm font-medium text-neutral-800 dark:text-neutral-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center justify-between"
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0"></span>
                                  <span className="truncate">{doc.name}</span>
                                </div>
                                <span className="text-[10px] text-neutral-400 font-semibold shrink-0 ml-2">Edit</span>
                              </button>
                            </div>
                          );
                        })}

                        {(!activeLeadDocs ||
                          activeLeadDocs.length === 0) && (
                          <div className="text-sm text-neutral-500 italic">No documents attached</div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {!editingDoc ? (
            <>
              {/* Center Column */}
              <div className="w-full max-w-[320px] sm:max-w-[360px] md:max-w-[400px] shrink-0 flex flex-col items-center justify-start relative z-10 px-2 lg:px-4 mx-auto">
                {cards.length > 0 ? (
                  <div className="relative flex flex-col w-full items-center">
                <div className="h-[36px] flex items-center justify-center text-sm font-bold text-neutral-500 mb-2">
                  {cardIndex + 1} / {cards.length}
                </div>

                <AnimatePresence mode="wait">
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
                        const allLeadCards = getActiveCards();
                        const updatedCard = {
                          ...cards[cardIndex],
                          title: editTitle,
                          text: editText,
                          score: editScore || undefined
                        };
                        const updatedCardsArray = [...allLeadCards];
                        updatedCardsArray[cardIndex] = updatedCard;

                        setCustomCards((prev: any) => ({
                          ...prev,
                          [selectedLead]: updatedCardsArray
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
                    {cards[cardIndex]?.title}
                  </h2>
                  <p className="text-lg font-medium leading-relaxed text-neutral-600 dark:text-neutral-400 whitespace-pre-line">
                    {cards[cardIndex]?.text}
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
          </AnimatePresence>
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
          </div>
        </>
        ) : (
          <DocumentEditor key={editingDoc.name} doc={editingDoc} onClose={() => setEditingDoc(null)} />
        )}
      </div>
    );

        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Add Context"
          className="sm:max-w-2xl"
        >
          <div className="space-y-6">
            <div className="pt-2">
              <div className="space-y-4">
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
      <div className="flex justify-between items-center mb-8">
        <div className="flex bg-white/40 dark:bg-neutral-800/40 backdrop-blur-md rounded-xl p-1 space-x-1 shadow-sm border border-white/40 dark:border-neutral-700">
          <button
            onClick={() => { setViewMode('my'); setSelectedLead(null); }}
            className={cn(
              "px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center",
              viewMode === 'my' ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm" : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            )}
          >
            My Folders
          </button>
          <button
            onClick={() => { setViewMode('shared'); setSelectedLead(null); }}
            className={cn(
              "px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center",
              viewMode === 'shared' ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm" : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            )}
          >
            Shared with me
          </button>
        </div>

        {viewMode === 'my' && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="w-10 h-10 bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md rounded-full flex items-center justify-center shadow-sm border border-neutral-200/50 hover:bg-white dark:hover:bg-neutral-700 transition"
          >
            <Plus className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {activeLeadsList.map((lead) => (
          <button
            key={lead}
            onClick={() => setSelectedLead(lead)}
            className="group bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md border border-white dark:border-neutral-700 hover:border-sky-200 dark:hover:border-sky-800 rounded-[24px] p-6 text-left aspect-square flex flex-col relative overflow-hidden transition-all active:scale-95 shadow-sm hover:shadow-md"
          >
            <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800 mb-auto flex items-center justify-center text-neutral-500 group-hover:text-sky-500 transition-colors">
              <FolderOpen className="w-5 h-5" />
            </div>

            <h3 className="text-lg font-bold leading-tight text-neutral-800 dark:text-neutral-200 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">
              {lead}
            </h3>
            <p className="text-xs font-medium text-neutral-400 mt-1">
              {getLeadCardCount(lead)} cards
            </p>
          </button>
        ))}
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
