import { collection, query, where, orderBy, limit, getDocs, addDoc, serverTimestamp, doc, getDoc, updateDoc, increment, arrayUnion, startAfter, type QueryDocumentSnapshot } from "firebase/firestore";
import { auth, db } from "@/src/config/firebase";
import { logAction } from "./auditApi";
import { workflowApi } from "./workflowApi";
import { createActivity } from "./timelineApi";
import { processAutoAssignment, commitAssignment } from "./assignmentEngine";
import { slaUtils } from "./slaUtils";
import { notificationService } from "@/src/services/notifications";
import { getProfile, findWardAdmin, mapDoc, type Complaint, type User, type HistoryEntry, type ComplaintComment, type TimelineActivity, type TimelineActivityType, type TimelineAttachment, type PaginatedResponse } from "./client";
import dayjs from "dayjs";

// Internal helper to find a complaint by its ID while respecting security rules (ownership/jurisdiction)
export const findComplaintSnapshot = async (cid: string): Promise<QueryDocumentSnapshot> => {
  const fbUser = auth.currentUser;
  if (!fbUser) throw new Error("Not authenticated");
  const profile = await getProfile(fbUser.uid);
  if (!profile) throw new Error("Profile not found");

  let q = query(collection(db, "complaints"), where("complaint_id", "==", cid), limit(1));

  // For Citizens, strictly filter by ownership to satisfy Firestore 'list' rules
  if (profile.role === 'citizen') {
    q = query(q, where("citizenId", "==", fbUser.uid));
  }
  // For Staff, filter by assignment
  else if (profile.role === 'staff') {
    q = query(q, where("assignedStaffId", "==", fbUser.uid));
  }
  // For Ward Admins, filter by jurisdiction
  else if (profile.role === 'ward_admin') {
    q = query(q, where("wardNumber", "==", profile.wardNumber));
  }

  const snap = await getDocs(q);
  if (snap.empty) throw new Error("Complaint not found or access denied");
  return snap.docs[0];
};

export const createComplaint = async (body: {
  category: string;
  title: string;
  description: string;
  attachments: TimelineAttachment[];
}): Promise<Complaint> => {
  const fbUser = auth.currentUser;
  if (!fbUser) throw new Error("Not authenticated");
  const profile = await getProfile(fbUser.uid);
  if (!profile) throw new Error("Profile not found");
  if (profile.wardNumber === null) throw new Error("User must be assigned to a ward");

  const categoriesSnap = await getDocs(query(collection(db, 'complaintCategories'), where('name', '==', body.category), limit(1)));
  let deptId = 'general';
  let deptName = 'General';
  let slaHours = 72; // Default 3 days

  if (!categoriesSnap.empty) {
    const catData = categoriesSnap.docs[0].data();
    deptId = catData.departmentId;
    deptName = catData.departmentName;
    slaHours = catData.slaHours || 72;
  }

  const wardAdmin = await findWardAdmin(profile.wardNumber);
  const complaintId = `TC-${Math.floor(100000 + Math.random() * 900000)}`;

  const now = new Date();
  const slaDueAt = new Date(now.getTime() + (slaHours * 60 * 60 * 1000));

  const initialActivity = createActivity({
    type: 'COMPLAINT_CREATED',
    user: profile,
    title: 'Complaint Filed',
    description: body.description.substring(0, 100),
  });

  // Prepare base data for auto-assignment logic
  const baseData: any = {
    complaint_id: complaintId,
    wardNumber: profile.wardNumber,
    departmentId: deptId,
    departmentName: deptName,
    categoryName: body.category,
  };

  let assignedStaffId = null;
  let assignedStaffName = null;
  let status = 'Submitted';
  const timeline = [initialActivity];
  const assignmentHistory = [];

  // Assignment Engine Logic removed from creation (Manual 3-hour delay)

  const data: any = {
    complaint_id: complaintId,
    citizenId: fbUser.uid,
    citizenName: profile.fullName,
    wardNumber: profile.wardNumber,
    wardName: profile.wardName,
    departmentId: deptId,
    departmentName: deptName,
    categoryId: categoriesSnap.empty ? 'unknown' : categoriesSnap.docs[0].id,
    categoryName: body.category,
    title: body.title.trim(),
    description: body.description.trim(),
    status: status,
    attachments: body.attachments,
    photos: body.attachments.map(a => a.url), // Legacy compatibility
    assignedStaffId,
    assignedStaffName,
    assignmentHistory,
    remarks: null,
    resolvedAt: null,
    slaDueAt: slaDueAt.toISOString(),
    slaBreached: false,
    timeline,
    comments: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const docRef = await addDoc(collection(db, "complaints"), data);

  // Post-creation: Update staff workload (allowed by relaxed user rules)
  if (assignedStaffId) {
    try {
      await updateDoc(doc(db, "users", assignedStaffId), {
        activeComplaintCount: increment(1),
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn("Failed to increment staff workload counter:", e);
    }
  }

  await logAction({
    action: 'COMPLAINT_CREATED',
    entityType: 'complaint',
    entityId: complaintId
  });

  const d = await getDoc(docRef);
  return mapDoc<Complaint>(d);
};

export const listComplaints = async (): Promise<Complaint[]> => {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const q = query(
    collection(db, "complaints"),
    where("citizenId", "==", user.uid),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(mapDoc<Complaint>);
};

export const getComplaint = async (cid: string): Promise<Complaint> => {
  const doc = await findComplaintSnapshot(cid);
  return mapDoc<Complaint>(doc);
};

export const addComment = async (cid: string, text: string) => {
  const fbUser = auth.currentUser;
  if (!fbUser) throw new Error("Not authenticated");
  const profile = await getProfile(fbUser.uid);

  const cDoc = await findComplaintSnapshot(cid);

  const activity = createActivity({
    type: 'COMMENT_ADDED',
    user: profile!,
    remarks: text,
  });

  await updateDoc(doc(db, "complaints", cDoc.id), {
    timeline: arrayUnion(activity),
    updatedAt: serverTimestamp()
  });
  return activity;
};

export const reopenComplaint = async (cid: string, remarks: string) => {
  if (!remarks?.trim()) {
    throw new Error("Remarks are mandatory when changing the complaint status.");
  }

  const profile = await getProfile(auth.currentUser?.uid || '');
  if (!profile) throw new Error("Profile not found");

  const cDoc = await findComplaintSnapshot(cid);
  const cData = cDoc.data() as Complaint;
  const docId = cDoc.id;

  // Calculate Auto-assignment BEFORE writing to database
  let assignedStaffId = null;
  let assignedStaffName = null;
  let status = 'Submitted';
  const assignmentHistory = [...(cData.assignmentHistory || [])];
  const pendingTimelineEvents = [];

  try {
    const assignmentResult = await processAutoAssignment(cData, true);

    if (assignmentResult.assignedStaff) {
      assignedStaffId = assignmentResult.assignedStaff.uid;
      assignedStaffName = assignmentResult.assignedStaff.fullName;
      status = 'Assigned';
      pendingTimelineEvents.push(assignmentResult.timelineEvent);

      assignmentHistory.push({
        previousStaffId: cData.assignedStaffId || null,
        previousStaffName: cData.assignedStaffName || null,
        newStaffId: assignedStaffId,
        newStaffName: assignedStaffName,
        assignedBy: 'system',
        assignedByName: 'Assignment Engine',
        timestamp: new Date().toISOString(),
      });
    } else {
      status = 'Submitted';
    }
  } catch (e) {
    console.warn("Auto-assignment during reopen failed, falling back to Submitted:", e);
    status = 'Submitted';
  }

  const activity = createActivity({
    type: 'COMPLAINT_REOPENED',
    user: profile,
    remarks,
    oldValue: cData.status,
    newValue: status
  });

  const timeline = [...(cData.timeline || []), activity, ...pendingTimelineEvents];

  // ATOMIC UPDATE: Ensure status and assignment are written together
  await updateDoc(doc(db, "complaints", docId), {
    status,
    assignedStaffId,
    assignedStaffName,
    timeline,
    assignmentHistory,
    updatedAt: serverTimestamp()
  });

  // Post-reopen: Increment staff workload if assigned
  if (assignedStaffId) {
    try {
      await updateDoc(doc(db, "users", assignedStaffId), {
        activeComplaintCount: increment(1),
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn("Failed to increment staff workload during reopen:", e);
    }
  }

  await logAction({ action: 'COMPLAINT_REOPENED', entityType: 'complaint', entityId: cid });

  const d = await getDoc(doc(db, "complaints", docId));
  return mapDoc<Complaint>(d);
};

export const adminList = async (opts: {
  q?: string;
  department?: string;
  status?: string;
  assigned_to?: string;
  wardNumber?: number;
  lastDoc?: any;
  pageSize?: number;
} = {}): Promise<PaginatedResponse<Complaint>> => {
  const fbUser = auth.currentUser;
  if (!fbUser) throw new Error("Not authenticated");
  const profile = await getProfile(fbUser.uid);
  if (!profile) throw new Error("Profile not found");

  const pageSize = opts.pageSize || 20;
  let q = query(collection(db, "complaints"), orderBy("createdAt", "desc"), limit(pageSize));

  // Smart Search for exact Complaint IDs across entire database
  if (opts.q && (opts.q.toUpperCase().startsWith("TCR") || opts.q.toUpperCase().startsWith("TC-"))) {
    const exactMatchQuery = query(collection(db, "complaints"), where("complaint_id", "==", opts.q.toUpperCase().trim()));
    const matchSnap = await getDocs(exactMatchQuery);
    if (!matchSnap.empty) {
      return {
        items: matchSnap.docs.map(mapDoc<Complaint>),
        lastDoc: null,
        hasMore: false
      };
    }
  }

  // Smart Search for Mobile Number (10 digits)
  let citizenIdsByMobile: string[] = [];
  if (opts.q && /^\d{10}$/.test(opts.q)) {
    const citizenQuery = query(collection(db, "users"), where("mobile", "==", opts.q.trim()), where("role", "==", "citizen"), limit(5));
    const citizenSnap = await getDocs(citizenQuery);
    citizenIdsByMobile = citizenSnap.docs.map(d => d.id);
  }

  if (profile.role === 'ward_admin') {
    q = query(q, where("wardNumber", "==", profile.wardNumber));
  } else if (profile.role === 'staff') {
    q = query(q, where("assignedStaffId", "==", fbUser.uid));
  }

  if (opts.wardNumber) q = query(q, where("wardNumber", "==", opts.wardNumber));
  if (opts.department) q = query(q, where("departmentName", "==", opts.department));
  if (opts.status) q = query(q, where("status", "==", opts.status));

  if (opts.assigned_to) {
     if (opts.assigned_to === 'unassigned') {
       q = query(q, where("assignedStaffId", "==", null));
     } else if (opts.assigned_to === 'me') {
       q = query(q, where("assignedStaffId", "==", fbUser.uid));
     }
  }

  if (opts.lastDoc) {
    q = query(q, startAfter(opts.lastDoc));
  }

  const snap = await getDocs(q);
  let results = snap.docs.map(mapDoc<Complaint>);

  if (opts.q) {
    const lower = opts.q.toLowerCase();
    results = results.filter(c =>
      c.title.toLowerCase().includes(lower) ||
      c.description.toLowerCase().includes(lower) ||
      c.complaint_id.toLowerCase().includes(lower) ||
      c.citizenName.toLowerCase().includes(lower) ||
      (c.assignedStaffName && c.assignedStaffName.toLowerCase().includes(lower)) ||
      citizenIdsByMobile.includes(c.citizenId)
    );
  }

  return {
    items: results,
    lastDoc: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length === pageSize
  };
};

export const adminStats = async () => {
  const fbUser = auth.currentUser;
  if (!fbUser) throw new Error("Not authenticated");
  const profile = await getProfile(fbUser.uid);

  let q = query(collection(db, "complaints"));
  if (profile?.role === 'ward_admin') {
    q = query(q, where("wardNumber", "==", profile.wardNumber));
  } else if (profile?.role === 'staff') {
    q = query(q, where("assignedStaffId", "==", fbUser.uid));
  }

  const snap = await getDocs(q);
  const all = snap.docs.map(mapDoc<Complaint>);

  const slaStats = all.map(c => slaUtils.getSLADetails(c));

  return {
    total: all.length,
    submitted: all.filter(c => c.status === 'Submitted').length,
    assigned: all.filter(c => c.status === 'Assigned').length,
    in_progress: all.filter(c => c.status === 'In Progress').length,
    resolved: all.filter(c => c.status === 'Resolved').length,
    closed: all.filter(c => c.status === 'Closed').length,
    unassigned: all.filter(c => !c.assignedStaffId).length,
    reassign_pending: all.filter(c => (c as any).reassign_requested).length,
    slaBreachedCount: slaStats.filter(s => s.isBreached).length,
    dueTodayCount: slaStats.filter(s => s.statusLabel === 'Due Today' || (s.warningLevel === 'ORANGE' && s.timeRemainingHours <= 24)).length,
    dueTomorrowCount: slaStats.filter(s => s.timeRemainingHours > 24 && s.timeRemainingHours <= 48).length,
    nearSlaCount: slaStats.filter(s => s.warningLevel === 'ORANGE').length,
    criticalBreachCount: slaStats.filter(s => s.warningLevel === 'DARK_RED').length,
  };
};

export const getPerformanceMetrics = async (userId: string) => {
  const q = query(collection(db, "complaints"), where("assignedStaffId", "==", userId));
  const snap = await getDocs(q);
  const all = snap.docs.map(mapDoc<Complaint>);
  const resolved = all.filter(c => ['Resolved', 'Closed'].includes(c.status));

  const now = dayjs();
  const weekAgo = now.subtract(7, 'days');
  const monthAgo = now.subtract(30, 'days');

  const slaDetails = resolved.map(c => slaUtils.getSLADetails(c));
  const withinSla = slaDetails.filter(s => !s.isBreached).length;

  const durations = resolved.map(c => slaUtils.calculateDurations(c));

  const avg = (arr: (number | null)[]) => {
    const valid = arr.filter((v): v is number => v !== null);
    return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
  };

  return {
    resolvedThisWeek: resolved.filter(c => dayjs(c.resolvedAt?.toDate?.() || c.resolvedAt).isAfter(weekAgo)).length,
    resolvedThisMonth: resolved.filter(c => dayjs(c.resolvedAt?.toDate?.() || c.resolvedAt).isAfter(monthAgo)).length,
    resolvedWithinSLA: withinSla,
    resolvedAfterSLA: resolved.length - withinSla,
    avgResolutionTime: avg(durations.map(d => d.resolutionDuration)),
    avgVerificationTime: avg(durations.map(d => d.verificationDuration)),
    slaComplianceRate: resolved.length > 0 ? (withinSla / resolved.length) * 100 : 100,
  };
};

export const adminUpdateStatus = async (cid: string, body: { status: string; remarks?: string }) => {
  const fbUser = auth.currentUser;
  if (!fbUser) throw new Error("Not authenticated");
  const profile = await getProfile(fbUser.uid);
  if (!profile) throw new Error("Profile not found");

  const cDoc = await findComplaintSnapshot(cid);
  const cData = cDoc.data() as Complaint;

  if (!workflowApi.isValidTransition(cData.status, body.status)) {
    throw new Error(`Invalid transition from ${cData.status} to ${body.status}`);
  }

  const allowedTransitions = workflowApi.getAllowedTransitions(profile, cData);
  if (!allowedTransitions.includes(body.status)) {
    throw new Error(`You are not authorized to move this complaint to ${body.status}`);
  }

  // Mandatory Remarks Validation
  if (body.status !== cData.status && !body.remarks?.trim()) {
    throw new Error("Remarks are mandatory when changing the complaint status.");
  }

  const update: any = {
    status: body.status,
    remarks: body.remarks || cData.remarks || null,
    updatedAt: serverTimestamp()
  };
  if (body.status === 'Resolved') update.resolvedAt = serverTimestamp();

  let activityType: TimelineActivityType = 'STATUS_CHANGED';
  if (body.status === 'Accepted') activityType = 'ASSIGNMENT_ACCEPTED';
  else if (body.status === 'Rejected') activityType = 'ASSIGNMENT_REJECTED';
  else if (body.status === 'In Progress') activityType = 'WORK_STARTED';
  else if (body.status === 'Resolved') activityType = 'COMPLAINT_RESOLVED';
  else if (body.status === 'Closed') activityType = 'COMPLAINT_CLOSED';
  else if (body.status === 'Cancelled') activityType = 'COMPLAINT_CANCELLED';

  const activity = createActivity({
    type: activityType,
    user: profile,
    title: `Status: ${body.status}`,
    remarks: body.remarks,
    oldValue: cData.status,
    newValue: body.status
  });

  update.timeline = arrayUnion(activity);
  await updateDoc(doc(db, "complaints", cDoc.id), update);

  await logAction({
    action: 'STATUS_CHANGED',
    entityType: 'complaint',
    entityId: cid,
    changes: { prev: cData.status, next: body.status }
  });

  if ((body.status === 'Closed' || body.status === 'Cancelled' || body.status === 'Rejected') && cData.assignedStaffId) {
    const updates: any = {
      activeComplaintCount: increment(-1),
      updatedAt: serverTimestamp()
    };

    if (body.status === 'Closed') {
      const staffRef = doc(db, 'users', cData.assignedStaffId);
      const staffSnap = await getDoc(staffRef);
      const staffData = staffSnap.data();

      const created = dayjs(cData.createdAt?.toDate?.() || cData.createdAt);
      const closed = dayjs();
      const durationHours = closed.diff(created, 'hour');

      const totalCompleted = (staffData?.completedComplaintCount || 0) + 1;
      const currentAvg = staffData?.averageResolutionTime || 0;
      const newAvg = ((currentAvg * (totalCompleted - 1)) + durationHours) / totalCompleted;

      updates.completedComplaintCount = increment(1);
      updates.averageResolutionTime = newAvg;
    }

    await updateDoc(doc(db, 'users', cData.assignedStaffId), updates);
  }

  await notificationService.notifyStatusChange(cData.citizenId, 'citizen', cData.complaint_id, body.status);

  if (cData.assignedStaffId) {
     await notificationService.notifyStatusChange(cData.assignedStaffId, 'staff', cData.complaint_id, body.status);
  }

  if (body.status === 'Resolved' || body.status === 'Closed') {
    await notificationService.notifyCitizen(cData.citizenId, cData.complaint_id, `Status updated to ${body.status}`);
  }

  const d = await getDoc(doc(db, "complaints", cDoc.id));
  return mapDoc<Complaint>(d);
};

export const updateComplaintFields = async (cid: string, updates: Partial<Complaint>) => {
  const fbUser = auth.currentUser;
  if (!fbUser) throw new Error("Not authenticated");
  const profile = await getProfile(fbUser.uid);
  if (profile?.role !== 'super_admin') throw new Error("Unauthorized manual override");

  const cDoc = await findComplaintSnapshot(cid);
  const cData = cDoc.data() as Complaint;

  const data: any = {
    ...updates,
    updatedAt: serverTimestamp()
  };

  // If category changed, update department and SLA automatically
  if (updates.categoryName && updates.categoryName !== cData.categoryName) {
    const catSnap = await getDocs(query(collection(db, 'complaintCategories'), where('name', '==', updates.categoryName), limit(1)));
    if (!catSnap.empty) {
      const catData = catSnap.docs[0].data();
      data.categoryId = catSnap.docs[0].id;
      data.departmentId = catData.departmentId;
      data.departmentName = catData.departmentName;
    }
  }

  const activity = createActivity({
    type: 'CITIZEN_UPDATED_INFO', // Reuse type for generic info update
    user: profile,
    title: 'Manual Information Override',
    remarks: 'Super Admin updated complaint metadata.'
  });

  await updateDoc(doc(db, "complaints", cDoc.id), {
    ...data,
    timeline: arrayUnion(activity)
  });

  await logAction({
    action: 'COMPLAINT_UPDATED',
    entityType: 'complaint',
    entityId: cid,
    changes: updates
  });

  return (await getComplaint(cid));
};

export const deleteComplaint = async (cid: string) => {
  const fbUser = auth.currentUser;
  if (!fbUser) throw new Error("Not authenticated");
  const profile = await getProfile(fbUser.uid);
  if (profile?.role !== 'super_admin') throw new Error("Unauthorized deletion");

  const cDoc = await findComplaintSnapshot(cid);
  await updateDoc(doc(db, "complaints", cDoc.id), {
    status: 'Deleted',
    isDeleted: true,
    updatedAt: serverTimestamp()
  });

  await logAction({
    action: 'COMPLAINT_DELETED',
    entityType: 'complaint',
    entityId: cid
  });
};
