import { type Complaint, type TimelineActivity } from "./client";
import dayjs from "dayjs";

export type SLAWarningLevel = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED' | 'DARK_RED';

export interface SLADetails {
  isBreached: boolean;
  timeRemainingHours: number;
  overdueHours: number;
  percentageUsed: number;
  warningLevel: SLAWarningLevel;
  statusLabel: string;
}

export const slaUtils = {
  /**
   * Calculates comprehensive SLA details for a complaint.
   */
  getSLADetails: (complaint: Complaint): SLADetails => {
    if (!complaint.slaDueAt) {
      return { isBreached: false, timeRemainingHours: 0, overdueHours: 0, percentageUsed: 0, warningLevel: 'GREEN', statusLabel: 'N/A' };
    }

    const created = dayjs(complaint.createdAtDate || complaint.createdAt);
    const deadline = dayjs(complaint.slaDueAt?.toDate?.() || complaint.slaDueAt);
    const resolved = complaint.resolvedAt
      ? dayjs(complaint.resolvedAt?.toDate?.() || complaint.resolvedAt)
      : null;

    const now = dayjs();
    const totalSlaDuration = deadline.diff(created, 'hour', true);

    let isBreached = false;
    let timeRemainingHours = 0;
    let overdueHours = 0;
    let percentageUsed = 0;

    const isFinal = ['Resolved', 'Closed', 'Cancelled', 'Rejected'].includes(complaint.status);

    if (resolved) {
      isBreached = resolved.isAfter(deadline);
      if (isBreached) {
        overdueHours = resolved.diff(deadline, 'hour', true);
      }
      const actualDuration = resolved.diff(created, 'hour', true);
      percentageUsed = (actualDuration / totalSlaDuration) * 100;
    } else {
      isBreached = now.isAfter(deadline);
      if (isBreached) {
        overdueHours = now.diff(deadline, 'hour', true);
        percentageUsed = 100 + (overdueHours / totalSlaDuration) * 100;
      } else {
        timeRemainingHours = deadline.diff(now, 'hour', true);
        const usedDuration = now.diff(created, 'hour', true);
        percentageUsed = (usedDuration / totalSlaDuration) * 100;
      }
    }

    // Determine Warning Level
    let warningLevel: SLAWarningLevel = 'GREEN';
    if (isBreached) {
      warningLevel = overdueHours > 24 ? 'DARK_RED' : 'RED';
    } else if (percentageUsed > 80) {
      warningLevel = 'ORANGE';
    } else if (percentageUsed > 50) {
      warningLevel = 'YELLOW';
    }

    let statusLabel = 'Within SLA';
    if (isBreached) statusLabel = overdueHours > 24 ? 'Critical Breach' : 'SLA Breached';
    else if (percentageUsed > 80) statusLabel = 'Near Expiry';
    else if (percentageUsed > 50) statusLabel = 'Warning';

    return {
      isBreached,
      timeRemainingHours: Math.max(0, timeRemainingHours),
      overdueHours: Math.max(0, overdueHours),
      percentageUsed: Math.min(200, percentageUsed), // Cap visual at 200%
      warningLevel,
      statusLabel
    };
  },

  /**
   * Calculates durations between different workflow stages.
   */
  calculateDurations: (complaint: Complaint) => {
    const timeline = complaint.timeline || [];

    const getTimestamp = (type: string) => {
      const event = timeline.find(t => t.type === type);
      return event ? dayjs(event.timestamp) : null;
    };

    const created = dayjs(complaint.createdAtDate || complaint.createdAt);
    const assigned = getTimestamp('COMPLAINT_ASSIGNED');
    const accepted = getTimestamp('ASSIGNMENT_ACCEPTED');
    const resolved = getTimestamp('COMPLAINT_RESOLVED');
    const verified = null; // Removed Verified status

    return {
      assignmentDuration: assigned ? assigned.diff(created, 'hour', true) : null,
      acceptanceDuration: (accepted && assigned) ? accepted.diff(assigned, 'hour', true) : null,
      resolutionDuration: (resolved && accepted) ? resolved.diff(accepted, 'hour', true) : null,
      verificationDuration: null,
      totalDuration: (resolved || dayjs()).diff(created, 'hour', true)
    };
  },

  isBreached: (complaint: Complaint): boolean => {
    return slaUtils.getSLADetails(complaint).isBreached;
  }
};
