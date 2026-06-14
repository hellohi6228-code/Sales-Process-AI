import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, FolderOpen, FileText, Plus } from 'lucide-react';
import { cn } from '../lib/utils';
import { Modal } from '../components/ui/Modal';
import { useAppContext } from '../AppContext';

const LEAD_DATA: Record<string, any[]> = {
  form: [
    { title: 'Company Details', text: 'Precision Components Inc.\nCustom metal component manufacturing.\n~250 Employees, ~$65M Revenue.\n2 production plants.' },
    { title: 'Strategic Focus', text: 'Improve production efficiency, increase on-time delivery, and enhance operational visibility without significant workforce expansion.' },
    { title: 'Business Challenges', text: 'Frequent production scheduling conflicts, limited visibility into real-time shop floor status, and labor-intensive reporting processes via Excel.' }
  ],
  onboarding: [
    { title: 'Primary Contact', text: 'Operations Manager. Oversees scheduling, shop floor coordination, capacity planning. Project champion.' },
    { title: 'Stakeholder Landscape', text: 'Plant Manager (Executor), Prod Supervisor (End User), COO (Exec Sponsor focusing on ROI).' },
    { title: 'Engagement Assessment', text: 'Strong characteristics of early-stage AI implementation. High executive attention, willingness to evaluate tech. Start with pilot.' }
  ],
  transcript: [
    { title: 'Operation Insight', text: 'Production scheduling delays emerged as the most discussed challenge. Causes overtime and delivery delays.', score: 9 },
    { title: 'Problem Frequency', text: 'Scheduling conflicts occur daily, resulting in expedited work orders and downtime.', score: 10 },
    { title: 'Existing Systems', text: 'Frustration with current ERP reporting capabilities. Significant time spent preparing reports rather than acting on insights.', score: 10 }
  ]
};

export function Sales() {
  const { leadFolders: leadsList, setLeadFolders: setLeadsList, customCardsLead: customCards, setCustomCardsLead: setCustomCards, leadSourceDocs, setLeadSourceDocs } = useAppContext();
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'onboarding' | 'transcript' | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [contextInput, setContextInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);

  const getActiveCards = () => {
    if (!activeTab || !selectedLead) return [];
    const isMockLead = selectedLead === 'Precision Components Inc.';
    const key = `${selectedLead}_${activeTab}`;
    const custom = customCards[key] || [];

    if (isMockLead) {
      const baseCards = LEAD_DATA[activeTab] || [];
      return [...baseCards, ...(customCards[activeTab] || []), ...custom];
    }
    
    return custom;
  };

  const getTabCardCount = (tabName: string) => {
    if (!selectedLead) return 0;
    const isMockLead = selectedLead === 'Precision Components Inc.';
    const key = `${selectedLead}_${tabName}`;
    const customLength = (customCards[key] || []).length;
    const baseLength = isMockLead ? ((LEAD_DATA[tabName]?.length || 0) + (customCards[tabName]?.length || 0)) : 0;
    return baseLength + customLength;
  };

  const getLeadCardCount = (lead: string) => {
    const isMockLead = lead === 'Precision Components Inc.';
    const getTabCount = (tabName: string) => {
       const key = `${lead}_${tabName}`;
       const customLength = (customCards[key] || []).length;
       const baseLength = isMockLead ? ((LEAD_DATA[tabName]?.length || 0) + (customCards[tabName]?.length || 0)) : 0;
       return baseLength + customLength;
    };
    return getTabCount('form') + getTabCount('onboarding') + getTabCount('transcript');
  };

  const nextCard = () => {
    const cards = getActiveCards();
    if (cardIndex < cards.length - 1) setCardIndex(i => i + 1);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      if (!selectedLead || !activeTab) {
        // Root context, generating new lead
        const res = await fetch("/api/generate-lead-cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            context: contextInput,
            imageBase64: fileBase64
          })
        });
        
        if (!res.ok) throw new Error("Failed to generate lead");
        const data = await res.json();
        
        const newLeadName = data.companyName || "New Lead";
        setLeadsList((prev: string[]) => [...prev, newLeadName]);
        
        const formKey = `${newLeadName}_form`;
        setCustomCards((prev: Record<string, any[]>) => ({
          ...prev,
          [formKey]: data.cards
        }));

        if (fileBase64 && fileName) {
           setLeadSourceDocs((prev: Record<string, any[]>) => ({
               ...prev,
               [newLeadName]: [{ name: fileName, url: fileBase64 }]
           }));
        }
      } else {
        // Inside a folder
        const res = await fetch("/api/generate-insight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            processName: selectedLead,
            folderType: activeTab,
            context: contextInput
          })
        });
        if (!res.ok) throw new Error("Failed to generate");
        const data = await res.json();
        
        const key = `${selectedLead}_${activeTab}`;
        const newCards = Array.isArray(data.cards) ? data.cards : [data];
        
        setCustomCards((prev: Record<string, any[]>) => ({
          ...prev,
          [key]: [...(prev[key] || []), ...newCards]
        }));
        
        const currentCustom = customCards[key] || [];
        const isMockLead = selectedLead === 'Precision Components Inc.';
        const mockCount = isMockLead ? ((LEAD_DATA[activeTab] || []).length + (customCards[activeTab]?.length || 0)) : 0;
        setCardIndex(mockCount + currentCustom.length);

        if (fileBase64 && fileName) {
           setLeadSourceDocs((prev: Record<string, any[]>) => ({
               ...prev,
               [selectedLead]: [...(prev[selectedLead] || []), { name: fileName, url: fileBase64 }]
           }));
        }
      }
      
      setContextInput("");
      setFileBase64(null);
      setFileName(null);
      setIsAddModalOpen(false);
    } catch(e) {
      console.error(e);
      alert("Failed to generate insight");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFileBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const prevCard = () => {
    if (cardIndex > 0) setCardIndex(i => i - 1);
  };

  if (activeTab && selectedLead) {
    const cards = getActiveCards();
    
    return (
      <div className="flex flex-col h-full bg-[#f4f4f5]/50 dark:bg-transparent rounded-3xl pb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => { setActiveTab(null); setCardIndex(0); setIsContextExpanded(false); }}
              className="w-10 h-10 bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md rounded-full flex items-center justify-center shadow-sm border border-neutral-200/50 hover:bg-white dark:hover:bg-neutral-700 transition"
            >
              <ChevronLeft className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
            </button>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight capitalize text-neutral-900 dark:text-neutral-100">{activeTab}</h1>
              <p className="text-sm font-medium text-neutral-500">{selectedLead}</p>
            </div>
          </div>
          <button onClick={() => setIsAddModalOpen(true)} className="w-10 h-10 bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md rounded-full flex items-center justify-center shadow-sm border border-neutral-200/50 hover:bg-white dark:hover:bg-neutral-700 transition">
             <Plus className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
          </button>
        </div>

        <div className="relative mb-4 z-20">
          <button 
            onClick={() => setIsContextExpanded(!isContextExpanded)}
            className="bg-white/60 dark:bg-neutral-800/60 border border-neutral-200/50 dark:border-neutral-700/50 px-4 py-2 rounded-2xl flex items-center gap-2 text-sm font-bold text-neutral-700 dark:text-neutral-300 shadow-sm backdrop-blur-md transition-all hover:bg-white dark:hover:bg-neutral-700"
          >
             <FileText className="w-4 h-4" /> Context Summary
          </button>
          
          <AnimatePresence>
            {isContextExpanded && (
              <motion.div 
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute left-0 top-full mt-4 w-80 origin-top-left"
              >
                <div className="p-5 bg-white/80 dark:bg-neutral-800/90 border border-neutral-200/50 dark:border-neutral-700/50 rounded-[20px] backdrop-blur-xl shadow-xl">

                   
                   <div className="flex flex-col gap-3">
                     <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">Source Documents</h4>
                     
                     {leadSourceDocs[selectedLead]?.map((doc: any, i: number) => (
                        <button key={i} onClick={() => setViewImageUrl(doc.url)} className="w-full text-left text-sm font-medium text-neutral-800 dark:text-neutral-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0"></span>
                          <span className="truncate">{doc.name}</span>
                        </button>
                     ))}

                     {(!leadSourceDocs[selectedLead] || leadSourceDocs[selectedLead].length === 0) && (
                         <>
                           <a href="#" className="text-sm font-medium text-neutral-800 dark:text-neutral-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2">
                             <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0"></span>
                             <span className="truncate">strategy_q3.docx</span>
                           </a>
                           <a href="#" className="text-sm font-medium text-neutral-800 dark:text-neutral-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2">
                             <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0"></span>
                             <span className="truncate">competitive_analysis.pdf</span>
                           </a>
                         </>
                     )}
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative flex-1 flex items-center justify-center min-h-[400px] z-10">
            <div className="absolute top-0 text-sm font-bold text-neutral-400">
              {cardIndex + 1} / {cards.length}
            </div>
            
            <AnimatePresence mode="wait">
              <motion.div 
                 key={cardIndex}
                 initial={{ scale: 0.95, opacity: 0, x: 20 }}
                 animate={{ scale: 1, opacity: 1, x: 0 }}
                 exit={{ scale: 0.95, opacity: 0, x: -20 }}
                 transition={{ type: 'spring', bounce: 0.3, duration: 0.5 }}
                 className={cn(
                   "w-full max-w-sm aspect-[3/4] rounded-[32px] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.06)] flex flex-col relative overflow-hidden",
                   "bg-white/80 dark:bg-neutral-800/90 backdrop-blur-xl border border-white dark:border-neutral-700"
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
                 <div className="text-xs font-bold uppercase tracking-widest text-neutral-400">Insight</div>
                 {cards[cardIndex].score && (
                   <div className="flex items-end gap-1 font-black text-neutral-900 dark:text-neutral-100 text-2xl">
                     <span className="text-xs font-bold uppercase mb-1 text-neutral-400 pt-0.5">Score</span> {cards[cardIndex].score}
                   </div>
                  )}
                </div>
                <h2 className="text-3xl font-black leading-tight mb-4 text-neutral-900 dark:text-neutral-100">
                  {cards[cardIndex].title}
                </h2>
                <p className="text-lg font-medium leading-relaxed text-neutral-600 dark:text-neutral-400 whitespace-pre-line">
                  {cards[cardIndex].text}
                </p>
                <div className="mt-auto flex justify-between items-center text-neutral-400">
                  <span className="text-[10px] font-bold uppercase tracking-widest">Swipe</span>
                  <div className="flex gap-1.5">
                    {cards.map((_, i) => (
                      <div key={i} className={cn("w-1.5 h-1.5 rounded-full transition-colors", i === cardIndex ? 'bg-neutral-800 dark:bg-neutral-200' : 'bg-neutral-300 dark:bg-neutral-700')} />
                    ))}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
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
                  <label className="block text-xs font-medium text-neutral-500 mb-2">Context</label>
                  <textarea 
                    className="w-full h-24 p-3 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 resize-none transition-shadow"
                    placeholder="E.g., Factor in a 10% material cost increase for Q3..."
                    value={contextInput}
                    onChange={e => setContextInput(e.target.value)}
                  ></textarea>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-2">Attach Image (Namecard or diagram)</label>
                  <div className="flex items-center">
                    <input type="file" accept="image/*" onChange={handleFileChange} className="block w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200 transition-all cursor-pointer" />
                  </div>
                </div>
                
                <button disabled={isGenerating} className="w-full py-3 mt-4 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold rounded-xl text-sm transition-transform active:scale-95 shadow-sm hover:shadow disabled:opacity-50" onClick={handleGenerate}>
                  {isGenerating ? 'Generating...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </Modal>

        <Modal 
          isOpen={!!viewImageUrl} 
          onClose={() => setViewImageUrl(null)} 
          title="Document View"
          className="sm:max-w-2xl bg-white dark:bg-neutral-900"
        >
           <div className="p-4 flex justify-center items-center">
              {viewImageUrl && <img src={viewImageUrl} alt="Document" className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-sm" />}
           </div>
        </Modal>
      </div>
    );
  }

  if (selectedLead) {
    return (
      <div className="pb-20">
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => setSelectedLead(null)}
            className="w-10 h-10 bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md rounded-full flex items-center justify-center shadow-sm border border-neutral-200/50 hover:bg-white dark:hover:bg-neutral-700 transition"
          >
            <ChevronLeft className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
          </button>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100">{selectedLead}</h1>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-8">
          <button onClick={() => { setActiveTab('form'); setIsContextExpanded(false); }} className="group bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md border border-white dark:border-neutral-700 hover:border-sky-200 dark:hover:border-sky-800 rounded-[24px] p-6 text-left aspect-square flex flex-col relative overflow-hidden transition-all active:scale-95 shadow-sm hover:shadow-md">
            <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800 mb-auto flex items-center justify-center text-neutral-500 group-hover:text-sky-500 transition-colors">
               <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold leading-tight text-neutral-800 dark:text-neutral-200 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">Form</h3>
            <p className="text-xs font-medium text-neutral-400 mt-1">{getTabCardCount('form')} cards</p>
          </button>
          <button onClick={() => { setActiveTab('onboarding'); setIsContextExpanded(false); }} className="group bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md border border-white dark:border-neutral-700 hover:border-blue-200 dark:hover:border-blue-800 rounded-[24px] p-6 text-left aspect-square flex flex-col relative overflow-hidden transition-all active:scale-95 shadow-sm hover:shadow-md">
            <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800 mb-auto flex items-center justify-center text-neutral-500 group-hover:text-blue-500 transition-colors">
               <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold leading-tight text-neutral-800 dark:text-neutral-200 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">Onboarding</h3>
            <p className="text-xs font-medium text-neutral-400 mt-1">{getTabCardCount('onboarding')} cards</p>
          </button>
          <button onClick={() => { setActiveTab('transcript'); setIsContextExpanded(false); }} className="group bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md border border-white dark:border-neutral-700 hover:border-purple-200 dark:hover:border-purple-800 rounded-[24px] p-6 text-left aspect-square flex flex-col relative overflow-hidden transition-all active:scale-95 shadow-sm hover:shadow-md">
            <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800 mb-auto flex items-center justify-center text-neutral-500 group-hover:text-purple-500 transition-colors">
               <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold leading-tight text-neutral-800 dark:text-neutral-200 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">Transcript</h3>
            <p className="text-xs font-medium text-neutral-400 mt-1">{getTabCardCount('transcript')} cards</p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      <div className="flex justify-end mb-8">
        <button onClick={() => setIsAddModalOpen(true)} className="w-10 h-10 bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md rounded-full flex items-center justify-center shadow-sm border border-neutral-200/50 hover:bg-white dark:hover:bg-neutral-700 transition">
           <Plus className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {leadsList.map((lead) => (
          <button
            key={lead}
            onClick={() => setSelectedLead(lead)}
            className="group bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md border border-white dark:border-neutral-700 hover:border-sky-200 dark:hover:border-sky-800 rounded-[24px] p-6 text-left aspect-square flex flex-col relative overflow-hidden transition-all active:scale-95 shadow-sm hover:shadow-md"
          >
            <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800 mb-auto flex items-center justify-center text-neutral-500 group-hover:text-sky-500 transition-colors">
               <FolderOpen className="w-5 h-5" />
            </div>
            
            <h3 className="text-lg font-bold leading-tight text-neutral-800 dark:text-neutral-200 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">{lead}</h3>
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
                <label className="block text-xs font-medium text-neutral-500 mb-2">Context</label>
                <textarea 
                  className="w-full h-24 p-3 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 resize-none transition-shadow"
                  placeholder="E.g., Factor in a 10% material cost increase for Q3..."
                  value={contextInput}
                  onChange={e => setContextInput(e.target.value)}
                ></textarea>
              </div>
              
              <div>
                <div className="flex items-center">
                  <input type="file" accept="image/*" onChange={handleFileChange} className="block w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200 transition-all cursor-pointer" />
                </div>
              </div>
              
              <button disabled={isGenerating} className="w-full py-3 mt-4 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold rounded-xl text-sm transition-transform active:scale-95 shadow-sm hover:shadow disabled:opacity-50" onClick={handleGenerate}>
                {isGenerating ? 'Generating...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={!!viewImageUrl} 
        onClose={() => setViewImageUrl(null)} 
        title="Document View"
        className="sm:max-w-2xl bg-white dark:bg-neutral-900"
      >
         <div className="p-4 flex justify-center items-center">
            {viewImageUrl && <img src={viewImageUrl} alt="Document" className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-sm" />}
         </div>
      </Modal>
    </div>
  );
}
