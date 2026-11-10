import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
  increment,
  arrayUnion,
  getDoc,
  limit,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/src/config/firebase";
import {
  type User,
  type Complaint,
  type AssignmentEntry,
  type TimelineActivity,
  mapUserDoc,
  mapDoc,
  getProfile,
} from "./client";
import { isStaffEligible, rankStaff } from "./assignmentUtils";
import { createActivity } from "./timelineApi";
import { logAction } from "./auditApi";
import { notificationService } from "@/src/services/notifications";

/**
 * Internal helper to fetch the eligible staff pool for a Taluk.
 * Bypasses administrative role checks to allow system-level automation.
 */
export const getStaffPool = async (taluk?: string): Promise<User[]> => {
  const staffRef = collection(db, "users");
  const results: User[] = [];
  const seen = new Set<string>();

  const qAll = query(
    staffRef,
    where("role", "==", "staff"),
    where("isActive", "==", true)
  );
  const snap = await getDocs(qAll);
  snap.docs.forEach((d) => {
    const u = mapUserDoc(d);
    if (!seen.has(u.uid)) {
      if (!taluk || !u.taluk || u.taluk === taluk || u.taluk === 'Thrissur') {
        seen.add(u.uid);
        results.push(u);
      }
    }
  });

  return results;
};

/**
 * Finds the best eligible staff member for a service request.
 */
export const findBestStaff = async (complaint: Complaint): Promise<User | null> => {
  const pool = await getStaffPool(complaint.taluk);
  const eligible = pool.filter((s) =>
    isStaffEligible(s, complaint)
  );

  if (eligible.length === 0) return null;

  const ranked = rankStaff(eligible, complaint);
  return ranked[0];
};

/**
 * Orchestrates the automatic assignment logic.
 * Can be called after complaint creation or upon reopening.
 */
export const processAutoAssignment = async (
  complaint: Complaint,
  isReopen: boolean = false
): Promise<{
  assignedStaff: User | null;
  status: string;
  timelineEvent: TimelineActivity;
  method: "PREVIOUS" | "AUTO" | "NONE";
}> => {
  let selectedStaff: User | null = null;
  let method: "PREVIOUS" | "AUTO" | "NONE" = "NONE";
  let status = "Submitted";
  let timelineTitle = "Automatic Assignment Pending";
  let timelineRemarks = "No eligible staff available. Manual assignment required.";

  // Scenario 2: Reopened Complaint - Priority 1: Previous Staff
  if (isReopen && complaint.assignedStaffId) {
    const prevStaff = await getProfile(complaint.assignedStaffId);
    if (prevStaff && isStaffEligible(prevStaff, complaint)) {
      selectedStaff = prevStaff;
      method = "PREVIOUS";
      timelineTitle = "Reassigned to Previous Staff";
      timelineRemarks = "Complaint reopened and automatically reassigned to previous staff.";
    }
  }

  // Scenario 1 & 2 Fallback - Priority 2: Automatic Engine
  if (!selectedStaff) {
    selectedStaff = await findBestStaff(complaint);
    if (selectedStaff) {
      method = "AUTO";
      timelineTitle = `Automatically Assigned`;
      timelineRemarks = isReopen
        ? "Previous staff unavailable. Complaint automatically reassigned."
        : `Complaint automatically assigned to ${selectedStaff.fullName}.`;
    }
  }

  if (selectedStaff) {
    status = "Assigned";
  }

  // Create the timeline event (caller should commit this)
  const systemUser: User = {
    uid: "system",
    fullName: "Assignment Engine",
    role: "super_admin", // System acts with high priv
  } as any;

  const event = createActivity({
    type: isReopen ? "COMPLAINT_REASSIGNED" : "COMPLAINT_ASSIGNED",
    user: systemUser,
    title: timelineTitle,
    remarks: timelineRemarks,
    newValue: selectedStaff?.fullName || null,
    oldValue: isReopen ? complaint.assignedStaffName : null,
  });

  return {
    assignedStaff: selectedStaff,
    status,
    timelineEvent: event,
    method,
  };
};

/**
 * Finalizes the assignment in Firestore.
 * Handles status update, history, timeline, workload counters, and notifications.
 */
export const commitAssignment = async (
  complaintId: string,
  complaintData: Complaint,
  assignedStaff: User | null,
  status: string,
  timelineEvent: TimelineActivity,
  actor: User,
  providedDocId?: string
) => {
  let docId = providedDocId;

  if (!docId) {
    // 1. Try direct doc lookup by ID
    try {
      const directDoc = await getDoc(doc(db, "serviceRequests", complaintId));
      if (directDoc.exists()) docId = directDoc.id;
    } catch (e) { }

    if (!docId) {
      let q = query(
        collection(db, "serviceRequests"),
        where("complaint_id", "==", complaintId),
        limit(1)
      );

      // If actor is a citizen, we MUST add the owner filter to satisfy security rules
      if (actor.role === 'citizen') {
        q = query(collection(db, "serviceRequests"), where("citizenId", "==", actor.uid), where("complaint_id", "==", complaintId), limit(1));
      }

      const snap = await getDocs(q);
      if (snap.empty) throw new Error("Service request not found or access denied");
      docId = snap.docs[0].id;
    }
  }

  const historyEntry: AssignmentEntry = {
    previousStaffId: complaintData.assignedStaffId || null,
    previousStaffName: complaintData.assignedStaffName || null,
    newStaffId: assignedStaff?.uid || null,
    newStaffName: assignedStaff?.fullName || null,
    assignedBy: actor.uid,
    assignedByName: actor.fullName,
    timestamp: new Date().toISOString(),
  };

  const updates: any = {
    assignedStaffId: assignedStaff?.uid || null,
    assignedStaffName: assignedStaff?.fullName || null,
    status: status,
    assignmentHistory: arrayUnion(historyEntry),
    timeline: arrayUnion(timelineEvent),
    updatedAt: serverTimestamp(),
  };

  // Update workload counters
  if (complaintData.assignedStaffId && complaintData.assignedStaffId !== assignedStaff?.uid) {
    try {
      await updateDoc(doc(db, "users", complaintData.assignedStaffId), {
        activeComplaintCount: increment(-1),
        updatedAt: serverTimestamp(),
      });
    } catch (e: any) {
      console.warn("Staff workload decrement notice (handled):", e?.message || e);
    }
  }

  if (assignedStaff && complaintData.assignedStaffId !== assignedStaff.uid) {
    try {
      await updateDoc(doc(db, "users", assignedStaff.uid), {
        activeComplaintCount: increment(1),
        updatedAt: serverTimestamp(),
      });
    } catch (e: any) {
      console.warn("Staff workload increment notice (handled):", e?.message || e);
    }
  }

  await updateDoc(doc(db, "serviceRequests", docId!), updates);

  // Audit Log
  await logAction({
    action: assignedStaff ? "SERVICE_REQUEST_ASSIGNED" : "SERVICE_REQUEST_UNASSIGNED",
    entityType: "service_request",
    entityId: complaintId,
    changes: { prev: complaintData.assignedStaffName, next: assignedStaff?.fullName || null },
  });

  // Notifications
  if (assignedStaff) {
    await notificationService.notifyStaffAssignment(
      assignedStaff.uid,
      complaintId,
      complaintData.title
    );
    await notificationService.notifyCitizen(
      complaintData.citizenId,
      complaintId,
      `Staff member ${assignedStaff.fullName} has been assigned to your complaint.`
    );
  }
};

/**
 * Runs a background maintenance sweep to handle delayed assignments and auto-closures.
 * Designed to be triggered by an Administrative user.
 */
export const runMaintenanceSweep = async (actor: User) => {
  if (actor?.role !== 'super_admin') return;

  try {
    const now = new Date();
    const threeHoursAgo = new Timestamp(Math.floor((now.getTime() - 3 * 60 * 60 * 1000) / 1000), 0);
    const sevenDaysAgo = new Timestamp(Math.floor((now.getTime() - 7 * 24 * 60 * 60 * 1000) / 1000), 0);

    const qDelayed = query(
      collection(db, "serviceRequests"),
      where("status", "==", "Submitted"),
      where("createdAt", "<=", threeHoursAgo),
      limit(10)
    );

    const delayedSnap = await getDocs(qDelayed);
    for (const complaintDoc of delayedSnap.docs) {
      const complaint = mapDoc<Complaint>(complaintDoc);
      try {
        const result = await processAutoAssignment(complaint, false);
        if (result.assignedStaff) {
          await commitAssignment(
            complaint.complaint_id,
            complaint,
            result.assignedStaff,
            result.status,
            result.timelineEvent,
            { uid: 'system', fullName: 'Assignment Engine' } as any,
            complaintDoc.id
          );
        }
      } catch (e) { }
    }

    // 2. Handle Auto-Closure (7-day rule)
    const qAutoClose = query(
      collection(db, "serviceRequests"),
      where("status", "==", "Resolved"),
      where("resolvedAt", "<=", sevenDaysAgo),
      limit(10)
    );

    const autoCloseSnap = await getDocs(qAutoClose);
    for (const complaintDoc of autoCloseSnap.docs) {
      const complaint = mapDoc<Complaint>(complaintDoc);
      try {
        const activity = createActivity({
          type: 'REQUEST_CLOSED',
          user: { uid: 'system', fullName: 'Assignment Engine', role: 'super_admin' } as any,
          title: 'Automatically Closed',
          remarks: 'Service request automatically closed after 7 days of inactivity in Resolved status.',
          oldValue: 'Resolved',
          newValue: 'Closed'
        });

        await updateDoc(doc(db, "serviceRequests", complaintDoc.id), {
          status: 'Closed',
          timeline: arrayUnion(activity),
          updatedAt: serverTimestamp()
        });

        if (complaint.assignedStaffId) {
          await updateDoc(doc(db, "users", complaint.assignedStaffId), {
            activeComplaintCount: increment(-1),
            completedComplaintCount: increment(1),
            updatedAt: serverTimestamp()
          });
        }

        await logAction({
          action: 'STATUS_CHANGED',
          entityType: 'service_request',
          entityId: complaint.complaint_id,
          changes: { prev: 'Resolved', next: 'Closed', note: 'auto-close' }
        });
      } catch (e) { }
    }
  } catch (e: any) {
    console.warn("Maintenance sweep notice (handled):", e?.message || e);
  }
};

export const assignmentEngine = {
  getStaffPool, findBestStaff, processAutoAssignment, commitAssignment, runMaintenanceSweep
};
