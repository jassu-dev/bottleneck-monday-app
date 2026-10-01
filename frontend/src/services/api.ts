const getApiBase = (): string => {
  if (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes('localhost')) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return `${window.location.protocol}//${window.location.hostname}:8080`;
  }
  return import.meta.env.VITE_API_URL || 'http://localhost:8080';
};

export const API_BASE = getApiBase();

export interface StuckItem {
  itemId: string;
  boardId: string;
  currentStatus: string;
  timeInStatusHours: number;
  timeInStatusFormatted: string;
  maxSlaHours: number | null;
  slaBreached: boolean;
  slaWarning: boolean;
  breachPercentage: number;
  exceededByHours: number;
  lastStatusChange: string;
  itemName?: string;
  assignee?: string;
}

export interface StatusSummary {
  status: string;
  averageHours: number;
  totalHours: number;
  itemCount: number;
  minHours: number;
  maxHours: number;
}

export interface CycleLeadMetrics {
  averageLeadTimeHours: number;
  averageCycleTimeHours: number;
  completedItemsCount: number;
  fastestLeadTimeHours: number;
  longestLeadTimeHours: number;
}

export interface SLARule {
  id?: string;
  boardId: string;
  statusLabel: string;
  maxDurationHours: number;
  actionType: 'NOTIFY' | 'ESCALATE_STATUS' | 'MOVE_GROUP';
  targetGroupId?: string;
  targetStatus?: string;
  targetRole?: 'ASSIGNEE' | 'MANAGER' | 'TEAM_LEAD';
  active?: boolean;
}

export interface TimeTrackingRule {
  id?: string;
  boardId: string;
  columnId?: string;
  thresholdMinutes: number;
  actionType: 'NOTIFY' | 'ESCALATE_STATUS' | 'MOVE_GROUP';
  targetGroupId?: string;
  targetStatus?: string;
  targetRole?: 'ASSIGNEE' | 'MANAGER' | 'TEAM_LEAD';
  customMessage?: string;
  active?: boolean;
}

// -------------------------------------------------------------
// Analytics API
// -------------------------------------------------------------
export const fetchStuckHub = async (boardId: string): Promise<{
  totalStuckItems: number;
  breachedCount: number;
  warningCount: number;
  items: StuckItem[];
}> => {
  const res = await fetch(`${API_BASE}/api/analytics/${boardId}/stuck-hub`);
  if (!res.ok) throw new Error('Failed to fetch stuck items');
  return res.json();
};

export const fetchTimeInStatus = async (boardId: string): Promise<StatusSummary[]> => {
  const res = await fetch(`${API_BASE}/api/analytics/${boardId}/time-in-status`);
  if (!res.ok) throw new Error('Failed to fetch time in status');
  const data = await res.json();
  return data.data || [];
};

export const fetchCycleLeadTime = async (boardId: string): Promise<CycleLeadMetrics> => {
  const res = await fetch(`${API_BASE}/api/analytics/${boardId}/cycle-lead-time`);
  if (!res.ok) throw new Error('Failed to fetch cycle/lead time metrics');
  const data = await res.json();
  return data.metrics || {
    averageLeadTimeHours: 0,
    averageCycleTimeHours: 0,
    completedItemsCount: 0,
    fastestLeadTimeHours: 0,
    longestLeadTimeHours: 0,
  };
};

export const refreshBoardCache = async (boardId: string): Promise<void> => {
  await fetch(`${API_BASE}/api/analytics/${boardId}/refresh-cache`, { method: 'POST' });
};

// -------------------------------------------------------------
// 1-Click Nudge Action
// -------------------------------------------------------------
export const send1ClickNudge = async (
  itemId: string,
  message?: string,
  assigneeName?: string
): Promise<{ success: boolean; updateId: string }> => {
  const res = await fetch(`${API_BASE}/api/monday/nudge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId, message, assigneeName }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to send nudge');
  }
  return res.json();
};

// -------------------------------------------------------------
// SLA Rules API
// -------------------------------------------------------------
export const fetchSlaRules = async (boardId: string): Promise<SLARule[]> => {
  const res = await fetch(`${API_BASE}/api/slas/${boardId}`);
  if (!res.ok) throw new Error('Failed to fetch SLA rules');
  const data = await res.json();
  return data.rules || [];
};

export const saveSlaRule = async (rule: SLARule): Promise<SLARule> => {
  const res = await fetch(`${API_BASE}/api/slas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rule),
  });
  if (!res.ok) throw new Error('Failed to save SLA rule');
  const data = await res.json();
  return data.rule;
};

export const deleteSlaRule = async (id: string): Promise<void> => {
  const res = await fetch(`${API_BASE}/api/slas/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete SLA rule');
};

// -------------------------------------------------------------
// Time Tracking Automation Rules API
// -------------------------------------------------------------
export const fetchTimeTrackingRules = async (boardId: string): Promise<TimeTrackingRule[]> => {
  const res = await fetch(`${API_BASE}/api/slas/time-tracking/${boardId}`);
  if (!res.ok) throw new Error('Failed to fetch time tracking rules');
  const data = await res.json();
  return data.rules || [];
};

export const saveTimeTrackingRule = async (rule: TimeTrackingRule): Promise<TimeTrackingRule> => {
  const res = await fetch(`${API_BASE}/api/slas/time-tracking`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rule),
  });
  if (!res.ok) throw new Error('Failed to save time tracking rule');
  const data = await res.json();
  return data.rule;
};

// -------------------------------------------------------------
// Background Queue Trigger
// -------------------------------------------------------------
export const triggerQueueScan = async (): Promise<{ jobId: string }> => {
  const res = await fetch(`${API_BASE}/api/slas/trigger-scan`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to trigger scan');
  return res.json();
};
