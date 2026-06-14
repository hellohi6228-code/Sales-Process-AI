import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, FileText, CheckCircle2, Plus, FolderOpen } from 'lucide-react';
import { cn } from '../lib/utils';
import { Modal } from '../components/ui/Modal';
import { useAppContext } from '../AppContext';

const CARDS_BY_PROCESS: Record<string, any[]> = {
  'Positioning': [
    { title: 'Define target market', text: 'Focus on founders, manufacturers, and industrial tech needing strategic guidance at the intersection of ops, AI, and commercialization.', score: 95 },
    { title: 'Understand customer needs', text: 'Target customers seek practical solutions for efficiency and growth, valuing consultants who bridge tech with business strategy.', score: 88 },
    { title: 'Analyze competitors', text: 'Bring multidisciplinary credibility across renewable energy, enterprise tech, IB, and entrepreneurship to stand out from generic firms.', score: 92 },
    { title: 'Craft value proposition', text: 'Transform complex operational challenges into scalable business opportunities using AI-enabled workflows and strategic execution.', score: 98 },
    { title: 'Develop positioning statement', text: 'I help industrial tech modernize ops and accelerate growth through engineering insight, AI, and business advisory.', score: 100 }
  ],
  'Lead': [
    { title: 'Define target audience', text: 'Identify mid-market manufacturers ($50M-$200M revenue) actively experiencing growth pains or supply chain bottlenecks.', score: 90 },
    { title: 'Build prospect list', text: 'Compile list of COO, VP Operations, and Plant Managers via LinkedIn Sales Navigator and industry association directories.', score: 85 },
    { title: 'Launch outreach campaigns', text: 'Execute multi-touch sequenes blending email insights on AI in manufacturing with targeted LinkedIn connection requests.', score: 88 },
    { title: 'Capture inbound interest', text: 'Deploy lead capture forms on whitepapers detailing "Overcoming Production Scheduling Constraints with Digital Twins".', score: 94 },
    { title: 'Qualify leads', text: 'Initial 15-minute screen to confirm company size, manufacturing complexity, and presence of discrete operational challenges.', score: 91 }
  ],
  'Qualifying': [
    { title: 'Review lead profile', text: 'Precision Components Inc. is a mid-sized ($75M) manufacturer of aerospace parts. History of manual scheduling.', score: 85 },
    { title: 'Assess business need', text: 'The company faces scheduling conflicts and high overtime costs (15% above target) due to legacy ERP constraints.', score: 90 },
    { title: 'Identify decision makers', text: 'Operations Manager serves as project champion. CFO approval required for investments over $25k.', score: 88 },
    { title: 'Confirm budget and timeline', text: 'No explicit budget line item, but Q3 target to resolve overtime bleed. Fast ROI approach required.', score: 82 },
    { title: 'Evaluate fit / ICP score', text: 'Strong alignment with our expertise in legacy system modernization and manufacturing ops. ICP Fit Score: 9/10.', score: 90 }
  ],
  'Discovery': [
    { title: 'Company & Context', text: 'Attention Score 9/10. Aerospace supplier experiencing rapid demand growth but constrained by manual planning.', score: 90 },
    { title: 'Operation Insight', text: 'Production scheduling delays emerged as the root cause of late deliveries and expedited shipping fees.', score: 95 },
    { title: 'Problem Assessment', text: 'Frequency Score 10/10, Impact 8/10, Persistence 8/10. Weekly schedule rebuilds consume 20+ hours of planner time.', score: 86 },
    { title: 'Existing Systems', text: 'Current Solution Pain 10/10. Legacy disconnected ERP module requiring extensive spreadsheet workarounds.', score: 100 },
    { title: 'Prioritization & Readiness', text: 'Urgency 9/10, Budget Signal 8/10, Champion 9/10. C-level pressure to improve on-time delivery metrics.', score: 86 }
  ],
  'Solution Design': [
    { title: 'Capacity Forecasting', text: 'Implement a production capacity planning capability overlaying their ERP to predict 30-60 day constraints.', score: 92 },
    { title: 'Bottleneck Detection', text: 'Create real-time monitoring dashboard identifying work-center constraints before they impact the critical path.', score: 95 },
    { title: 'Scheduling Optimization', text: 'Replace spreadsheet-based scheduling with automated rule-based sequence generation.', score: 90 },
    { title: 'Production Visibility', text: 'Provide real-time visibility to shop floor supervisors via digital kanban screens.', score: 88 }
  ],
  'Business Case': [
    { title: 'Improved On-Time Delivery', text: 'Improve on-time delivery by 10-20% through proactive constraint management, avoiding late penalties.', score: 95 },
    { title: 'Increased Capacity Utilization', text: 'Increase throughput by 5-15% by minimizing idle time and optimizing changeover sequences.', score: 90 },
    { title: 'Reduced Overtime Costs', text: 'Lower overtime expenses by 10-25% via leveled production scheduling rather than reactive expediting.', score: 98 },
    { title: 'Improved Planner Productivity', text: 'Reduce planning effort by 30-50%, redirecting 15+ hours/week to strategic vendor management.', score: 85 }
  ],
  'Proposal': [
    { title: 'Why Us', text: 'Our team combines manufacturing ops expertise with digital transformation, bridging the gap between shop floor and code.', score: 90 },
    { title: 'Problem Summary', text: 'Precision Components relies on fragmented ERP data leading to manual scheduling, overtime, and late deliveries.', score: 95 },
    { title: 'Proposed Solution', text: 'Establish an integrated production planning engine mapped directly to existing ERP data structures.', score: 88 },
    { title: 'Timeline & Implementation', text: 'Phased implementation approach over 14 weeks: Discovery (2w), Build (6w), Train (3w), Go-Live Support (3w).', score: 85 },
    { title: 'Pricing & Terms', text: 'Fixed-scope implementation with milestone payments linked perfectly to Phase gating.', score: 92 }
  ],
  'Closing': [
    { title: 'Solution Design Recap', text: 'Proposed solution enhancing existing ERP investments without requiring a risky system replacement.', score: 88 },
    { title: 'Business Case / ROI', text: 'Built around reducing manual reporting. Projected 11-month payback period based on overtime reduction alone.', score: 96 },
    { title: 'Proposal Revision 1', text: 'Addressed implementation risk by increasing post-go-live hypercare duration from 3 to 4 weeks.', score: 85 },
    { title: 'Final Agreement', text: 'Incorporated major customer concerns, resulting in a risk-managed transformation master services agreement.', score: 100 }
  ],
  'Objection Handling': [
    { title: 'Undefined Tech Stack', text: 'Clarified architecture approach: We leverage existing SQL views rather than building complex net-new integrations.', score: 85 },
    { title: 'Vague Success Metrics', text: 'Tied final milestone payment directly to a 10% reduction in measurable scheduling cycle time.', score: 80 },
    { title: 'Data Readiness Issues', text: 'Added a pre-flight data cleansing workshop to the Week 1 agenda to isolate dirty ERP routing data.', score: 90 },
    { title: 'Knowledge Transfer', text: 'Updated proposal to include mandatory train-the-trainer certification for two shop-floor supervisors.', score: 75 }
  ],
  'Onboarding': [
    { title: 'Create Project Workspace', text: 'Create dedicated client workspace. Deploy standard templates, RAID logs, and initialize project charter.', score: 92 },
    { title: 'Assign Stakeholders', text: 'Assign internal consultants alongside client reps. Establish weekly steering committee cadence.', score: 88 },
    { title: 'Collect Prerequisites', text: 'Gather ERP access, production data exports, routing sheets, and sample manual schedule files.', score: 95 },
    { title: 'Confirm Readiness', text: 'Verify required data and access. Hold official project kickoff meeting with executive sponsors.', score: 100 }
  ],
  'Referral': [
    { title: 'Identify Opportunity', text: 'Precision Components is a strong case study showing rapid ROI from digital planning on legacy ERPs.', score: 95 },
    { title: 'Qualify the Referral', text: 'Focus on operational leaders in peer companies trying to reduce overtime through better scheduling.', score: 92 },
    { title: 'Make the Introduction', text: 'Request direct intro from Operations Manager to their peer network at the upcoming manufacturing symposium.', score: 88 },
    { title: 'Track Referral Progress', text: 'Monitor each referral by recording who made intro and ensuring the referring client gets a thank you gift.', score: 85 }
  ]
};

export function Marketing() {
  const { processFolders, setProcessFolders, customCardsProcess: customCards, setCustomCardsProcess: setCustomCards, leadFolders, processLeads, setProcessLeads, processSourceDocs, setProcessSourceDocs } = useAppContext();
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [contextInput, setContextInput] = useState("");
  const [closingStatus, setClosingStatus] = useState("Signed");
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedActiveLead, setSelectedActiveLead] = useState<string | null>(null);
  const [isLeadsExpanded, setIsLeadsExpanded] = useState(true);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);

  React.useEffect(() => {
    if (selectedFolder && selectedFolder !== 'Positioning') {
       const leads = processLeads[selectedFolder] || [];
       if (leads.length > 0 && !leads.includes(selectedActiveLead || '')) {
          setSelectedActiveLead(leads[0]);
       } else if (leads.length === 0) {
          setSelectedActiveLead(null);
       }
    }
  }, [selectedFolder, processLeads]);

  const getActiveCards = () => {
    if (!selectedFolder) return [];
    
    // For positioning or if no leads exist/selected
    let currentCustomCards = customCards[selectedFolder] || [];
    
    // If we have an active lead, potentially filter or namespace custom cards?
    // The instructions say "to let user choose which lead to be include in this process and able switch to lead that are in this process for context and cards". Let's assume custom cards can be globally or per-lead.
    // For simplicity, we just filter custom cards that might have been tagged to this lead.
    // Right now, generating adds it globally. We should tag newly generated cards with active lead.
    if (selectedFolder !== 'Positioning' && selectedActiveLead) {
       currentCustomCards = currentCustomCards.filter(c => c.lead === selectedActiveLead);
    }

    if (selectedFolder === 'Positioning' && currentCustomCards.length > 0) {
      return currentCustomCards;
    }

    return [...(CARDS_BY_PROCESS[selectedFolder] || []), ...currentCustomCards];
  };

  const nextCard = () => {
    const cards = getActiveCards();
    if (cardIndex < cards.length - 1) setCardIndex(i => i + 1);
  };

  const handleSessionFolderCardGen = async () => {
    // keeping handleGenerate structure
  };

  const handleGenerate = async () => {
    if (!selectedFolder) return;
    setIsGenerating(true);
    try {
      const res = await fetch("/api/generate-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderType: selectedFolder,
          context: contextInput,
          status: selectedFolder === 'Closing' ? closingStatus : undefined,
          imageBase64: fileBase64
        })
      });
      if (!res.ok) throw new Error("Failed to generate");
      const data = await res.json();
      
      let newCards = Array.isArray(data.cards) ? data.cards : [data];
      newCards = newCards.map((c: any) => ({
         ...c,
         lead: selectedActiveLead
      }));

      setCustomCards((prev: Record<string, any[]>) => ({
        ...prev,
        [selectedFolder]: selectedFolder === 'Positioning' ? newCards : [...(prev[selectedFolder] || []), ...newCards]
      }));

      if (fileBase64 && fileName) {
         setProcessSourceDocs((prev: Record<string, any[]>) => ({
             ...prev,
             [selectedFolder]: [...(prev[selectedFolder] || []), { name: fileName, url: fileBase64 }]
         }));
      }

      setContextInput("");
      setFileBase64(null);
      setFileName(null);
      setIsAddModalOpen(false);
      
      const cards = getActiveCards();
      setCardIndex(selectedFolder === 'Positioning' ? 0 : cards.length); // will point to the newly added one
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

  if (selectedFolder) {
    const cards = getActiveCards();
    // cardIndex bounds check
    if (cardIndex >= Math.max(1, cards.length)) setCardIndex(Math.max(0, cards.length - 1));
    
    return (
      <div className="flex flex-col h-full bg-[#f4f4f5]/50 dark:bg-transparent rounded-3xl pb-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => { setSelectedFolder(null); setCardIndex(0); setIsContextExpanded(false); }}
              className="w-10 h-10 bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md rounded-full flex items-center justify-center shadow-sm border border-neutral-200/50 hover:bg-white dark:hover:bg-neutral-700 transition"
            >
              <ChevronLeft className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
            </button>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100">{selectedFolder}</h1>
            </div>
          </div>
          <button onClick={() => setIsAddModalOpen(true)} className="w-10 h-10 bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md rounded-full flex items-center justify-center shadow-sm border border-neutral-200/50 hover:bg-white dark:hover:bg-neutral-700 transition">
             <Plus className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
          </button>
        </div>
        
        <div className="flex flex-col md:flex-row w-full min-h-[450px] gap-6 lg:gap-12 justify-between">
          {/* Left Column */}
          <div className="w-full xl:w-[280px] shrink-0 z-20 flex flex-col items-start mb-4 md:mb-0">
            <div className="relative inline-block">
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
                    className="absolute left-0 top-full mt-4 w-[340px] origin-top-left z-50"
                  >
                    <div className="p-5 bg-white/80 dark:bg-neutral-800/90 border border-neutral-200/50 dark:border-neutral-700/50 rounded-[20px] backdrop-blur-xl shadow-xl w-full">

                       
                       <div className="flex flex-col gap-3">
                         <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">Source Documents</h4>
                         
                         {processSourceDocs[selectedFolder]?.map((doc: any, i: number) => (
                             <button key={i} onClick={() => setViewImageUrl(doc.url)} className="w-full text-left text-sm font-medium text-neutral-800 dark:text-neutral-200 hover:text-sky-600 dark:hover:text-sky-400 transition-colors flex items-center gap-2">
                               <span className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0"></span>
                               <span className="truncate">{doc.name}</span>
                             </button>
                         ))}

                         {(!processSourceDocs[selectedFolder] || processSourceDocs[selectedFolder].length === 0) && (
                           <>
                             <a href="#" className="text-sm font-medium text-neutral-800 dark:text-neutral-200 hover:text-sky-600 dark:hover:text-sky-400 transition-colors flex items-center gap-2">
                               <span className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0"></span>
                               <span className="truncate">strategy_q3.docx</span>
                             </a>
                             <a href="#" className="text-sm font-medium text-neutral-800 dark:text-neutral-200 hover:text-sky-600 dark:hover:text-sky-400 transition-colors flex items-center gap-2">
                               <span className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0"></span>
                               <span className="truncate">competitive_analysis.pdf</span>
                             </a>
                             <a href="#" className="text-sm font-medium text-neutral-800 dark:text-neutral-200 hover:text-sky-600 dark:hover:text-sky-400 transition-colors flex items-center gap-2">
                               <span className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0"></span>
                               <span className="truncate">founder_notes.txt</span>
                             </a>
                           </>
                         )}
                       </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Center Column */}
          <div className="flex-1 w-full mx-auto flex flex-col items-center justify-start relative z-10 px-4">
            {cards.length > 0 ? (
              <div className="relative flex w-full justify-center">
                <div className="absolute -top-6 text-sm font-bold text-neutral-400">
                  {cardIndex + 1} / {cards.length}
                </div>
                
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
                     <div className="flex items-end gap-1 font-black text-neutral-900 dark:text-neutral-100 text-2xl">
                       <span className="text-xs font-bold uppercase mb-1 text-neutral-400 pt-0.5">Score</span> {cards[cardIndex].score}
                     </div>
                  </div>
                  <h2 className="text-3xl font-black leading-tight mb-4 text-neutral-900 dark:text-neutral-100">
                    {cards[cardIndex].title}
                  </h2>
                  <p className="text-lg font-medium leading-relaxed text-neutral-600 dark:text-neutral-400">
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
              </div>
            ) : (
              <div className="w-full max-w-sm aspect-[3/4] flex flex-col items-center justify-center bg-white/40 dark:bg-neutral-800/40 rounded-[32px] border border-neutral-200/50 dark:border-neutral-700/50 p-8 text-center backdrop-blur-md">
                <p className="text-xl font-bold text-neutral-400">No cards available.</p>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="w-full xl:w-[280px] shrink-0 z-20 flex flex-col items-end mt-8 md:mt-0">
             {selectedFolder !== 'Positioning' && (
                <div className="relative inline-block text-right">
                  <button 
                    onClick={() => setIsLeadsExpanded(!isLeadsExpanded)}
                    className="bg-white/60 dark:bg-neutral-800/60 border border-neutral-200/50 dark:border-neutral-700/50 px-4 py-2 rounded-2xl inline-flex items-center gap-2 text-sm font-bold text-neutral-700 dark:text-neutral-300 shadow-sm backdrop-blur-md transition-all hover:bg-white dark:hover:bg-neutral-700 float-right"
                  >
                     <FolderOpen className="w-4 h-4" /> Included Leads
                  </button>
                  <div className="clear-both"></div>
                  
                  <AnimatePresence>
                    {isLeadsExpanded && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 top-full mt-4 w-[340px] origin-top-right text-left z-50"
                      >
                         <div className="p-5 bg-white/80 dark:bg-neutral-800/90 border border-neutral-200/50 dark:border-neutral-700/50 rounded-[20px] backdrop-blur-xl shadow-xl w-full flex flex-col max-h-[400px]">
                            <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-4 px-1 hidden">Included Leads</h3>
                            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                                {leadFolders.map((lead: string) => {
                                  const isIncluded = (processLeads[selectedFolder] || []).includes(lead);
                                  const isActive = selectedActiveLead === lead;
                                  
                                  return (
                                     <div 
                                       key={lead} 
                                       onClick={() => {
                                          if (isIncluded) {
                                             setSelectedActiveLead(lead);
                                             setCardIndex(0);
                                          } else {
                                             setProcessLeads((prev: Record<string, string[]>) => ({
                                                ...prev,
                                                [selectedFolder]: [...(prev[selectedFolder] || []), lead]
                                             }));
                                             if (!selectedActiveLead) setSelectedActiveLead(lead);
                                          }
                                       }}
                                       className={cn("p-4 rounded-xl border shadow-sm cursor-pointer transition-colors relative group",
                                         isActive ? "bg-white dark:bg-neutral-800 border-sky-300 dark:border-sky-700" :
                                         isIncluded ? "bg-white/70 dark:bg-neutral-800/70 border-transparent hover:border-sky-300/50" :
                                         "bg-transparent border-dashed border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 opacity-60"
                                       )}
                                     >
                                       <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100 pr-6 leading-tight">{lead}</p>
                                       {isIncluded && (
                                         <button className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full text-neutral-500 transition-all" onClick={(e) => {
                                             e.stopPropagation();
                                             setProcessLeads((prev: Record<string, string[]>) => ({
                                                ...prev,
                                                [selectedFolder]: prev[selectedFolder].filter(l => l !== lead)
                                             }));
                                             if (selectedActiveLead === lead) {
                                                 setSelectedActiveLead(null);
                                                 setCardIndex(0);
                                             }
                                         }}>✕</button>
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
                {selectedFolder === 'Closing' && (
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-2">Status</label>
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
      </div>
    );
  }

  return (
    <div className="pb-20">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-8">
        {processFolders.map((folder: string) => (
          <button
            key={folder}
            onClick={() => { setSelectedFolder(folder); setIsContextExpanded(false); }}
            className="group bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md border border-white dark:border-neutral-700 hover:border-sky-200 dark:hover:border-sky-800 rounded-[24px] p-6 text-left aspect-square flex flex-col relative overflow-hidden transition-all active:scale-95 shadow-sm hover:shadow-md"
          >
            <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800 mb-auto flex items-center justify-center text-neutral-500 group-hover:text-sky-500 transition-colors">
               <FolderOpen className="w-5 h-5" />
            </div>
            
            <h3 className="text-lg font-bold leading-tight text-neutral-800 dark:text-neutral-200 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">
              {folder}
            </h3>
            <p className="text-xs font-medium text-neutral-400 mt-1">{folder === 'Positioning' && customCards[folder]?.length ? customCards[folder].length : (CARDS_BY_PROCESS[folder]?.length || 0) + (customCards[folder]?.length || 0)} cards</p>
          </button>
        ))}
      </div>

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
