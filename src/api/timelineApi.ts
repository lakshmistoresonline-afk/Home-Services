import {
  doc,
  updateDoc,
  arrayUnion,
  serverTimestamp
} from "firebase/firestore";
import { db } from "@/src/config/firebase";
import {
  type TimelineActivity,
  type TimelineActivityType,
  type User,
  type Complaint,
  type TimelineAttachment
} from "./client";

/**
 * Helper to create a standardized timeline event.
 * Does NOT write to Firestore, returns the activity object.
 */
export const createActivity = (params: {
  type: TimelineActivityType;
  user: User;
  title?: string;
  description?: string;
  remarks?: string;
  attachments?: TimelineAttachment[];
  oldValue?: any;
  newValue?: any;
  metadata?: Record<string, any>;
}): TimelineActivity => {
  return {
    id: `${params.type}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    type: params.type,
    title: params.title || getDefaultTitle(params.type),
    description: params.description ?? null,
    performedBy: params.user.uid,
    performedByName: params.user.fullName,
    performedByRole: params.user.role,
    timestamp: new Date().toISOString(),
    remarks: params.remarks ?? null,
    attachments: params.attachments ?? [],
    oldValue: params.oldValue ?? null,
    newValue: params.newValue ?? null,
    metadata: params.metadata ?? null,
  };
};

/**
 * Appends an event to a complaint's timeline.
 */
export const addEvent = async (complaintId: string, activity: TimelineActivity) => {
  const ref = doc(db, "complaints", complaintId);
  await updateDoc(ref, {
    timeline: arrayUnion(activity),
    updatedAt: serverTimestamp(),
  });
};

export const getDefaultTitle = (type: TimelineActivityType): string => {
  return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

/**
 * Group timeline by date (YYYY-MM-DD)
 */
export const groupByDate = (timeline: TimelineActivity[]) => {
  const groups: Record<string, TimelineActivity[]> = {};
  [...timeline].reverse().forEach(item => {
    const date = item.timestamp.split('T')[0];
    if (!groups[date]) groups[date] = [];
    groups[date].push(item);
  });
  return groups;
};

/**
 * Metric Calculators
 */

export const getDurationHours = (start: string, end: string) => {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.max(0, (e - s) / (1000 * 60 * 60));
};

export const calculateMetrics = (complaint: Complaint) => {
  const timeline = complaint.timeline || [];
  if (timeline.length === 0) return null;

  const created = timeline.find(t => t.type === 'COMPLAINT_CREATED')?.timestamp;
  const resolved = timeline.find(t => t.type === 'COMPLAINT_RESOLVED')?.timestamp;
  const assigned = timeline.find(t => t.type === 'COMPLAINT_ASSIGNED')?.timestamp;
  const accepted = timeline.find(t => t.type === 'ASSIGNMENT_ACCEPTED')?.timestamp;

  return {
    totalTime: resolved && created ? getDurationHours(created, resolved) : null,
    assignmentTime: assigned && created ? getDurationHours(created, assigned) : null,
    acceptanceTime: accepted && assigned ? getDurationHours(assigned, accepted) : null,
    resolutionTime: resolved && accepted ? getDurationHours(accepted, resolved) : null,
  };
};

export const timelineApi = {
  createActivity, addEvent, getDefaultTitle, groupByDate, getDurationHours, calculateMetrics
};
