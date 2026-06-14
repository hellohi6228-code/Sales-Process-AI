import { Lead, KPI, Campaign, ProductionJob, MarketInsight, Message, ActionItem } from '../types';

export const EXAC_KPIS: KPI[] = [
  { id: '1', label: 'Qualified Leads', value: '142', trend: 12.5, status: 'good' },
  { id: '2', label: 'Proposal Acceptance', value: '48%', trend: 5.2, status: 'good' },
  { id: '3', label: 'Closing', value: '32%', trend: -2.1, status: 'warning' },
  { id: '4', label: 'Referral', value: '8', trend: 1.1, status: 'good' },
];

export const SALES_LEADS: Lead[] = [
  { id: 'L-101', company: 'Titan Aerospace', contact: 'Sarah Jenkins', status: 'Proposal', value: 850000, probability: 75, expectedClose: '2026-06-15', leadTimeRisk: 'High' },
  { id: 'L-102', company: 'Nova Robotics', contact: 'David Chu', status: 'Qualified', value: 320000, probability: 60, expectedClose: '2026-06-22', leadTimeRisk: 'Low' },
  { id: 'L-103', company: 'Apex Medical', contact: 'Maria Garcia', status: 'Contacted', value: 150000, probability: 30, expectedClose: '2026-07-10', leadTimeRisk: 'Medium' },
  { id: 'L-104', company: 'Quantum Motors', contact: 'James Wilson', status: 'Won', value: 1200000, probability: 100, expectedClose: '2026-06-01', leadTimeRisk: 'Low' },
  { id: 'L-105', company: 'Starlight Energy', contact: 'Emily Chen', status: 'Qualified', value: 540000, probability: 45, expectedClose: '2026-07-28', leadTimeRisk: 'Medium' },
];

export const MARKETING_CAMPAIGNS: Campaign[] = [
  { id: 'C-01', name: 'Q3 Defense Contractor Outreach', channel: 'LinkedIn', status: 'Active', spend: 12500, leads: 42, roi: 310 },
  { id: 'C-02', name: 'Precision Machining Webinar', channel: 'Email', status: 'Active', spend: 3500, leads: 128, roi: 0 }, // ROI 0 until closed
  { id: 'C-03', name: 'Trade Show Follow-up', channel: 'Multi', status: 'Completed', spend: 8000, leads: 215, roi: 450 },
  { id: 'C-04', name: 'Medical Device Manufacturing Guide', channel: 'Google Ads', status: 'Paused', spend: 4200, leads: 18, roi: 85 },
];

export const PRODUCTION_JOBS: ProductionJob[] = [
  { id: 'J-8820', customer: 'Quantum Motors', partName: 'EV Battery Housings', status: 'In Progress', dueDate: '2026-06-18', completionPercentage: 65, machines: ['CNC-04', 'CNC-05'] },
  { id: 'J-8821', customer: 'Titan Aerospace', partName: 'Turbine Blades (Titanium)', status: 'Delayed', dueDate: '2026-06-12', completionPercentage: 40, machines: ['Milling-02'] },
  { id: 'J-8822', customer: 'Apex Medical', partName: 'Surgical Instrument Handles', status: 'Quality Check', dueDate: '2026-06-08', completionPercentage: 95, machines: ['Lathe-01'] },
  { id: 'J-8823', customer: 'Nova Robotics', partName: 'Actuator Casings', status: 'Scheduled', dueDate: '2026-06-25', completionPercentage: 0, machines: ['CNC-01', 'CNC-03'] },
];

export const MARKET_INSIGHTS: MarketInsight[] = [
  { id: 'MI-1', title: 'Competitor Expansion', type: 'Competitor', impact: 'High', description: 'Acme Machining announced a new 50,000 sq ft facility in Ohio, potentially impacting mid-west market share.', date: '2026-06-02' },
  { id: 'MI-2', title: 'Raw Material Shortage', type: 'Risk', impact: 'High', description: 'Global shortage of aerospace-grade aluminum projected for Q4. Action recommended: Secure contracts early.', date: '2026-06-01' },
  { id: 'MI-3', title: 'DoD Grant Funding', type: 'Opportunity', impact: 'Medium', description: 'New $500M grant pool opened for domestic semiconductor supply chain manufacturers.', date: '2026-05-28' },
];

export const MESSAGES: Message[] = [
  { id: 'M-1', sender: 'Production Desk (System)', preview: 'Material delay for Titan Aerospace (J-8821). Rescheduling recommended.', time: '10:45 AM', unread: true },
  { id: 'M-2', sender: 'Sales Assistant', preview: 'Follow-up suggested for Nova Robotics based on email activity today.', time: '09:30 AM', unread: true },
  { id: 'M-3', sender: 'Sarah (Marketing)', preview: 'The new campaign copy is ready for review.', time: 'Yesterday', unread: false },
];

export const TEAM_MEMBERS = [
  { id: 'TM-1', name: 'Sarah Jenkins', role: 'Sales Lead', avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Sarah&backgroundColor=transparent' },
  { id: 'TM-2', name: 'Michael Chen', role: 'Procurement', avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Michael&backgroundColor=transparent' },
  { id: 'TM-3', name: 'Alex Thompson', role: 'Engineering', avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Alex&backgroundColor=transparent' },
  { id: 'TM-4', name: 'David Chu', role: 'Compliance', avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=David&backgroundColor=transparent' },
  { id: 'TM-5', name: 'Elena Rodriguez', role: 'Marketing', avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Elena&backgroundColor=transparent' }
];

export const ACTION_ITEMS: ActionItem[] = [
  { 
    id: 'A-1', 
    task: 'Review Titan SLA terms',
    department: 'Legal',
    assignees: [{ name: 'Sarah J.', avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Sarah&backgroundColor=transparent' }], 
    dueDate: 'Today', 
    completed: false 
  },
  { 
    id: 'A-2', 
    task: 'Approve Titanium Q3 budget',
    department: 'Procurement',
    assignees: [{ name: 'Michael C.', avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Michael&backgroundColor=transparent' }], 
    dueDate: 'Tomorrow', 
    completed: false 
  },
  { 
    id: 'A-3', 
    task: 'Update CAD specs for Apex',
    department: 'Engineering',
    assignees: [{ name: 'Alex T.', avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Alex&backgroundColor=transparent' }, { name: 'David C.', avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=David&backgroundColor=transparent' }], 
    dueDate: '2026-06-07', 
    completed: false 
  },
  {
    id: 'A-4',
    task: 'Finalize DoD proposal draft',
    department: 'Sales',
    assignees: [{ name: 'Elena R.', avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Elena&backgroundColor=transparent' }],
    dueDate: 'Unscheduled',
    completed: true,
    completedAt: 'Today',
    completedBy: { name: 'Elena R.', avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Elena&backgroundColor=transparent' }
  },
  {
    id: 'A-5',
    task: 'Audit Q2 Compliance Logs',
    department: 'Compliance',
    assignees: [{ name: 'David C.', avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=David&backgroundColor=transparent' }],
    dueDate: 'Unscheduled',
    completed: false
  }
];

// Recharts Dummy Data
export const REVENUE_DATA = [
  { name: 'Jan', value: 4000, target: 4000 },
  { name: 'Feb', value: 3000, target: 4200 },
  { name: 'Mar', value: 5500, target: 4500 },
  { name: 'Apr', value: 4200, target: 4800 },
  { name: 'May', value: 6000, target: 5000 },
  { name: 'Jun', value: 7500, target: 5200 },
];

export const PIPELINE_DATA = [
  { name: 'Jan', value: 12000, target: 10000 },
  { name: 'Feb', value: 13500, target: 11000 },
  { name: 'Mar', value: 13000, target: 12000 },
  { name: 'Apr', value: 14800, target: 13000 },
  { name: 'May', value: 16500, target: 14000 },
  { name: 'Jun', value: 19000, target: 15000 },
];

export const HIT_RATE_DATA = [
  { name: 'Jan', value: 18, target: 20 },
  { name: 'Feb', value: 20, target: 20 },
  { name: 'Mar', value: 21, target: 20 },
  { name: 'Apr', value: 22, target: 20 },
  { name: 'May', value: 24, target: 20 },
  { name: 'Jun', value: 24, target: 20 },
];

export const UTILIZATION_DATA = [
  { name: 'Jan', value: 85, target: 90 },
  { name: 'Feb', value: 88, target: 90 },
  { name: 'Mar', value: 82, target: 90 },
  { name: 'Apr', value: 89, target: 90 },
  { name: 'May', value: 92, target: 90 },
  { name: 'Jun', value: 88, target: 90 },
];

export const DELIVERY_DATA = [
  { name: 'Jan', value: 92, target: 95 },
  { name: 'Feb', value: 94, target: 95 },
  { name: 'Mar', value: 91, target: 95 },
  { name: 'Apr', value: 95, target: 95 },
  { name: 'May', value: 93, target: 95 },
  { name: 'Jun', value: 96, target: 95 },
];
