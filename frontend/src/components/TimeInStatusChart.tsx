import React from 'react';
import { StatusSummary } from '../services/api';
import { formatDuration } from '../utils/format';
import { BarChart3 } from 'lucide-react';

interface TimeInStatusChartProps {
  statusSummaries: StatusSummary[];
}

export const TimeInStatusChart: React.FC<TimeInStatusChartProps> = ({ statusSummaries }) => {
  const maxAverage = Math.max(...statusSummaries.map((s) => s.averageHours), 1);

  const getStatusColor = (status: string): string => {
    const s = status.toLowerCase();
    if (s.includes('done') || s.includes('complete')) return 'var(--success-color)';
    if (s.includes('work') || s.includes('prog')) return 'var(--warning-color)';
    if (s.includes('stuck') || s.includes('crit')) return 'var(--danger-color)';
    if (s.includes('review') || s.includes('qa')) return 'var(--info-color)';
    return 'var(--primary-color)';
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">
            <BarChart3 size={20} color="var(--primary-color)" />
            Time in Status Distribution
          </h2>
          <div className="card-desc">
            Average and historical duration items spend in each workflow state
          </div>
        </div>
      </div>

      {statusSummaries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
          No status transitions recorded yet for this board. Move an item's status to view data!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Visual Bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {statusSummaries.map((item) => {
              const percentage = Math.max(8, (item.averageHours / maxAverage) * 100);
              const color = getStatusColor(item.status);

              return (
                <div key={item.status}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 600 }}>{item.status}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Avg: <strong>{formatDuration(item.averageHours)}</strong> ({item.itemCount} items)
                    </span>
                  </div>
                  <div style={{ background: '#eef1f8', height: '12px', borderRadius: '6px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${percentage}%`,
                        height: '100%',
                        backgroundColor: color,
                        borderRadius: '6px',
                        transition: 'width 0.5s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Breakdown Table */}
          <div className="table-container" style={{ marginTop: '16px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Average Time</th>
                  <th>Min Duration</th>
                  <th>Max Duration</th>
                  <th>Total Time Logged</th>
                  <th>Items Tracked</th>
                </tr>
              </thead>
              <tbody>
                {statusSummaries.map((item) => (
                  <tr key={item.status}>
                    <td>
                      <strong style={{ color: getStatusColor(item.status) }}>●</strong> {item.status}
                    </td>
                    <td><strong>{formatDuration(item.averageHours)}</strong></td>
                    <td>{formatDuration(item.minHours)}</td>
                    <td>{formatDuration(item.maxHours)}</td>
                    <td>{formatDuration(item.totalHours)}</td>
                    <td>{item.itemCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
