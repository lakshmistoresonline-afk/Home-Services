import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp, setDoc, increment, getDoc, limit, arrayUnion } from "firebase/firestore";
import { createUserWithEmailAndPassword, signOut as firebaseSignOut } from "firebase/auth";
import { auth, db } from "@/src/config/firebase";
import { logAction } from "./auditApi";
import { createActivity } from "./timelineApi";
import { findServiceRequestSnapshot as findComplaintSnapshot } from "./serviceRequestApi";
import { notificationService } from "@/src/services/notifications";
import { isStaffEligible } from "./assignmentUtils";
import { processAutoAssignment, commitAssignment } from "./assignmentEngine";
import { getProfile, getSecondaryAuth, mapDoc, mapUserDoc, type User, type AssignmentEntry, type Complaint, type TimelineActivityType, guardAuth, isLoggingOutState } from "./client";

export const listCorporationStaff = async (wardNumber?: number): Promise<User[]> => {
  try {
    const fbUser = auth.currentUser;
    if (!fbUser) return [];

    const actor = await getProfile(fbUser.uid);
    const staffRef = collection(db, "users");

    if (!actor || actor.role === 'super_admin' || actor.role === 'readonly_super_admin' || actor.role === 'taluk_admin') {
      const q = query(staffRef, where("role", "==", "staff"));
      const snap = await getDocs(q);
      return snap.docs.map(d => mapUserDoc(d));
    }

    const q = query(staffRef, where("role", "==", "staff"));
    const snap = await getDocs(q);
    return snap.docs.map(d => mapUserDoc(d));
  } catch (e: any) {
    console.warn("Failed to list corporation staff (handled):", e?.message || e);
    return [];
  }
};

export const listStaffBySubCategorySkill = async (subCategoryName?: string, categoryName?: string): Promise<User[]> => {
  const staff = await listCorporationStaff();
  if (!subCategoryName && !categoryName) return staff;

  const targetSkill = (subCategoryName || categoryName || '').toLowerCase().trim();

  // Rank staff members with matching category or department skills at the top
  return staff.sort((a, b) => {
    const aMatch = (a.categories || []).some(c => c.toLowerCase().includes(targetSkill)) ||
                   (a.departments || []).some(d => d.toLowerCase().includes(targetSkill));
    const bMatch = (b.categories || []).some(c => c.toLowerCase().includes(targetSkill)) ||
                   (b.departments || []).some(d => d.toLowerCase().includes(targetSkill));

    if (aMatch && !bMatch) return -1;
    if (!aMatch && bMatch) return 1;
    return (a.activeServiceCount || 0) - (b.activeServiceCount || 0);
  });
};

export const generateEmployeeId = async (): Promise<string> => {
  const counterRef = doc(db, "metadata", "counters");
  const snap = await getDoc(counterRef);
  let nextNum = 1;

  if (snap.exists()) {
    nextNum = (snap.data().staffId || 0) + 1;
    await updateDoc(counterRef, { staffId: nextNum });
  } else {
    await setDoc(counterRef, { staffId: 1 });
  }

  return `EMP${nextNum.toString().padStart(5, '0')}`;
};

export const createStaff = async (data: {
  fullName: string;
  email: string;
  mobile: string;
  password: string;
  departments: string[];
  departmentIds: string[];
  categories: string[];
  designation: string;
  assignedWardNumbers?: number[];
  hasAllWardAccess?: boolean;
  isActive?: boolean;
}): Promise<User> => {
  const employeeId = await generateEmployeeId();

  const authInstance = getSecondaryAuth();
  const cred = await createUserWithEmailAndPassword(authInstance, data.email, data.password);
  const uid = cred.user.uid;
  await firebaseSignOut(authInstance);

  const hasAllWardAccess = data.hasAllWardAccess ?? true;
  const assignedWardNumbers = data.assignedWardNumbers || [];

  const userDoc: Partial<User> = {
    uid,
    employeeId,
    fullName: data.fullName,
    email: data.email,
    mobile: data.mobile,
    role: 'staff',
    assignedWardNumbers: assignedWardNumbers,
    hasAllWardAccess: hasAllWardAccess,
    wardNumber: null,
    wardName: null,
    departments: data.departments,
    departmentIds: data.departmentIds,
    departmentNames: data.departments,
    categories: data.categories,
    designation: data.designation,
    isActive: data.isActive ?? true,
    activeComplaintCount: 0,
    completedComplaintCount: 0,
    rating: 5.0,
    joiningDate: new Date().toISOString(),
  };

  await setDoc(doc(db, 'users', uid), {
    ...userDoc,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await logAction({ action: 'STAFF_CREATED', entityType: 'auth', entityId: uid, changes: { prev: null, next: data.fullName } });
  await notificationService.notifyAccountCreated(uid, 'ward_admin', data.fullName);

  return (await getProfile(uid))!;
};

export const listStaff = async () => {
  return listCorporationStaff();
};

export const updateStaff = async (uid: string, data: Partial<User>): Promise<User> => {
  await updateDoc(doc(db, "users", uid), {
    ...data,
    updatedAt: serverTimestamp()
  });
  await logAction({ action: 'STAFF_UPDATED', entityType: 'staff', entityId: uid, changes: { prev: 'Profile Update', next: data.fullName } });
  return (await getProfile(uid))!;
};

export const toggleStaff = async (uid: string, isActive: boolean) => {
  await updateDoc(doc(db, "users", uid), { isActive, updatedAt: serverTimestamp() });
  await logAction({ action: 'STAFF_TOGGLE', entityType: 'staff', entityId: uid, changes: { prev: !isActive, next: isActive } });
  return (await getProfile(uid))!;
};

export const assignComplaint = async (cid: string, staff_id: string | null, remarks?: string) => {
  const fbUser = auth.currentUser;
  if (!fbUser) throw new Error("Not authenticated");
  const profile = await getProfile(fbUser.uid);
  if (!profile) throw new Error("Profile not found");

  const cDoc = await findComplaintSnapshot(cid);
  const cData = cDoc.data() as Complaint;

  let staff = null;
  if (staff_id) {
    staff = await getProfile(staff_id);
    if (staff && !isStaffEligible(staff, cData)) {
      throw new Error(`Staff member ${staff.fullName} is not eligible for this service request (Department mismatch).`);
    }
  }

  if (profile.role === 'ward_admin' || profile.role === 'taluk_admin') {
    if (profile.taluk && cData.taluk && profile.taluk.trim().toLowerCase() !== cData.taluk.trim().toLowerCase()) {
      throw new Error("Unauthorized Taluk jurisdiction access");
    }
  }

  const activityType: TimelineActivityType = staff_id ? (cData.assignedStaffId ? 'SERVICE_REQUEST_ASSIGNED' : 'SERVICE_REQUEST_ASSIGNED') : 'STAFF_CHANGED';
  const activity = createActivity({
    type: activityType,
    user: profile,
    title: staff_id ? `Assigned to ${staff?.fullName}` : 'Assignment Cleared',
    remarks: remarks || null,
    oldValue: cData.assignedStaffName,
    newValue: staff?.fullName || null
  });

  await commitAssignment(
    cid,
    cData,
    staff,
    staff_id ? 'Assigned' : 'Submitted',
    activity,
    profile,
    cDoc.id
  );

  const docSnap = await findComplaintSnapshot(cid);
  return mapDoc<Complaint>(docSnap);
};

export const adminUpdateStatus = async (
  cid: string,
  data: {
    status?: string;
    remarks?: string;
    price?: number | null;
    paymentMethod?: 'UPI_QR' | 'Cash' | null;
    paymentStatus?: 'Pending' | 'Paid' | 'Cash on Delivery' | null;
  }
): Promise<Complaint> => {
  const fbUser = auth.currentUser;
  if (!fbUser) throw new Error("Not authenticated");
  const profile = await getProfile(fbUser.uid);
  if (!profile) throw new Error("Profile not found");

  const cDoc = await findComplaintSnapshot(cid);
  const cData = cDoc.data() as Complaint;

  const newStatus = data.status || cData.status;
  const remarks = data.remarks?.trim() || cData.remarks || null;

  const activity = createActivity({
    type: 'PROGRESS_UPDATED',
    user: profile,
    title: `Status updated to ${newStatus}${data.paymentMethod ? ` (${data.paymentMethod} Payment)` : ''}`,
    remarks: remarks,
    oldValue: cData.status,
    newValue: newStatus,
  });

  const updateData: any = {
    status: newStatus,
    remarks: remarks,
    timeline: arrayUnion(activity),
    updatedAt: serverTimestamp(),
  };

  if (data.price !== undefined && data.price !== null) {
    updateData.price = Number(data.price);
  }
  if (data.paymentMethod) {
    updateData.paymentMethod = data.paymentMethod;
  }
  if (data.paymentStatus) {
    updateData.paymentStatus = data.paymentStatus;
  }

  if (newStatus === 'Resolved' || newStatus === 'Completed') {
    updateData.resolvedAt = new Date().toISOString();
  }

  await updateDoc(doc(db, "serviceRequests", cDoc.id), updateData);
  await logAction({
    action: 'STATUS_UPDATED',
    entityType: 'service_request',
    entityId: cid,
    changes: { prev: cData.status, next: newStatus }
  });

  const updatedDoc = await findComplaintSnapshot(cid);
  return mapDoc<Complaint>(updatedDoc);
};

export const reopenComplaint = async (cid: string, remarks?: string): Promise<Complaint> => {
  return adminUpdateStatus(cid, { status: 'In Progress', remarks: remarks || 'Service request reopened' });
};

export const requestReassignment = async (cid: string, reason: string) => {
  const fbUser = auth.currentUser;
  if (!fbUser) throw new Error("Not authenticated");
  const profile = await getProfile(fbUser.uid);
  if (!profile) throw new Error("Profile not found");

  const cDoc = await findComplaintSnapshot(cid);

  const activity = createActivity({
    type: 'PROGRESS_UPDATED',
    user: profile,
    title: 'Reassignment Requested',
    remarks: reason
  });

  await updateDoc(doc(db, "complaints", cDoc.id), {
    reassign_requested: true,
    reassign_reason: reason,
    reassign_requested_by: fbUser.uid,
    reassign_requested_by_name: profile.fullName,
    timeline: arrayUnion(activity),
    updatedAt: serverTimestamp()
  });
  const d = await getDocs(query(collection(db, "complaints"), where("complaint_id", "==", cid), limit(1)));
  return mapDoc<Complaint>(d.docs[0]);
};
