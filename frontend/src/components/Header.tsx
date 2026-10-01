import React, { useState } from 'react';
import { RefreshCw, Play, Layers } from 'lucide-react';
import { refreshBoardCache, triggerQueueScan } from '../services/api';

interface HeaderProps {
  boardId: string;
  onBoardChange: (newBoardId: string) => void;
  onRefresh: () => void;
  backendStatus: string;
}

export const Header: React.FC<HeaderProps> = ({
  boardId,
  onBoardChange,
  onRefresh,
  backendStatus,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshBoardCache(boardId);
      onRefresh();
    } catch (err: any) {
      console.error(err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleScanQueue = async () => {
    setIsScanning(true);
    try {
      await triggerQueueScan();
      onRefresh();
    } catch (err: any) {
      console.error(err);
    } finally {
      setTimeout(() => setIsScanning(false), 800);
    }
  };

  return (
    <header className="app-header">
      <div className="app-title-group">
        <img
          src="/logo.png"
          alt="Bottleneck Logo"
          style={{ width: '38px', height: '38px', borderRadius: '8px', objectFit: 'contain' }}
        />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 className="app-title">Bottleneck</h1>
            <span className="app-badge">Time in Status & SLAs</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Backend: <span style={{ color: backendStatus.includes('Connected') ? 'var(--success-color)' : 'var(--danger-color)' }}>●</span> {backendStatus}
          </div>
        </div>
      </div>

      <div className="header-actions">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Layers size={16} color="var(--text-secondary)" />
          <input
            type="text"
            className="form-input"
            value={boardId}
            onChange={(e) => onBoardChange(e.target.value)}
            style={{ width: '130px', padding: '5px 8px', fontSize: '0.85rem' }}
            placeholder="Board ID"
            title="Active monday.com Board ID"
          />
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          title="Refresh metrics & invalidate Redis cache"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>

        <button
          className="btn btn-primary btn-sm"
          onClick={handleScanQueue}
          disabled={isScanning}
          title="Scan BullMQ queue for SLA breaches and timer automations now"
        >
          <Play size={14} />
          {isScanning ? 'Scanning...' : 'Trigger Scan'}
        </button>
      </div>
    </header>
  );
};
