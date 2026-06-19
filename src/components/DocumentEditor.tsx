import React, { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useAppContext } from "../AppContext";

interface EditHistoryItem {
  id: string;
  initials: string;
  name: string;
  time: string;
  action: string;
}

export function DocumentEditor({ doc, onClose }: { doc: any; onClose: () => void; key?: string | number }) {
  const { documentStates, setDocumentStates } = useAppContext();
  
  const docState = documentStates[doc.name];

  const docOriginalContent = (() => {
    if (doc.url && doc.url.startsWith("data:text")) {
      return atob(doc.url.split(",")[1]);
    }
    return "Project Beta is a project that aims to improve our overall performance as a company. It will be implemented in three phases:\n\n1. We will focus on increasing our market share in the current markets.\n2. We will expand into new markets.\n3. We will focus on developing new products and services.\n\nThe plan for this quarter is to review the project's progress and identify any risks or issues. In the following weeks, we'll start by gathering feedback from stakeholders on the project's direction. Once we have spoken with our stakeholders, we can build consensus around the project's goals and objectives.\n\nAs the project progresses, we'll identify any changes or updates to the project's scope and develop a plan for how to communicate with stakeholders about the project.";
  })();

  const [content, setContent] = useState(() => {
    return docState ? docState.content : docOriginalContent;
  });

  const [history, setHistory] = useState<EditHistoryItem[]>(() => {
    return docState ? docState.history : [
      {
        id: "1",
        initials: "SJ",
        name: "Susan Johnson",
        time: "Initial Create",
        action: "Uploaded document."
      }
    ];
  });
  
  useEffect(() => {
    setDocumentStates((prev: any) => ({
      ...prev,
      [doc.name]: { content, history }
    }));
  }, [content, history, doc.name, setDocumentStates]);

  const computeDiffLabel = (oldStr: string, newStr: string) => {
    let start = 0;
    while (start < oldStr.length && start < newStr.length && oldStr[start] === newStr[start]) start++;
    let oldEnd = oldStr.length - 1;
    let newEnd = newStr.length - 1;
    while (oldEnd >= start && newEnd >= start && oldStr[oldEnd] === newStr[newEnd]) {
      oldEnd--;
      newEnd--;
    }
    const removedInfo = oldStr.substring(start, oldEnd + 1);
    const addedInfo = newStr.substring(start, newEnd + 1);
    const truncate = (s: string) => s.length > 20 ? s.substring(0, 20) + '...' : s;
    
    if (addedInfo.length === 0 && removedInfo.length === 0) return null;
    if (removedInfo && addedInfo) return `Replaced "${truncate(removedInfo)}" with "${truncate(addedInfo)}"`;
    if (removedInfo) return `Deleted "${truncate(removedInfo)}"`;
    if (addedInfo) return `Added "${truncate(addedInfo)}"`;
    return "Edited document content.";
  };

  const [commentInput, setCommentInput] = useState("");

  const handleAddComment = () => {
    if (!commentInput.trim()) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setHistory(prev => [...prev, {
      id: Math.random().toString(),
      initials: "Y",
      name: "You",
      time: timeStr,
      action: `Added note: "${commentInput}"`
    }]);
    setCommentInput("");
  };

  return (
    <div className="flex-1 lg:flex-[3] flex flex-col xl:flex-row w-full bg-white dark:bg-neutral-900 rounded-[24px] shadow-sm border border-neutral-200 dark:border-neutral-800 overflow-hidden relative min-h-[600px] lg:max-h-[800px] ml-0 xl:ml-6">
      <div className="flex-1 overflow-y-auto p-8 lg:p-12">
         <div className="flex items-center justify-between mb-8 border-b border-neutral-200 dark:border-neutral-800 pb-4">
           <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{doc.name}</h1>
           <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-600 transition bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-full shrink-0 ml-4">
             <X className="w-5 h-5" />
           </button>
         </div>
         
         {doc.googleDocId ? (
           <iframe src={`https://docs.google.com/document/d/${doc.googleDocId}/edit?rm=minimal`} className="w-full h-full min-h-[600px] rounded-xl" />
         ) : doc.url && doc.url.startsWith("data:image") ? (
           <img src={doc.url} alt={doc.name} className="max-w-full rounded-xl shadow-sm" />
         ) : doc.url && doc.url.startsWith("data:application/pdf") ? (
           <embed src={doc.url} width="100%" height="800px" type="application/pdf" className="rounded-xl shadow-sm" />
         ) : (
           <textarea 
            value={content}
            onChange={(e) => {
              const newContent = e.target.value;
              const diffAction = computeDiffLabel(content, newContent);
              
              if (diffAction) {
                const now = new Date();
                const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                setHistory(prev => {
                  const last = prev[prev.length - 1];
                  // Coalesce edits within the same minute if they are simple additions
                  if (last && last.name === "You" && last.time === timeStr && last.action.startsWith("Added") && diffAction.startsWith("Added")) {
                    return [...prev.slice(0, -1), { ...last, action: `Edited text...` }];
                  } else if (last && last.name === "You" && last.time === timeStr && last.action === "Edited text..." && diffAction.startsWith("Added")) {
                    return prev; 
                  }
                  return [...prev, {
                    id: Math.random().toString(),
                    initials: "Y",
                    name: "You",
                    time: timeStr,
                    action: diffAction
                  }];
                });
              }
              setContent(newContent);
            }}
            className="w-full h-full min-h-[600px] bg-transparent max-w-none prose prose-sm dark:prose-invert font-serif text-lg leading-relaxed text-neutral-800 dark:text-neutral-200 outline-none focus:ring-2 focus:ring-sky-500/50 p-4 rounded-xl transition whitespace-pre-wrap resize-none" 
           />
         )}
      </div>

      {!doc.googleDocId && (
        <div className="w-full xl:w-[320px] bg-neutral-50 dark:bg-neutral-800/50 border-t xl:border-t-0 xl:border-l border-neutral-200 dark:border-neutral-800 p-6 flex flex-col shrink-0 min-h-[300px]">
           <h4 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-6">Edit History</h4>
           
           <div className="flex flex-col gap-4 flex-1 overflow-y-auto pr-2 min-h-0">
              {history.map(item => (
                <div key={item.id} className="bg-white dark:bg-neutral-800 p-4 rounded-xl shadow-sm border border-neutral-200/60 dark:border-neutral-700/60">
                   <div className="flex justify-between items-start mb-2">
                     <div className="flex items-center gap-2">
                       <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700 shrink-0">
                         {item.initials}
                       </div>
                       <div className="text-xs font-bold text-neutral-700 dark:text-neutral-300">{item.name}</div>
                     </div>
                     <div className="text-[10px] text-neutral-400 whitespace-nowrap ml-2">{item.time}</div>
                   </div>
                   <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed font-medium">
                     {item.action}
                   </p>
                 </div>
              ))}
           </div>
  
           <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800 shrink-0">
             <div className="flex items-center gap-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 p-2 rounded-xl focus-within:ring-2 focus-within:ring-sky-500/50">
               <input value={commentInput} onChange={e => setCommentInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(); }} type="text" placeholder="Add note..." className="flex-1 w-full bg-transparent text-sm px-2 py-1 outline-none dark:text-white" />
               <button onClick={handleAddComment} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap">
                 Add
               </button>
             </div>
           </div>
        </div>
      )}
    </div>
  );
}
