import { Request, Response } from 'express';
import prisma from '../db/prisma';

export interface MondayWebhookEventPayload {
  userId?: number;
  originalTriggerUuid?: string;
  boardId?: number | string;
  pulseId?: number | string;
  itemId?: number | string;
  columnId?: string;
  columnType?: string;
  columnTitle?: string;
  value?: any;
  previousValue?: any;
  triggerTime?: string;
  type?: string;
}

export const handleMondayWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload: MondayWebhookEventPayload = req.body?.event || req.body;

    if (!payload) {
      res.status(400).json({ error: 'Missing event payload' });
      return;
    }

    const boardId = String(payload.boardId || '');
    const itemId = String(payload.pulseId || payload.itemId || '');
    const columnId = String(payload.columnId || '');
    const columnType = String(payload.columnType || '');
    const triggerTime = payload.triggerTime ? new Date(payload.triggerTime) : new Date();

    console.log(`[Monday Webhook] Received event for item ${itemId} on board ${boardId} (Column: ${columnId}, Type: ${columnType})`);

    // -------------------------------------------------------------------------
    // 1. Status Column Change Handling (Core Bottleneck Tracking)
    // -------------------------------------------------------------------------
    if (columnType === 'color' || columnType === 'status' || columnId.toLowerCase().includes('status')) {
      const extractLabel = (val: any): string | null => {
        if (!val) return null;
        if (typeof val === 'string') return val;
        if (typeof val === 'object') {
          if (val.label?.text) return String(val.label.text);
          if (typeof val.label === 'string') return val.label;
          if (val.text) return String(val.text);
        }
        return null;
      };

      const newStatus = extractLabel(payload.value) || 'No Status';
      const previousStatus = extractLabel(payload.previousValue);

      // Persist to Postgres StatusEvents table
      const statusEvent = await prisma.statusEvent.create({
        data: {
          itemId,
          boardId,
          columnId,
          previousStatus,
          newStatus,
          changedAt: triggerTime,
        },
      });

      console.log(`[Status Event Recorded] Item ${itemId}: "${previousStatus || 'Initial'}" -> "${newStatus}" (ID: ${statusEvent.id})`);

      res.status(200).json({
        success: true,
        type: 'STATUS_CHANGE',
        statusEventId: statusEvent.id,
      });
      return;
    }

    // -------------------------------------------------------------------------
    // 2. Time Tracking Column Handling (Time Tracking Automations)
    // -------------------------------------------------------------------------
    if (columnType === 'duration' || columnId.toLowerCase().includes('time_tracking') || columnId.toLowerCase().includes('timer')) {
      let isRunning = false;
      let durationSeconds = 0;

      if (typeof payload.value === 'object' && payload.value !== null) {
        isRunning = Boolean(payload.value.running);
        durationSeconds = Number(payload.value.duration || 0);
      }

      if (isRunning) {
        // Time tracker started: create a new active session
        const session = await prisma.timeTrackingSession.create({
          data: {
            itemId,
            boardId,
            columnId,
            userId: payload.userId ? String(payload.userId) : null,
            startedAt: triggerTime,
            isRunning: true,
            durationSeconds,
          },
        });
        console.log(`[Time Tracking Started] Item ${itemId} started running (Session ID: ${session.id})`);
        res.status(200).json({ success: true, type: 'TIME_TRACKING_STARTED', sessionId: session.id });
        return;
      } else {
        // Time tracker stopped: close the latest running session
        const latestSession = await prisma.timeTrackingSession.findFirst({
          where: {
            itemId,
            boardId,
            columnId,
            isRunning: true,
          },
          orderBy: { startedAt: 'desc' },
        });

        if (latestSession) {
          const endedAt = triggerTime;
          const totalSeconds = Math.max(
            durationSeconds,
            Math.floor((endedAt.getTime() - new Date(latestSession.startedAt).getTime()) / 1000)
          );

          await prisma.timeTrackingSession.update({
            where: { id: latestSession.id },
            data: {
              isRunning: false,
              endedAt,
              durationSeconds: totalSeconds,
            },
          });
          console.log(`[Time Tracking Stopped] Item ${itemId} stopped. Total duration: ${totalSeconds}s`);
        }

        res.status(200).json({ success: true, type: 'TIME_TRACKING_STOPPED' });
        return;
      }
    }

    // Generic acknowledgment for unhandled column types
    res.status(200).json({
      success: true,
      message: 'Event received and ignored (non-status/non-timer column)',
    });
  } catch (error: any) {
    console.error('[Monday Webhook] Error processing event:', error);
    res.status(500).json({
      error: 'Failed to process webhook event',
      message: error.message,
    });
  }
};
