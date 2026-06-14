export type Lead = {
  id: string;
  company: string;
  contact: string;
  status: 'New' | 'Contacted' | 'Qualified' | 'Proposal' | 'Won' | 'Lost';
  value: number;
  probability: number;
  expectedClose: string;
  leadTimeRisk: 'Low' | 'Medium' | 'High';
};

export type KPI = {
  id: string;
  label: string;
  value: string | number;
  trend: number;
  status: 'good' | 'warning' | 'danger' | 'neutral';
};

export type Campaign = {
  id: string;
  name: string;
  channel: string;
  status: 'Active' | 'Paused' | 'Completed';
  spend: number;
  leads: number;
  roi: number;
};

export type ProductionJob = {
  id: string;
  customer: string;
  partName: string;
  status: 'Scheduled' | 'In Progress' | 'Quality Check' | 'Ready to Ship' | 'Delayed';
  dueDate: string;
  completionPercentage: number;
  machines: string[];
};

export type MarketInsight = {
  id: string;
  title: string;
  type: 'Competitor' | 'Trend' | 'Opportunity' | 'Risk';
  impact: 'High' | 'Medium' | 'Low';
  description: string;
  date: string;
};

export type Message = {
  id: string;
  sender: string;
  preview: string;
  time: string;
  unread: boolean;
};

export type ActionItem = {
  id: string;
  task: string;
  department: string;
  assignees: { name: string; avatar: string }[];
  dueDate: string;
  completed: boolean;
  completedAt?: string;
  completedBy?: { name: string; avatar: string };
  isPending?: boolean;
  time?: string;
};
