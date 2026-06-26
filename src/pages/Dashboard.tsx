import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { EXAC_KPIS, PIPELINE_DATA, HIT_RATE_DATA, UTILIZATION_DATA, DELIVERY_DATA, ACTION_ITEMS } from '../data/mockData';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CheckCircle2, Circle, ChevronDown, GripVertical, FolderOpen } from 'lucide-react';
import { cn } from '../lib/utils';
import { Modal } from '../components/ui/Modal';
import { KPI, ActionItem } from '../types';
import { useAppContext } from '../AppContext';
import { Plus, Mail } from 'lucide-react';
import { shareFolderWithEmail, revokeFolderAccessForEmail, syncFolderStructure } from '../lib/googleDrive';
import { sendInviteEmail } from '../lib/gmail';

export function Dashboard() {
  const {
    processFolders, leadFolders, folderAccess, setFolderAccess,
    teamMembers, inviteTeamMember, reportGoogleError, session,
    processLeads, proposalThreads, customCardsProcess: customCards,
  } = useAppContext();
  const [selectedKpi, setSelectedKpi] = useState<KPI | null>(null);
  const [activeGraph, setActiveGraph] = useState<'Qualified Leads' | 'Proposal Acceptance' | 'Closing' | 'Referral'>('Qualified Leads');

  // --- REAL-TIME KPIS CALCULATIONS ---
  const qualifiedLeadsList = React.useMemo(() => {
    const qualifiedStages = [
      'Qualifying', 'Discovery', 'Solution Design', 'Business Case',
      'Proposal', 'Closing', 'Objection Handling', 'Onboarding', 'Referral'
    ];
    const uniqueLeads = new Set<string>();
    qualifiedStages.forEach(stage => {
      const leads = (processLeads || {})[stage] || [];
      leads.forEach(l => uniqueLeads.add(l));
    });
    return Array.from(uniqueLeads);
  }, [processLeads]);

  const qualifiedCount = qualifiedLeadsList.length;

  const proposedCount = React.useMemo(() => {
    const proposedLeads = (processLeads || {})["Proposal"] || [];
    const threadLeads = Object.keys(proposalThreads || {});
    const uniqueProposed = new Set([...proposedLeads, ...threadLeads]);
    return uniqueProposed.size;
  }, [processLeads, proposalThreads]);

  const acceptedCount = React.useMemo(() => {
    const signedProposals = (customCards || {})["signed proposal"] || [];
    const signedLeads = signedProposals.map((c: any) => c.lead);
    const onboardingLeads = (processLeads || {})["Onboarding"] || [];
    const referralLeads = (processLeads || {})["Referral"] || [];
    const uniqueAccepted = new Set([...signedLeads, ...onboardingLeads, ...referralLeads]);
    return uniqueAccepted.size;
  }, [customCards, processLeads]);

  const acceptanceRate = proposedCount > 0 ? Math.min(100, Math.round((acceptedCount / proposedCount) * 100)) : 0;

  const closingRate = React.useMemo(() => {
    const totalLeadsCount = (leadFolders || []).length;
    const onboardingLeads = (processLeads || {})["Onboarding"] || [];
    const referralLeads = (processLeads || {})["Referral"] || [];
    const wonLeads = new Set([...onboardingLeads, ...referralLeads]);
    return totalLeadsCount > 0 ? Math.min(100, Math.round((wonLeads.size / totalLeadsCount) * 100)) : 0;
  }, [leadFolders, processLeads]);

  const referralCount = (processLeads || {})["Referral"]?.length || 0;

  const kpis = React.useMemo(() => [
    { id: '1', label: 'Qualified Leads', value: String(qualifiedCount), trend: 12.5, status: 'good' },
    { id: '2', label: 'Proposal Acceptance', value: `${acceptanceRate}%`, trend: 5.2, status: 'good' },
    { id: '3', label: 'Closing', value: `${closingRate}%`, trend: -2.1, status: closingRate > 30 ? 'good' : 'warning' },
    { id: '4', label: 'Referral', value: String(referralCount), trend: 1.1, status: 'good' },
  ], [qualifiedCount, acceptanceRate, closingRate, referralCount]);

  const [folderView, setFolderView] = useState<'Process' | 'Lead'>('Process');

  // Tap-to-assign (mobile fallback for native HTML5 drag-and-drop, which doesn't fire on touch)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  // Which member's name/email/remove popover is currently open (hover on desktop, tap on mobile)
  const [activeMemberPopover, setActiveMemberPopover] = useState<string | null>(null);

  // Invite teammate modal
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const assignMemberToFolder = async (memberId: string, folderName: string) => {
    const member = teamMembers.find((m: any) => m.id === memberId);
    if (!member) return;

    setFolderAccess((prev: any) => {
      const currentViewAccess = prev[folderView]?.[folderName] || [];
      if (currentViewAccess.includes(memberId)) return prev;
      return {
        ...prev,
        [folderView]: {
          ...prev[folderView],
          [folderName]: [...currentViewAccess, memberId],
        },
      };
    });

    if (member.email) {
      try {
        const folderId = await syncFolderStructure(folderName, folderView === 'Lead' ? 'LEAD' : 'PROCESS');
        await shareFolderWithEmail(folderId, member.email, 'writer');
      } catch (e) {
        console.error('Failed to share Drive folder:', e);
        reportGoogleError?.(e, `Failed to share "${folderName}" with ${member.email}`);
      }
    }
  };

  const removeMemberFromFolder = async (memberId: string, folderName: string) => {
    const member = teamMembers.find((m: any) => m.id === memberId);

    setFolderAccess((prev: any) => ({
      ...prev,
      [folderView]: {
        ...prev[folderView],
        [folderName]: (prev[folderView]?.[folderName] || []).filter((id: string) => id !== memberId),
      },
    }));

    if (member?.email) {
      try {
        const folderId = await syncFolderStructure(folderName, folderView === 'Lead' ? 'LEAD' : 'PROCESS');
        await revokeFolderAccessForEmail(folderId, member.email);
      } catch (e) {
        console.error('Failed to revoke Drive access:', e);
        reportGoogleError?.(e, `Failed to revoke access for ${member.email}`);
      }
    }
  };

  const handleDropToFolder = (e: React.DragEvent<HTMLDivElement>, folderName: string) => {
    e.preventDefault();
    const memberId = e.dataTransfer.getData('memberId');
    if (memberId) {
      assignMemberToFolder(memberId, folderName);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setIsInviting(true);
    try {
      const inviterEmail = session?.user?.email || localStorage.getItem('user_email') || 'A teammate';
      try {
        await sendInviteEmail({
          to: inviteEmail,
          inviteName: inviteName || 'Teammate',
          inviterEmail,
        });
      } catch (err) {
        console.error('Failed to send email invite:', err);
        reportGoogleError?.(err, 'Failed to send email invitation');
      }

      // Just adds them to the team pool. No Drive access is granted here —
      // access is only granted per-folder, via tap-to-assign or drag-and-drop below.
      inviteTeamMember(inviteName || inviteEmail, inviteEmail);
      setInviteName('');
      setInviteEmail('');
      setIsInviteModalOpen(false);
    } finally {
      setIsInviting(false);
    }
  };

  const getGraphData = () => {
    if (activeGraph === 'Proposal Acceptance') {
      return [
        { name: 'Jan', value: 40, target: 50 },
        { name: 'Feb', value: 42, target: 50 },
        { name: 'Mar', value: 45, target: 50 },
        { name: 'Apr', value: 48, target: 50 },
        { name: 'May', value: 50, target: 50 },
        { name: 'Jun', value: acceptanceRate, target: 50 },
      ];
    }
    if (activeGraph === 'Closing') {
      return [
        { name: 'Jan', value: 25, target: 35 },
        { name: 'Feb', value: 28, target: 35 },
        { name: 'Mar', value: 30, target: 35 },
        { name: 'Apr', value: 32, target: 35 },
        { name: 'May', value: 35, target: 35 },
        { name: 'Jun', value: closingRate, target: 35 },
      ];
    }
    if (activeGraph === 'Referral') {
      return [
        { name: 'Jan', value: 2, target: 8 },
        { name: 'Feb', value: 3, target: 8 },
        { name: 'Mar', value: 4, target: 8 },
        { name: 'Apr', value: 5, target: 8 },
        { name: 'May', value: 6, target: 8 },
        { name: 'Jun', value: referralCount, target: 8 },
      ];
    }
    return [
      { name: 'Jan', value: 5, target: 15 },
      { name: 'Feb', value: 8, target: 15 },
      { name: 'Mar', value: 12, target: 15 },
      { name: 'Apr', value: 15, target: 15 },
      { name: 'May', value: 18, target: 15 },
      { name: 'Jun', value: qualifiedCount, target: 15 },
    ];
  };

  const getGraphColors = () => {
    if (activeGraph === 'Proposal Acceptance') return ['#10b981', '#34d399'];
    if (activeGraph === 'Closing') return ['#f59e0b', '#fbbf24'];
    if (activeGraph === 'Referral') return ['#8b5cf6', '#a78bfa'];
    return ['#3b82f6', '#60a5fa'];
  };

  const downloadJsonData = () => {
    const exportData = {
      kpis: kpis,
      pipelineData: getGraphData(),
      hitRateData: getGraphData(),
      utilizationData: getGraphData(),
      deliveryData: getGraphData()
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "platform_data.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-end">
        <div className="flex space-x-3">
          <button onClick={downloadJsonData} className="bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md border border-white/60 dark:border-white/10 text-neutral-700 dark:text-neutral-300 px-5 py-2.5 rounded-xl text-sm font-medium hover:border-blue-300 hover:shadow-md active:scale-95 transition-all shadow-[0_2px_10px_rgb(0,0,0,0.02)]">Export</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card 
            key={kpi.id} 
            className={cn("cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group", activeGraph === kpi.label && "border-blue-500 shadow-sm")}
            onClick={() => {
              setActiveGraph(kpi.label as any);
              setSelectedKpi(kpi);
            }}
          >
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className={cn("text-sm font-medium truncate transition-colors", activeGraph === kpi.label ? "text-blue-600 dark:text-blue-400" : "text-neutral-500 dark:text-neutral-400 group-hover:text-blue-600 dark:group-hover:text-blue-400")}>{kpi.label}</p>
                <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">{kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="relative inline-flex items-center group cursor-pointer">
              <CardTitle className="mr-1">{activeGraph}</CardTitle>
              <ChevronDown className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity text-neutral-400" />
              <select 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                value={activeGraph}
                onChange={(e) => setActiveGraph(e.target.value as any)}
              >
                <option value="Qualified Leads">Qualified Leads</option>
                <option value="Proposal Acceptance">Proposal Acceptance</option>
                <option value="Closing">Closing</option>
                <option value="Referral">Referral</option>
              </select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={getGraphData()} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={getGraphColors()[0]} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={getGraphColors()[0]} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis 
                    stroke="#888888" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => activeGraph === 'Qualified Leads' || activeGraph === 'Referral' ? `${value}` : `${value}%`} 
                    domain={activeGraph === 'Proposal Acceptance' ? [15, 60] : activeGraph === 'Closing' ? [10, 50] : activeGraph === 'Referral' ? [0, 20] : ['auto', 'auto']}
                  />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" opacity={0.2} />
                  <Tooltip cursor={false} contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb', color: '#111827', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Area type="monotone" dataKey="value" stroke={getGraphColors()[0]} strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                  <Area type="monotone" dataKey="target" stroke={getGraphColors()[1]} strokeWidth={2} strokeDasharray="5 5" fill="none" opacity={activeGraph === 'Qualified Leads' ? 1 : 0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 lg:col-span-3 flex flex-col h-auto">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b-0">
            <CardTitle>Team access</CardTitle>
            <div className="flex bg-white/40 dark:bg-neutral-800/40 backdrop-blur-md rounded-lg p-1 space-x-1 shadow-sm">
              {(['Process', 'Lead'] as const).map(view => (
                <button
                  key={view}
                  onClick={() => setFolderView(view)}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center justify-center",
                    folderView === view ? "bg-white dark:bg-neutral-700 text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                  )}
                >
                  {view}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="px-0 flex-1 flex flex-col md:flex-row border-t border-black/5 mt-2">
            
            {/* Team Pool */}
            <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-black/5 p-5 bg-white/30">
              <h3 className="font-semibold text-sm mb-1 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  Team Pool
                  <span className="bg-white shadow-sm text-xs px-2 py-0.5 rounded-md border border-neutral-200">{teamMembers.length}</span>
                </span>
                <button
                  onClick={() => setIsInviteModalOpen(true)}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-neutral-200 shadow-sm hover:bg-neutral-50 transition"
                  aria-label="Invite teammate"
                >
                  <Plus className="w-4 h-4 text-neutral-600" />
                </button>
              </h3>
              <p className="text-[11px] text-neutral-400 mb-4">
                Tap a teammate, then tap a folder to grant access. (Drag works on desktop too.)
              </p>
              <div className="space-y-3 min-h-[300px] rounded-xl transition-colors">
                {teamMembers.map((member: any) => (
                  <div 
                     key={member.id} 
                     draggable 
                     onDragStart={(e) => e.dataTransfer.setData('memberId', member.id)}
                     onClick={() => setSelectedMemberId((prev) => (prev === member.id ? null : member.id))}
                     className={cn(
                       "bg-white/80 border p-3.5 rounded-xl shadow-sm backdrop-blur-md cursor-grab active:cursor-grabbing hover:bg-white transition-all group relative overflow-hidden text-left",
                       selectedMemberId === member.id ? "border-sky-400 ring-2 ring-sky-300" : "border-white/60"
                     )}
                  >
                     <div className={cn("absolute left-0 top-0 bottom-0 w-1 transition-colors", selectedMemberId === member.id ? "bg-sky-400" : "bg-sky-200 group-hover:bg-sky-400")} />
                     <div className="flex gap-2.5 items-center pl-2">
                       <GripVertical className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                       <img src={member.avatar} alt={member.name} className="w-8 h-8 rounded-full border border-neutral-200 bg-neutral-50" />
                       <div className="flex-1 min-w-0">
                         <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{member.name}</p>
                         <p className="text-xs text-neutral-500 truncate">{member.email || member.role}</p>
                       </div>
                     </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Folders View */}
            <div className="w-full md:w-2/3 p-5">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-max content-start">
                {(folderView === 'Process' ? processFolders : leadFolders).map((folder: string) => {
                  const membersWithAccess = (folderAccess[folderView]?.[folder] || []).map(
                    (id: string) => teamMembers.find((m: any) => m.id === id)
                  ).filter(Boolean);

                  return (
                    <div 
                      key={folder} 
                      className="bg-white/40 dark:bg-neutral-800/40 rounded-2xl p-4 border border-white/40 dark:border-neutral-700 flex flex-col transition-colors min-h-[120px]"
                      onClick={() => {
                        if (selectedMemberId) {
                          assignMemberToFolder(selectedMemberId, folder);
                          setSelectedMemberId(null);
                        }
                      }}
                      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-white/70', 'dark:bg-neutral-800/70', 'border-sky-300'); }}
                      onDragLeave={(e) => e.currentTarget.classList.remove('bg-white/70', 'dark:bg-neutral-800/70', 'border-sky-300')}
                      onDrop={(e) => { 
                         e.preventDefault(); 
                         e.currentTarget.classList.remove('bg-white/70', 'dark:bg-neutral-800/70', 'border-sky-300');
                         handleDropToFolder(e, folder); 
                      }}
                    >
                       <h4 className="text-sm font-semibold tracking-tight text-neutral-800 dark:text-neutral-200 mb-2 truncate flex items-center gap-2">
                         <FolderOpen className="w-4 h-4 text-sky-500 flex-shrink-0" />
                         {folder}
                       </h4>
                       <div className="flex-1 min-h-[40px] flex items-end">
                          {membersWithAccess.length > 0 ? (
                            <div className="flex -space-x-2 mt-auto">
                              {membersWithAccess.map((member: any, idx: number) => {
                                 const key = `${folder}-${member?.id}`;
                                 const isOpen = activeMemberPopover === key;

                                 return (
                                   <div key={idx} className="relative">
                                     <img
                                       src={member?.avatar}
                                       alt={member?.name}
                                       onMouseEnter={() => setActiveMemberPopover(key)}
                                       onMouseLeave={() => setActiveMemberPopover((prev) => (prev === key ? null : prev))}
                                       onClick={(e) => {
                                         e.preventDefault();
                                         e.stopPropagation();
                                         setActiveMemberPopover((prev) => (prev === key ? null : key));
                                       }}
                                       className="inline-block w-8 h-8 rounded-full border-2 border-white dark:border-neutral-900 bg-white/50 cursor-pointer"
                                     />
                                     {isOpen && (
                                       <div
                                         className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg p-3 z-50 text-left"
                                         onClick={(e) => e.stopPropagation()}
                                       >
                                         <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">{member?.name}</p>
                                         <p className="text-[11px] text-neutral-500 truncate mb-2">{member?.email}</p>
                                         <button
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             removeMemberFromFolder(member?.id, folder);
                                             setActiveMemberPopover(null);
                                           }}
                                           className="w-full text-[11px] font-bold text-red-500 hover:text-red-600 border border-red-200 hover:bg-red-50 rounded-lg py-1.5 transition"
                                         >
                                           Remove access
                                         </button>
                                       </div>
                                     )}
                                   </div>
                                 );
                               })}
                            </div>
                          ) : (
                            <span className="text-xs text-neutral-400 mt-auto">No access granted</span>
                          )}
                       </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title="Invite Teammate"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-2">Name</label>
            <input
              type="text"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="Jane Doe"
              className="w-full p-3 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 transition-shadow"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-2">Gmail address</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="jane@gmail.com"
              className="w-full p-3 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 transition-shadow"
            />
          </div>
          <p className="text-xs text-neutral-400">
            They'll be added to your team pool only. Tap or drag them onto a specific folder afterward to grant edit access to just that folder.
          </p>
          <button
            disabled={isInviting || !inviteEmail}
            onClick={handleInvite}
            className="w-full py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold rounded-xl text-sm transition-transform active:scale-95 shadow-sm hover:shadow disabled:opacity-50"
          >
            {isInviting ? 'Inviting...' : 'Invite'}
          </button>
        </div>
      </Modal>

      <Modal 
        isOpen={!!selectedKpi} 
        onClose={() => setSelectedKpi(null)} 
        title={`${selectedKpi?.label} - Details`}
        className="sm:max-w-2xl"
      >
        <div className="space-y-6">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Calculation Explanation</h4>
            <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
              {selectedKpi?.label === 'Qualified Leads' && (
                `Calculated dynamically by counting the unique prospect folders that have progressed to the 'Qualifying' stage or any stage beyond. Currently, ${qualifiedCount} out of ${leadFolders.length} leads in your system are qualified.`
              )}
              {selectedKpi?.label === 'Proposal Acceptance' && (
                `Calculated by comparing the number of unique signed proposals against the total number of proposals sent via Gmail or logged in the 'Proposal' stage. Currently, ${acceptedCount} out of ${proposedCount} proposals have been signed and accepted (${acceptanceRate}% rate).`
              )}
              {selectedKpi?.label === 'Closing' && (
                `Calculated as the percentage of your total registered prospects that have reached 'Onboarding' or 'Referral' (the closed-won stages of the sales process). Currently, ${acceptedCount} out of ${leadFolders.length} prospects are closed-won (${closingRate}% rate).`
              )}
              {selectedKpi?.label === 'Referral' && (
                `Calculated as the total number of customer accounts currently engaged in the 'Referral' collection process. Currently, you have ${referralCount} active referrable accounts.`
              )}
            </p>
          </div>
          
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Data Source</h4>
            <span className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors">
              Google Drive: LEAD & PROCESS Folder structures (Real-time Sync)
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Metric Type</h4>
              <p className="text-sm font-mono text-neutral-700 dark:text-neutral-300">
                {selectedKpi?.label === 'Qualified Leads' || selectedKpi?.label === 'Referral' ? 'Count (Total)' : 'Rate (Percentage)'}
              </p>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Assumptions</h4>
              <ul className="list-disc list-inside text-sm text-neutral-700 dark:text-neutral-300 space-y-1">
                <li>Drive folder synchronization is fully complete</li>
                <li>Proposal threads track all outbound client loops</li>
              </ul>
            </div>
          </div>
          
          <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Recalculate</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-2">Context</label>
                <textarea 
                  className="w-full h-24 p-3 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 resize-none transition-shadow"
                  placeholder="E.g., Factor in a 10% material cost increase for Q3..."
                ></textarea>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-2">Attach Supporting Documentation (.csv, .xlsx)</label>
                <div className="flex items-center">
                  <input type="file" className="block w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200 transition-all cursor-pointer" />
                </div>
              </div>
              
              <button className="w-full py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold rounded-xl text-sm transition-transform active:scale-95 shadow-sm hover:shadow">
                Update Calculation
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
