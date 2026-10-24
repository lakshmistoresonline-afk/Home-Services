import { collection, query, orderBy, getDocs, updateDoc, doc, serverTimestamp, addDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/src/config/firebase";
import { type ComplaintStatusRecord, type User, type Complaint } from "./client";

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

export const canAssign = (user: User, complaint: Complaint): boolean => {
  if (user.role === 'readonly_super_admin') return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'ward_admin' && user.wardNumber === complaint.wardNumber) return true;
  return false;
};

export const canCancel = (user: User, complaint: Complaint): boolean => {
  if (user.role === 'readonly_super_admin') return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'citizen' && complaint.citizenId === user.uid && complaint.status === 'Submitted') return true;
  return false;
};

export const canAcceptOrReject = (user: User, complaint: Complaint): boolean => {
  if (user.role === 'readonly_super_admin') return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'staff' && complaint.assignedStaffId === user.uid && complaint.status === 'Assigned') return true;
  return false;
};

export const canUpdateProgress = (user: User, complaint: Complaint): boolean => {
  if (user.role === 'readonly_super_admin') return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'staff' && complaint.assignedStaffId === user.uid && ['Accepted', 'In Progress'].includes(complaint.status)) return true;
  return false;
};

export const canResolve = (user: User, complaint: Complaint): boolean => {
  if (user.role === 'readonly_super_admin') return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'staff' && complaint.assignedStaffId === user.uid && complaint.status === 'In Progress') return true;
  return false;
};

export const canClose = (user: User, complaint: Complaint): boolean => {
  if (user.role === 'readonly_super_admin') return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'ward_admin' && user.wardNumber === complaint.wardNumber && complaint.status === 'Resolved') return true;
  return false;
};

export const canReopen = (user: User, complaint: Complaint): boolean => {
  if (user.role === 'readonly_super_admin') return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'citizen' && complaint.citizenId === user.uid && complaint.status === 'Resolved') return true;
  if (user.role === 'ward_admin' && user.wardNumber === complaint.wardNumber && complaint.status === 'Resolved') return true;
  return false;
};

export const canComment = (user: User, complaint: Complaint): boolean => {
  if (user.role === 'readonly_super_admin') return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'citizen' && complaint.citizenId === user.uid) return true;
  if (user.role === 'ward_admin' && user.wardNumber === complaint.wardNumber) return true;
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

export const listStatuses = async (): Promise<ComplaintStatusRecord[]> => {
  try {
    const q = query(collection(db, "complaintStatuses"), orderBy("displayOrder", "asc"));
    const snap = await getDocs(q);
    if (snap.empty) return [];
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ComplaintStatusRecord));
  } catch (e) {
    console.error('Failed to list statuses:', e);
    return [];
  }
};

export const addStatusRecord = async (data: Omit<ComplaintStatusRecord, 'id'>) => {
  return await addDoc(collection(db, "complaintStatuses"), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
};

export const updateStatusRecord = async (id: string, data: Partial<ComplaintStatusRecord>) => {
  return await updateDoc(doc(db, "complaintStatuses", id), { ...data, updatedAt: serverTimestamp() });
};

export const deleteStatusRecord = async (id: string) => {
  return await deleteDoc(doc(db, "complaintStatuses", id));
};

export const getAllowedTransitions = (user: User, complaint: Complaint): string[] => {
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
