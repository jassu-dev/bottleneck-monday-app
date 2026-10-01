import React, { useState } from 'react';
import { StuckItem, send1ClickNudge } from '../services/api';
import { openItemCard, showMondayNotice } from '../services/mondaySdk';
import { BellRing, ExternalLink, CheckCircle, AlertTriangle } from 'lucide-react';

interface StuckHubTableProps {
  items: StuckItem[];
  onRefresh: () => void;
}

export const StuckHubTable: React.FC<StuckHubTableProps> = ({ items, onRefresh }) => {
  const [nudgingId, setNudgingId] = useState<string | null>(null);
  const [nudgedSuccessIds, setNudgedSuccessIds] = useState<Set<string>>(new Set());

  const handleNudge = async (item: StuckItem) => {
    setNudgingId(item.itemId);
    try {
      const message = `⚠️ **1-Click Nudge**: Task **#${item.itemId}** has been sitting in **"${item.currentStatus}"** for **${item.timeInStatusFormatted}**${
        item.maxSlaHours ? ` (Target SLA: ${item.maxSlaHours}h)` : ''
      }. Please provide a status update or resolve any blockers!`;

      await send1ClickNudge(item.itemId, message, item.assignee);

      setNudgedSuccessIds((prev) => new Set(prev).add(item.itemId));
      showMondayNotice(`Nudge sent for item #${item.itemId}`, 'success');
      onRefresh();
    } catch (err: any) {
      showMondayNotice(`Failed to send nudge: ${err.message}`, 'error');
    } finally {
      setNudgingId(null);
    }
  };

  const getStatusClass = (status: string): string => {
    const s = status.toLowerCase();
    if (s.includes('done') || s.includes('complete')) return 'done';
    if (s.includes('work') || s.includes('progress')) return 'working';
    if (s.includes('stuck') || s.includes('block') || s.includes('crit')) return 'stuck';
    if (s.includes('review') || s.includes('qa')) return 'review';
    return 'default';
  };

  if (items.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <CheckCircle size={44} color="var(--success-color)" style={{ margin: '0 auto 12px' }} />
        <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>No Bottlenecks Detected!</h3>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto' }}>
          All active items are progressing smoothly within their SLA targets or no status events have been logged yet.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">
            <AlertTriangle size={20} color="var(--danger-color)" />
            The Bottleneck Hub (Stuck Tasks)
          </h2>
          <div className="card-desc">
            Items exceeding SLA duration or requiring immediate manager attention
          </div>
        </div>
        <span className="app-badge" style={{ fontSize: '0.8rem' }}>
          {items.length} Active Items Monitored
        </span>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Current Status</th>
              <th>Time in Status</th>
              <th>SLA Limit</th>
              <th style={{ minWidth: '160px' }}>Breach Progress</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isNudged = nudgedSuccessIds.has(item.itemId);
              const isNudging = nudgingId === item.itemId;

              let progressColor = 'success';
              if (item.slaBreached) progressColor = 'danger';
              else if (item.slaWarning) progressColor = 'warning';

              const barWidth = Math.min(100, Math.max(5, item.breachPercentage || 10));

              return (
                <tr
                  key={item.itemId}
                  className={item.slaBreached ? 'breached-row' : ''}
                >
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {item.itemName || `Item #${item.itemId}`}
                      </span>
                      <button
                        onClick={() => openItemCard(item.itemId)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        title="Open item in monday.com"
                      >
                        <ExternalLink size={14} color="var(--text-secondary)" />
                      </button>
                    </div>
                    {item.assignee && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Assignee: {item.assignee}
                      </div>
                    )}
                  </td>

                  <td>
                    <span className={`status-pill ${getStatusClass(item.currentStatus)}`}>
                      {item.currentStatus}
                    </span>
                  </td>

                  <td>
                    <div style={{ fontWeight: 600 }}>{item.timeInStatusFormatted}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      ({item.timeInStatusHours} hrs)
                    </div>
                  </td>

                  <td>
                    {item.maxSlaHours !== null ? (
                      <span style={{ fontWeight: 500 }}>{item.maxSlaHours}h</span>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.8rem' }}>
                        No rule configured
                      </span>
                    )}
                  </td>

                  <td>
                    {item.maxSlaHours !== null ? (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                          <span style={{ fontWeight: 600 }}>{item.breachPercentage}%</span>
                          {item.exceededByHours > 0 && (
                            <span style={{ color: 'var(--danger-color)', fontWeight: 600 }}>
                              +{item.exceededByHours}h
                            </span>
                          )}
                        </div>
                        <div className="progress-bar-container">
                          <div
                            className={`progress-bar ${progressColor}`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="progress-bar-container">
                        <div className="progress-bar success" style={{ width: '20%' }} />
                      </div>
                    )}
                  </td>

                  <td>
                    {item.slaBreached ? (
                      <span className="sla-badge breached">Breached</span>
                    ) : item.slaWarning ? (
                      <span className="sla-badge warning">At Risk (75%)</span>
                    ) : (
                      <span className="sla-badge ontrack">On Track</span>
                    )}
                  </td>

                  <td style={{ textAlign: 'right' }}>
                    <button
                      className={`btn btn-sm ${isNudged ? 'btn-secondary' : 'btn-nudge'}`}
                      onClick={() => handleNudge(item)}
                      disabled={isNudging}
                      title="Post a GraphQL update tagging the assignee to unblock this task"
                    >
                      <BellRing size={13} />
                      {isNudging ? 'Nudging...' : isNudged ? 'Nudge Sent ✓' : '1-Click Nudge'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
