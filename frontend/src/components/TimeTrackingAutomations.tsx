import React, { useState, useEffect } from 'react';
import { TimeTrackingRule, fetchTimeTrackingRules, saveTimeTrackingRule } from '../services/api';
import { showMondayNotice } from '../services/mondaySdk';
import { Timer, Plus, Bell, ArrowRight, Zap, ShieldAlert } from 'lucide-react';

interface TimeTrackingAutomationsProps {
  boardId: string;
}

export const TimeTrackingAutomations: React.FC<TimeTrackingAutomationsProps> = ({ boardId }) => {
  const [rules, setRules] = useState<TimeTrackingRule[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [thresholdMinutes, setThresholdMinutes] = useState('30');
  const [actionType, setActionType] = useState<'NOTIFY' | 'ESCALATE_STATUS' | 'MOVE_GROUP'>('NOTIFY');
  const [targetRole, setTargetRole] = useState<'ASSIGNEE' | 'MANAGER' | 'TEAM_LEAD'>('ASSIGNEE');
  const [targetStatus, setTargetStatus] = useState('Critical');
  const [targetGroupId, setTargetGroupId] = useState('urgent_group');
  const [customMessage, setCustomMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const loadRules = async () => {
    try {
      const data = await fetchTimeTrackingRules(boardId);
      setRules(data);
    } catch (err: any) {
      console.warn('Failed to load time tracking rules:', err.message);
    }
  };

  useEffect(() => {
    loadRules();
  }, [boardId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await saveTimeTrackingRule({
        boardId,
        thresholdMinutes: parseInt(thresholdMinutes, 10) || 30,
        actionType,
        targetRole,
        targetStatus: actionType === 'ESCALATE_STATUS' ? targetStatus : undefined,
        targetGroupId: actionType === 'MOVE_GROUP' ? targetGroupId : undefined,
        customMessage: customMessage || undefined,
        active: true,
      });

      showMondayNotice(`Time tracking automation rule created!`, 'success');
      setShowAddForm(false);
      loadRules();
    } catch (err: any) {
      showMondayNotice(`Error saving rule: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">
            <Timer size={20} color="var(--primary-color)" />
            Time Tracking Automations
          </h2>
          <div className="card-desc">
            "<strong>X minutes after monday's time tracking column starts running, do this.</strong>"
          </div>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <Plus size={14} />
          {showAddForm ? 'Cancel' : 'New Automation Recipe'}
        </button>
      </div>

      {/* Feature Highlights Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 115, 234, 0.06) 0%, rgba(0, 200, 117, 0.06) 100%)',
        border: '1px solid #d0d4e4',
        borderRadius: '8px',
        padding: '16px 20px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '8px',
          background: '#0073ea',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <Zap size={22} />
        </div>
        <div>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Precision Time Management Booster
          </h4>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Elevate project management, IT service desks, and client reporting. Prevent runaway timer sessions,
            automatically escalate tickets open for too long, and notify specific team roles in real-time.
          </p>
        </div>
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
            Create Time Tracking Automation Recipe
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">When timer runs for over (minutes)</label>
              <input
                type="number"
                min="1"
                step="5"
                className="form-input"
                value={thresholdMinutes}
                onChange={(e) => setThresholdMinutes(e.target.value)}
                placeholder="e.g. 30, 60, 120"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Then execute action</label>
              <select
                className="form-select"
                value={actionType}
                onChange={(e) => setActionType(e.target.value as any)}
              >
                <option value="NOTIFY">Customizable Notification</option>
                <option value="ESCALATE_STATUS">Prioritize: Change Status to "Critical"</option>
                <option value="MOVE_GROUP">Prioritize: Move Item to "Urgent" Group</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Notify Specific Team Role</label>
              <select
                className="form-select"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value as any)}
              >
                <option value="ASSIGNEE">Task Assignee</option>
                <option value="MANAGER">Project Manager</option>
                <option value="TEAM_LEAD">Team Lead</option>
              </select>
            </div>

            {actionType === 'ESCALATE_STATUS' && (
              <div className="form-group">
                <label className="form-label">Escalate Status To</label>
                <input
                  type="text"
                  className="form-input"
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  placeholder="e.g. Critical"
                />
              </div>
            )}

            {actionType === 'MOVE_GROUP' && (
              <div className="form-group">
                <label className="form-label">Target Group Name / ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={targetGroupId}
                  onChange={(e) => setTargetGroupId(e.target.value)}
                  placeholder="e.g. urgent_group or Urgent"
                />
              </div>
            )}

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Custom Notification Message (Optional)</label>
              <input
                type="text"
                className="form-input"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="e.g. ⏱️ Heads up: timer has hit the 1-hour mark! Please update task status."
              />
            </div>
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
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Activate Automation'}
            </button>
          </div>
        </form>
      )}

      {rules.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
          No time tracking automations active yet. Click <strong>"New Automation Recipe"</strong> above to automate notifications and task escalations when timers run!
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Trigger Interval</th>
                <th>Automation Action</th>
                <th>Target Role</th>
                <th>Custom Message</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule, idx) => (
                <tr key={rule.id || idx}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Timer size={16} color="var(--primary-color)" />
                      <strong>Timer hits {rule.thresholdMinutes} mins</strong>
                    </div>
                  </td>
                  <td>
                    {rule.actionType === 'NOTIFY' && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Bell size={14} color="var(--warning-color)" /> Send Real-Time Notification
                      </span>
                    )}
                    {rule.actionType === 'ESCALATE_STATUS' && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ShieldAlert size={14} color="var(--danger-color)" /> Change status to "{rule.targetStatus || 'Critical'}"
                      </span>
                    )}
                    {rule.actionType === 'MOVE_GROUP' && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ArrowRight size={14} color="var(--info-color)" /> Move to "{rule.targetGroupId || 'Urgent'}" group
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="app-badge">{rule.targetRole || 'ASSIGNEE'}</span>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '240px' }}>
                    {rule.customMessage || 'Standard SLA notification message'}
                  </td>
                  <td>
                    <span style={{ color: 'var(--success-color)', fontWeight: 600, fontSize: '0.8rem' }}>
                      ● Active
                    </span>
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
