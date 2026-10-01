import React, { useState } from 'react';
import { SLARule, saveSlaRule, deleteSlaRule } from '../services/api';
import { showMondayNotice } from '../services/mondaySdk';
import { Settings2, Plus, Trash2, CheckCircle2 } from 'lucide-react';

interface SlaSettingsModalProps {
  boardId: string;
  rules: SLARule[];
  onRefresh: () => void;
}

export const SlaSettingsModal: React.FC<SlaSettingsModalProps> = ({
  boardId,
  rules,
  onRefresh,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [statusLabel, setStatusLabel] = useState('Working on it');
  const [maxHours, setMaxHours] = useState('24');
  const [actionType, setActionType] = useState<'NOTIFY' | 'ESCALATE_STATUS' | 'MOVE_GROUP'>('NOTIFY');
  const [targetRole, setTargetRole] = useState<'ASSIGNEE' | 'MANAGER' | 'TEAM_LEAD'>('ASSIGNEE');
  const [targetStatus, setTargetStatus] = useState('Critical');
  const [targetGroupId, setTargetGroupId] = useState('urgent_group');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await saveSlaRule({
        boardId,
        statusLabel,
        maxDurationHours: parseFloat(maxHours) || 24,
        actionType,
        targetRole,
        targetStatus: actionType === 'ESCALATE_STATUS' ? targetStatus : undefined,
        targetGroupId: actionType === 'MOVE_GROUP' ? targetGroupId : undefined,
        active: true,
      });

      showMondayNotice(`SLA rule for "${statusLabel}" saved`, 'success');
      setShowAddForm(false);
      onRefresh();
    } catch (err: any) {
      showMondayNotice(`Failed to save SLA rule: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, label: string) => {
    try {
      await deleteSlaRule(id);
      showMondayNotice(`SLA rule for "${label}" removed`, 'info');
      onRefresh();
    } catch (err: any) {
      showMondayNotice(`Failed to delete rule: ${err.message}`, 'error');
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">
            <Settings2 size={20} color="var(--primary-color)" />
            SLA Duration Configuration
          </h2>
          <div className="card-desc">
            Define max duration items can sit in each status before triggering automated escalations
          </div>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <Plus size={14} />
          {showAddForm ? 'Cancel' : 'Add SLA Rule'}
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            background: '#f8f9fc',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '20px',
          }}
        >
          <h3 style={{ fontSize: '1rem', marginBottom: '14px', fontWeight: 600 }}>
            Configure New Status SLA Rule
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Status Label</label>
              <input
                type="text"
                className="form-input"
                value={statusLabel}
                onChange={(e) => setStatusLabel(e.target.value)}
                placeholder="e.g. Working on it, In Review, Stuck"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Max Allowed Duration (Hours)</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                className="form-input"
                value={maxHours}
                onChange={(e) => setMaxHours(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Breach Action</label>
              <select
                className="form-select"
                value={actionType}
                onChange={(e) => setActionType(e.target.value as any)}
              >
                <option value="NOTIFY">Post Monday Notification (1-Click Nudge style)</option>
                <option value="ESCALATE_STATUS">Escalate Status to Critical</option>
                <option value="MOVE_GROUP">Move Item to Urgent Group</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Target Role</label>
              <select
                className="form-select"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value as any)}
              >
                <option value="ASSIGNEE">Assignee</option>
                <option value="MANAGER">Project Manager</option>
                <option value="TEAM_LEAD">Team Lead</option>
              </select>
            </div>

            {actionType === 'ESCALATE_STATUS' && (
              <div className="form-group">
                <label className="form-label">Target Escalation Status</label>
                <input
                  type="text"
                  className="form-input"
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  placeholder="e.g. Critical or Stuck"
                />
              </div>
            )}

            {actionType === 'MOVE_GROUP' && (
              <div className="form-group">
                <label className="form-label">Target Group ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={targetGroupId}
                  onChange={(e) => setTargetGroupId(e.target.value)}
                  placeholder="e.g. urgent_group"
                />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save SLA Rule'}
            </button>
          </div>
        </form>
      )}

      {rules.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
          No SLA rules configured for this board yet. Click "Add SLA Rule" above to define duration limits.
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>SLA Limit</th>
                <th>Breach Action</th>
                <th>Target Role</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id || rule.statusLabel}>
                  <td><strong>{rule.statusLabel}</strong></td>
                  <td>{rule.maxDurationHours} hours</td>
                  <td>
                    {rule.actionType === 'NOTIFY' && '🔔 Post Notification'}
                    {rule.actionType === 'ESCALATE_STATUS' && `⚠️ Escalate to "${rule.targetStatus || 'Critical'}"`}
                    {rule.actionType === 'MOVE_GROUP' && `📌 Move to "${rule.targetGroupId || 'Urgent'}" group`}
                  </td>
                  <td>
                    <span className="app-badge">{rule.targetRole || 'ASSIGNEE'}</span>
                  </td>
                  <td>
                    <span style={{ color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                      <CheckCircle2 size={14} /> Active
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {rule.id && (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ color: 'var(--danger-color)' }}
                        onClick={() => handleDelete(rule.id!, rule.statusLabel)}
                        title="Delete SLA Rule"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
