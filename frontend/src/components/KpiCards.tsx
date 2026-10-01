import React from 'react';
import { AlertTriangle, Clock, CheckCircle2, TrendingUp } from 'lucide-react';
import { CycleLeadMetrics } from '../services/api';

interface KpiCardsProps {
  breachedCount: number;
  warningCount: number;
  cycleLeadMetrics: CycleLeadMetrics;
}

export const KpiCards: React.FC<KpiCardsProps> = ({
  breachedCount,
  warningCount,
  cycleLeadMetrics,
}) => {
  return (
    <div className="kpi-grid">
      <div className="kpi-card">
        <div className="kpi-icon danger">
          <AlertTriangle size={24} />
        </div>
        <div className="kpi-info">
          <div className="kpi-label">SLA Breached</div>
          <div className="kpi-value" style={{ color: 'var(--danger-color)' }}>
            {breachedCount}
          </div>
          <div className="kpi-subtext">Immediate action required</div>
        </div>
      </div>

      <div className="kpi-card">
        <div className="kpi-icon warning">
          <Clock size={24} />
        </div>
        <div className="kpi-info">
          <div className="kpi-label">At Risk (75%+)</div>
          <div className="kpi-value" style={{ color: 'var(--warning-color)' }}>
            {warningCount}
          </div>
          <div className="kpi-subtext">Approaching duration limit</div>
        </div>
      </div>

      <div className="kpi-card">
        <div className="kpi-icon primary">
          <TrendingUp size={24} />
        </div>
        <div className="kpi-info">
          <div className="kpi-label">Avg Cycle Time</div>
          <div className="kpi-value">
            {cycleLeadMetrics.averageCycleTimeHours > 0
              ? `${cycleLeadMetrics.averageCycleTimeHours}h`
              : 'N/A'}
          </div>
          <div className="kpi-subtext">Working status to completion</div>
        </div>
      </div>

      <div className="kpi-card">
        <div className="kpi-icon success">
          <CheckCircle2 size={24} />
        </div>
        <div className="kpi-info">
          <div className="kpi-label">Avg Lead Time</div>
          <div className="kpi-value">
            {cycleLeadMetrics.averageLeadTimeHours > 0
              ? `${cycleLeadMetrics.averageLeadTimeHours}h`
              : 'N/A'}
          </div>
          <div className="kpi-subtext">Creation to completion</div>
        </div>
      </div>
    </div>
  );
};
