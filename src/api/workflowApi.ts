import { collection, query, orderBy, getDocs, updateDoc, doc, serverTimestamp, addDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/src/config/firebase";
import { type ServiceStatusRecord, type User, type ServiceRequest } from "./client";

export const WORKFLOW_MAP: Record<string, string[]> = {
  'Submitted': ['Assigned', 'Cancelled'],
  'Assigned': ['Accepted', 'Rejected'],
  'Accepted': ['In Progress'],
  'Rejected': ['Assigned'],
  'In Progress': ['Resolved'],
  'Resolved': ['Closed', 'Reopened'],
  'Closed': [],
  'Cancelled': [],
  'Reopened': ['Assigned', 'Cancelled'],
};

export const canAssign = (user: User, complaint: ServiceRequest): boolean => {
  if (!user) return false;
  if (user.role === 'readonly_super_admin') return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'taluk_admin') {
    if (!user.taluk || !complaint?.taluk) return true;
    return user.taluk.trim().toLowerCase() === complaint.taluk.trim().toLowerCase();
  }
  return false;
};

export const canCancel = (user: User, complaint: ServiceRequest): boolean => {
  if (user.role === 'readonly_super_admin') return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'citizen' && complaint.citizenId === user.uid && complaint.status === 'Submitted') return true;
  return false;
};

export const canAcceptOrReject = (user: User, complaint: ServiceRequest): boolean => {
  if (user.role === 'readonly_super_admin') return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'staff' && complaint.assignedStaffId === user.uid && complaint.status === 'Assigned') return true;
  return false;
};

export const canUpdateProgress = (user: User, complaint: ServiceRequest): boolean => {
  if (user.role === 'readonly_super_admin') return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'staff' && complaint.assignedStaffId === user.uid && ['Accepted', 'In Progress'].includes(complaint.status)) return true;
  return false;
};

export const canResolve = (user: User, complaint: ServiceRequest): boolean => {
  if (user.role === 'readonly_super_admin') return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'staff' && complaint.assignedStaffId === user.uid && complaint.status === 'In Progress') return true;
  return false;
};

export const canClose = (user: User, complaint: ServiceRequest): boolean => {
  if (user.role === 'readonly_super_admin') return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'taluk_admin' && user.taluk === complaint.taluk && complaint.status === 'Resolved') return true;
  return false;
};

export const canReopen = (user: User, complaint: ServiceRequest): boolean => {
  if (user.role === 'readonly_super_admin') return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'citizen' && complaint.citizenId === user.uid && complaint.status === 'Resolved') return true;
  if (user.role === 'taluk_admin' && user.taluk === complaint.taluk && complaint.status === 'Resolved') return true;
  return false;
};

export const canComment = (user: User, complaint: ServiceRequest): boolean => {
  if (user.role === 'readonly_super_admin') return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'citizen' && complaint.citizenId === user.uid) return true;
  if (user.role === 'taluk_admin' && user.taluk === complaint.taluk) return true;
  if (user.role === 'staff' && complaint.assignedStaffId === user.uid) return true;
  return false;
};

export const getNextStatuses = (currentStatus: string): string[] => {
  return WORKFLOW_MAP[currentStatus] || [];
};

export const isValidTransition = (current: string, next: string): boolean => {
  return getNextStatuses(current).includes(next);
};

export const isFinalStatus = (status: string): boolean => {
  return getNextStatuses(status).length === 0;
};

const DEFAULT_STATUS_RECORDS: ServiceStatusRecord[] = [
  { id: 'submitted', name: 'Submitted', color: '#3B82F6', isInitial: true, isFinal: false, displayOrder: 1 },
  { id: 'assigned', name: 'Assigned', color: '#F59E0B', isInitial: false, isFinal: false, displayOrder: 2 },
  { id: 'accepted', name: 'Accepted', color: '#8B5CF6', isInitial: false, isFinal: false, displayOrder: 3 },
  { id: 'in_progress', name: 'In Progress', color: '#06B6D4', isInitial: false, isFinal: false, displayOrder: 4 },
  { id: 'resolved', name: 'Resolved', color: '#10B981', isInitial: false, isFinal: false, displayOrder: 5 },
  { id: 'closed', name: 'Closed', color: '#6B7280', isInitial: false, isFinal: true, displayOrder: 6 },
  { id: 'cancelled', name: 'Cancelled', color: '#EF4444', isInitial: false, isFinal: true, displayOrder: 7 },
  { id: 'rejected', name: 'Rejected', color: '#DC2626', isInitial: false, isFinal: false, displayOrder: 8 },
  { id: 'reopened', name: 'Reopened', color: '#EC4899', isInitial: false, isFinal: false, displayOrder: 9 },
];

export const listStatuses = async (): Promise<ServiceStatusRecord[]> => {
  try {
    const q = query(collection(db, "serviceStatuses"));
    const snap = await getDocs(q).catch(() => null);
    if (!snap || snap.empty) return DEFAULT_STATUS_RECORDS;
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceStatusRecord));
    return items.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  } catch (e) {
    return DEFAULT_STATUS_RECORDS;
  }
};

export const addStatusRecord = async (data: Omit<ServiceStatusRecord, 'id'>) => {
  return await addDoc(collection(db, "serviceStatuses"), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
};

export const updateStatusRecord = async (id: string, data: Partial<ServiceStatusRecord>) => {
  return await updateDoc(doc(db, "serviceStatuses", id), { ...data, updatedAt: serverTimestamp() });
};

export const deleteStatusRecord = async (id: string) => {
  return await deleteDoc(doc(db, "serviceStatuses", id));
};

export const getAllowedTransitions = (user: User, complaint: ServiceRequest): string[] => {
  if (user.role === 'readonly_super_admin') return [];

  if (user.role === 'super_admin') {
    // Super Admin can override workflow and transition to any other status
    const allStatuses = [
      'Submitted', 'Assigned', 'Accepted', 'In Progress',
      'Resolved', 'Closed', 'Rejected', 'Reopened', 'Cancelled'
    ];
    return allStatuses.filter(s => s !== complaint.status);
  }

  const nextSteps = getNextStatuses(complaint.status);

  return nextSteps.filter(status => {
    if (status === 'Assigned') return canAssign(user, complaint);
    if (status === 'Cancelled') return canCancel(user, complaint);
    if (status === 'Accepted' || status === 'Rejected') return canAcceptOrReject(user, complaint);
    if (status === 'In Progress') return canUpdateProgress(user, complaint);
    if (status === 'Resolved') return canResolve(user, complaint);
    if (status === 'Closed') return canClose(user, complaint);
    if (status === 'Reopened') return canReopen(user, complaint);
    return false;
  });
};

export const workflowApi = {
  canAssign, canCancel, canAcceptOrReject, canUpdateProgress, canResolve, canClose, canReopen, canComment,
  getNextStatuses, isValidTransition, isFinalStatus, listStatuses, addStatusRecord, updateStatusRecord, deleteStatusRecord, getAllowedTransitions
};
