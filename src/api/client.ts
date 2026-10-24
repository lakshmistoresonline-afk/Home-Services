import {
  doc,
  getDoc,
  query,
  collection,
  where,
  limit,
  getDocs,
  Timestamp
} from "firebase/firestore";
import { auth, db } from "@/src/config/firebase";
import { THRISSUR_WARDS } from "@/src/data/wards";

// Global state to prevent Firestore race conditions during logout
let globalIsLoggingOut = false;

export function setGlobalLoggingOut(val: boolean) {
  globalIsLoggingOut = val;
}

export function isLoggingOutState() {
  return globalIsLoggingOut;
}

export function guardAuth() {
  if (globalIsLoggingOut || !auth.currentUser) {
    throw new Error("AUTH_GATED");
  }
}

export { THRISSUR_WARDS };

export function getSecondaryAuth() {
  const { initializeApp, getApp, getApps } = require('firebase/app');
  const { getAuth } = require('firebase/auth');
  const { firebaseConfig } = require('@/src/config/firebase-config');

  let secondaryApp;
  const apps = getApps();
  secondaryApp = apps.find((a: any) => a.name === 'SecondaryApp');

  if (!secondaryApp) {
    secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp');
  }

  return getAuth(secondaryApp);
}

export type UserRole = 'citizen' | 'staff' | 'ward_admin' | 'taluk_admin' | 'super_admin' | 'readonly_super_admin';

export type Permission = {
  id: string;
  name: string;
  module: string;
  isActive?: boolean;
};

export type RoleRecord = {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isActive: boolean;
};

export type AuditEntry = {
  id: string;
  timestamp: any;
  actor: {
    uid: string;
    name: string;
    role: string;
  };
  action: string;
  entity: {
    type: 'complaint' | 'staff' | 'department' | 'category' | 'auth' | 'system';
    id: string;
  };
  changes?: {
    prev: any;
    next: any;
  };
  context: {
    device?: string;
    ip?: string;
  };
};

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  recipientUid: string;
  recipientRole: string;
  complaintId?: string;
  read: boolean;
  archived?: boolean;
  type: 'SYSTEM' | 'ASSIGNMENT' | 'UPDATE' | 'ACCOUNT';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  createdAt: any;
};

export type User = {
  uid: string;
  employeeId?: string | null;
  fullName: string;
  email: string;
  mobile: string;
  mobileNumber?: string; // Alias for mobile
  role: UserRole;
  status?: string;
  permissions: string[];
  assignedWardNumbers: number[];
  hasAllWardAccess: boolean;
  wardNumber: number | null;
  wardName: string | null;
  district?: string | null;
  taluk?: string | null;
  wardId?: string; // Legacy ID format ward_X
  departments: string[];
  departmentIds?: string[];
  departmentNames?: string[];
  categories: string[];
  designation: string | null;
  isActive: boolean;
  activeComplaintCount: number;
  completedComplaintCount: number;
  averageResolutionTime: number; // in hours
  rating: number;
  joiningDate: string | null;
  pushToken?: string | null;
  createdAt: Timestamp | any;
  updatedAt: Timestamp | any;
};

export type Staff = User;

export type Department = {
  id: string;
  name: string;
  description: string;
  displayOrder: number;
  icon: string;
  isActive: boolean;
};

export type ComplaintCategory = {
  id: string;
  name: string;
  departmentId: string;
  departmentName: string;
  displayOrder: number;
  color: string;
  icon: string;
  requiresLocation: boolean;
  priority: 'Low' | 'Medium' | 'High';
  slaHours: number;
  isActive: boolean;
};

export type ComplaintComment = {
  id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  text: string;
  created_at: string;
};

export type TimelineActivityType =
  | 'COMPLAINT_CREATED'
  | 'COMPLAINT_ASSIGNED'
  | 'COMPLAINT_REASSIGNED'
  | 'ASSIGNMENT_ACCEPTED'
  | 'ASSIGNMENT_REJECTED'
  | 'WORK_STARTED'
  | 'PROGRESS_UPDATED'
  | 'COMMENT_ADDED'
  | 'PHOTO_UPLOADED'
  | 'DOCUMENT_UPLOADED'
  | 'COMPLAINT_RESOLVED'
  | 'COMPLAINT_CLOSED'
  | 'COMPLAINT_REOPENED'
  | 'COMPLAINT_CANCELLED'
  | 'PRIORITY_CHANGED'
  | 'DEPARTMENT_CHANGED'
  | 'STAFF_CHANGED'
  | 'CITIZEN_UPDATED_INFO'
  | 'SYSTEM_GENERATED'
  | 'STATUS_CHANGED'; // for generic legacy history

export type TimelineAttachment = {
  id: string;
  filename: string;
  url: string;
  thumbnailURL?: string;
  size: number;
  contentType: string;
  uploadedBy: string;
  uploadedAt: string;
  metadata?: Record<string, any>;
};

export type TimelineActivity = {
  id: string;
  type: TimelineActivityType;
  title: string;
  description?: string;
  performedBy: string;
  performedByName: string;
  performedByRole: string;
  timestamp: string;
  remarks?: string;
  attachments?: TimelineAttachment[];
  oldValue?: any;
  newValue?: any;
  metadata?: Record<string, any>;
};

export type HistoryEntry = {
  actor_id: string;
  actor_name: string;
  actor_role: string;
  action: string;
  oldStatus?: string;
  newStatus?: string;
  remarks?: string;
  details: Record<string, any>;
  at: string;
};

export type ComplaintStatusRecord = {
  id: string;
  name: string;
  displayOrder: number;
  color: string;
  icon: string;
  isActive: boolean;
};

export type AssignmentEntry = {
  previousStaffId: string | null;
  previousStaffName: string | null;
  newStaffId: string | null;
  newStaffName: string | null;
  assignedBy: string;
  assignedByName: string;
  timestamp: string;
};

export type ComplaintStatus = string;

export type Complaint = {
  id: string;
  complaint_id: string;
  citizenId: string;
  citizenName: string;
  wardNumber: number;
  wardName: string;
  departmentId: string;
  departmentName: string;
  categoryId: string;
  categoryName: string;
  title: string;
  description: string;
  status: ComplaintStatus;
  photos: string[];
  attachments: TimelineAttachment[];
  assignedStaffId: string | null;
  assignedStaffName: string | null;
  assignedDepartment?: string | null;
  assignedAt?: string | null;
  assignedBy?: string | null;
  assignedByName?: string | null;
  assignmentHistory?: AssignmentEntry[];
  remarks: string | null;
  resolvedAt: any | null;
  resolutionDuration?: number | null; // in hours
  slaDueAt?: any | null;
  slaBreached?: boolean;
  history: HistoryEntry[];
  comments: ComplaintComment[];
  timeline: TimelineActivity[];
  createdAt: any;
  updatedAt: any;

  // Legacy compatibility fields
  created_at?: string;
  updated_at?: string;
  // Raw JS Date fields for reliable dashboard binding
  createdAtDate?: Date;
  updatedAtDate?: Date;
};

export type Meta = {
  departments: string[];
  categories: string[];
  statuses: string[];
  department_categories: Record<string, string[]>;
};

export type Ward = {
  wardNumber: number;
  name: string;
  councillorName?: string | null;
  isActive: boolean;
};

export type PaginatedResponse<T> = {
  items: T[];
  lastDoc: any;
  hasMore: boolean;
};

export const mapDoc = <T>(doc: any): T => {
  if (!doc?.exists()) return {} as T;
  const data = doc.data() || {};
  const res: any = {
    id: doc.id,
    ...data,
    created_at: data.createdAt?.toDate?.()?.toISOString() || data.createdAt?.toISOString?.() || data.createdAt || new Date().toISOString(),
    updated_at: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt?.toISOString?.() || data.updatedAt || new Date().toISOString(),
    resolvedAt: data.resolvedAt?.toDate?.()?.toISOString() || data.resolvedAt || null,
    // Reliable Date objects for dayjs
    createdAtDate: data.createdAt?.toDate?.() || (data.createdAt ? new Date(data.createdAt) : new Date()),
    updatedAtDate: data.updatedAt?.toDate?.() || (data.updatedAt ? new Date(data.updatedAt) : new Date()),
  };

  // Legacy mapping for Wards and Identifiers
  if (data.wardId && data.wardNumber === undefined) {
    const num = parseInt(data.wardId.split('_')[1]);
    if (!isNaN(num)) res.wardNumber = num;
  }

  if (data.assignedWardIds && data.assignedWardNumbers === undefined) {
    res.assignedWardNumbers = data.assignedWardIds.map((id: string) => {
      const num = parseInt(id.split('_')[1]);
      return isNaN(num) ? 0 : num;
    }).filter((n: number) => n > 0);
  }

  // Activity Timeline Construction
  let timeline: TimelineActivity[] = data.timeline || [];
  let attachments: TimelineAttachment[] = data.attachments || [];

  // Migration for photos to attachments
  if (data.photos && data.photos.length > 0 && attachments.length === 0) {
    attachments = data.photos.map((url: string, idx: number) => ({
      id: `legacy-photo-${idx}`,
      filename: `photo-${idx}.jpg`,
      url: url,
      size: 0,
      contentType: 'image/jpeg',
      uploadedBy: data.citizenId || 'legacy',
      uploadedAt: res.created_at
    }));
  }

  // 1. Convert Legacy history to timeline (if timeline is currently empty)
  if (data.history && data.history.length > 0 && (data.timeline === undefined || data.timeline.length === 0)) {
    data.history.forEach((h: HistoryEntry, idx: number) => {
      let type: TimelineActivityType = 'STATUS_CHANGED';
      if (h.action === 'created') type = 'COMPLAINT_CREATED';
      else if (h.action === 'assigned') type = 'COMPLAINT_ASSIGNED';
      else if (h.action === 'reopened') type = 'COMPLAINT_REOPENED';
      else if (h.action === 'commented') type = 'COMMENT_ADDED';

      timeline.push({
        id: `hist-${idx}-${h.at}`,
        type,
        title: h.action.charAt(0).toUpperCase() + h.action.slice(1).replace('_', ' '),
        performedBy: h.actor_id,
        performedByName: h.actor_name,
        performedByRole: h.actor_role,
        timestamp: h.at,
        remarks: h.remarks || h.details?.preview || '',
        oldValue: h.oldStatus,
        newValue: h.newStatus,
        metadata: h.details
      });
    });
  }

  // 2. Convert Legacy comments to timeline
  if (data.comments && data.comments.length > 0) {
    data.comments.forEach((c: ComplaintComment) => {
      if (!timeline.find(t => t.id === c.id || (t.type === 'COMMENT_ADDED' && t.timestamp === c.created_at))) {
        timeline.push({
          id: c.id,
          type: 'COMMENT_ADDED',
          title: 'Comment Added',
          performedBy: c.author_id,
          performedByName: c.author_name,
          performedByRole: c.author_role,
          timestamp: c.created_at,
          remarks: c.text,
        });
      }
    });
  }

  res.timeline = (timeline || []).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  res.attachments = attachments || [];

  if (res.timeline.length === 0) {
    res.timeline = [{
      id: 'initial-bootstrap',
      type: 'COMPLAINT_CREATED',
      title: 'Complaint Filed',
      performedBy: data.citizenId || 'legacy',
      performedByName: data.citizenName || 'Citizen',
      performedByRole: 'citizen',
      timestamp: res.created_at,
    }];
  }

  return res as T;
};

export const mapUserDoc = (doc: any): User => {
  if (!doc?.exists()) return { fullName: 'Deleted User', isActive: false } as User;
  const data = doc.data() || {};
  const uid = doc.id;

  // Backward compatibility for single-skill staff
  let departments = data.departments || [];
  if (departments.length === 0 && data.departmentName) {
    departments = [data.departmentName];
  }

  let categories = data.categories || [];
  if (categories.length === 0 && data.category) {
    categories = [data.category];
  }

  const profile: User = {
    uid,
    employeeId: data.employeeId || null,
    fullName: data.fullName || 'Unknown',
    email: data.email || '',
    mobile: data.mobile || data.mobileNumber || '',
    mobileNumber: data.mobileNumber || data.mobile || '',
    role: data.role || 'citizen',
    status: data.status || (data.isActive !== false ? 'active' : 'inactive'),
    permissions: [], // Caching handled in AuthProvider
    wardNumber: data.wardNumber ?? (data.wardId ? parseInt(data.wardId.split('_')[1]) : null),
    wardName: data.wardName || null,
    wardId: data.wardId || (data.wardNumber ? `ward_${data.wardNumber}` : undefined),
    departments,
    departmentIds: data.departmentIds || (departments.every((d: string) => d === d.toLowerCase()) ? departments : []),
    departmentNames: data.departmentNames || departments,
    categories,
    designation: data.designation || null,
    isActive: data.isActive ?? (data.status !== 'inactive'),
    activeComplaintCount: data.activeComplaintCount ?? data.currentWorkload ?? 0,
    completedComplaintCount: data.completedComplaintCount ?? 0,
    averageResolutionTime: data.averageResolutionTime ?? 0,
    rating: data.rating ?? 5.0,
    joiningDate: data.joiningDate || data.createdAt?.toDate?.()?.toISOString() || null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    hasAllWardAccess: data.hasAllWardAccess ?? (data.role === 'staff' && !data.wardNumber && !data.assignedWardNumbers && !data.assignedWardIds),
    assignedWardNumbers: data.assignedWardNumbers || [],
  };

  // Legacy Ward Assignment Fallbacks
  if (profile.role === 'staff' && (profile.assignedWardNumbers?.length || 0) === 0) {
    if (data.assignedWardIds) {
      profile.assignedWardNumbers = data.assignedWardIds.map((id: string) => parseInt(id.split('_')[1])).filter((n: number) => !isNaN(n));
      profile.hasAllWardAccess = false;
    } else if (profile.wardNumber) {
      profile.assignedWardNumbers = [profile.wardNumber];
      profile.hasAllWardAccess = false;
    }
  }

  return profile;
};

export async function getProfile(uid: string): Promise<User | null> {
  if (!uid) return null;
  const d = await getDoc(doc(db, 'users', uid));
  if (!d.exists()) return null;
  return mapUserDoc(d);
}

export async function findWardAdmin(wardNumber: number): Promise<{ uid: string; fullName: string } | null> {
  if (wardNumber === null || wardNumber === undefined) return null;
  const q = query(
    collection(db, 'users'),
    where('role', '==', 'ward_admin'),
    where('wardNumber', '==', wardNumber),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0].data();
  return { uid: snap.docs[0].id, fullName: d.fullName };
}
