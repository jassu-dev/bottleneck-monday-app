import React, { useEffect, useState, useCallback } from 'react';
import './App.css';
import { Header } from './components/Header';
import { KpiCards } from './components/KpiCards';
import { StuckHubTable } from './components/StuckHubTable';
import { TimeInStatusChart } from './components/TimeInStatusChart';
import { SlaSettingsModal } from './components/SlaSettingsModal';
import { TimeTrackingAutomations } from './components/TimeTrackingAutomations';
import {
  StuckItem,
  StatusSummary,
  CycleLeadMetrics,
  SLARule,
  fetchStuckHub,
  fetchTimeInStatus,
  fetchCycleLeadTime,
  fetchSlaRules,
} from './services/api';
import { getMondayContext, listenToContext } from './services/mondaySdk';
import { AlertTriangle, BarChart3, Settings2, Timer } from 'lucide-react';

export const App: React.FC = () => {
  const [boardId, setBoardId] = useState<string>('12345678');
  const [backendStatus, setBackendStatus] = useState<string>('Connecting...');
  const [activeTab, setActiveTab] = useState<'stuck-hub' | 'analytics' | 'sla-rules' | 'time-tracking'>('stuck-hub');

  // State
  const [stuckItems, setStuckItems] = useState<StuckItem[]>([]);
  const [breachedCount, setBreachedCount] = useState<number>(0);
  const [warningCount, setWarningCount] = useState<number>(0);
  const [statusSummaries, setStatusSummaries] = useState<StatusSummary[]>([]);
  const [cycleLeadMetrics, setCycleLeadMetrics] = useState<CycleLeadMetrics>({
    averageLeadTimeHours: 0,
    averageCycleTimeHours: 0,
    completedItemsCount: 0,
    fastestLeadTimeHours: 0,
    longestLeadTimeHours: 0,
  });
  const [slaRules, setSlaRules] = useState<SLARule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // 1. Initialize Monday SDK Context
  useEffect(() => {
    getMondayContext().then((ctx) => {
      if (ctx.boardId) {
        setBoardId(String(ctx.boardId));
      }
    });

    listenToContext((ctx) => {
      if (ctx.boardId) {
        setBoardId(String(ctx.boardId));
      }
    });
  }, []);

  // 2. Fetch Board Data from Backend
  const loadBoardData = useCallback(async (currentBoardId: string) => {
    setLoading(true);
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';

    try {
      // Health check backend
      const healthRes = await fetch(`${apiUrl}/health`);
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        setBackendStatus(`Connected (${healthData.service})`);
      } else {
        setBackendStatus('Degraded');
      }

      // Fetch all metrics concurrently
      const [hubData, statusData, cycleData, rulesData] = await Promise.allSettled([
        fetchStuckHub(currentBoardId),
        fetchTimeInStatus(currentBoardId),
        fetchCycleLeadTime(currentBoardId),
        fetchSlaRules(currentBoardId),
      ]);

      if (hubData.status === 'fulfilled') {
        setStuckItems(hubData.value.items || []);
        setBreachedCount(hubData.value.breachedCount || 0);
        setWarningCount(hubData.value.warningCount || 0);
      }
      if (statusData.status === 'fulfilled') {
        setStatusSummaries(statusData.value || []);
      }
      if (cycleData.status === 'fulfilled') {
        setCycleLeadMetrics(cycleData.value);
      }
      if (rulesData.status === 'fulfilled') {
        setSlaRules(rulesData.value || []);
      }
    } catch (err: any) {
      console.warn('Backend connection issue:', err.message);
      setBackendStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBoardData(boardId);
  }, [boardId, loadBoardData]);

  return (
    <div className="app-container">
      {/* Monday Vibe Header */}
      <Header
        boardId={boardId}
        onBoardChange={(id) => setBoardId(id)}
        onRefresh={() => loadBoardData(boardId)}
        backendStatus={backendStatus}
      />

      {/* Navigation Tabs */}
      <nav className="tabs-nav">
        <button
          className={`tab-btn ${activeTab === 'stuck-hub' ? 'active' : ''}`}
          onClick={() => setActiveTab('stuck-hub')}
        >
          <AlertTriangle size={16} />
          The Bottleneck Hub
          {breachedCount > 0 && (
            <span
              style={{
                background: 'var(--danger-color)',
                color: '#fff',
                fontSize: '0.7rem',
                padding: '1px 6px',
                borderRadius: '10px',
                fontWeight: 700,
              }}
            >
              {breachedCount}
            </span>
          )}
        </button>

        <button
          className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <BarChart3 size={16} />
          Time in Status & Cycle Time
        </button>

        <button
          className={`tab-btn ${activeTab === 'sla-rules' ? 'active' : ''}`}
          onClick={() => setActiveTab('sla-rules')}
        >
          <Settings2 size={16} />
          SLA Configuration
        </button>

        <button
          className={`tab-btn ${activeTab === 'time-tracking' ? 'active' : ''}`}
          onClick={() => setActiveTab('time-tracking')}
        >
          <Timer size={16} />
          Time Tracking Automations
          <span className="app-badge" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
            New
          </span>
        </button>
      </nav>

      {/* Main Content Body */}
      <main className="main-content">
        {loading && (
          <div style={{ textAlign: 'center', padding: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Updating metrics in real-time...
          </div>
        )}

        {/* Executive KPI Overview Cards */}
        <KpiCards
          breachedCount={breachedCount}
          warningCount={warningCount}
          cycleLeadMetrics={cycleLeadMetrics}
        />

        {/* Tab 1: The Bottleneck Hub Table with 1-Click Nudge */}
        {activeTab === 'stuck-hub' && (
          <StuckHubTable
            items={stuckItems}
            onRefresh={() => loadBoardData(boardId)}
          />
        )}

        {/* Tab 2: Visual Distribution of Time in Status */}
        {activeTab === 'analytics' && (
          <TimeInStatusChart statusSummaries={statusSummaries} />
        )}

        {/* Tab 3: SLA Duration Manager */}
        {activeTab === 'sla-rules' && (
          <SlaSettingsModal
            boardId={boardId}
            rules={slaRules}
            onRefresh={() => loadBoardData(boardId)}
          />
        )}

        {/* Tab 4: Time Tracking Automations */}
        {activeTab === 'time-tracking' && (
          <TimeTrackingAutomations boardId={boardId} />
        )}
      </main>
    </div>
  );
};

export default App;
