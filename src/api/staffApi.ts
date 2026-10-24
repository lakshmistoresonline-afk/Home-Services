import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp, setDoc, increment, getDoc, limit, arrayUnion } from "firebase/firestore";
import { createUserWithEmailAndPassword, signOut as firebaseSignOut } from "firebase/auth";
import { auth, db } from "@/src/config/firebase";
import { logAction } from "./auditApi";
import { createActivity } from "./timelineApi";
import { findComplaintSnapshot } from "./complaintApi";
import { notificationService } from "@/src/services/notifications";
import { isStaffEligible } from "./assignmentUtils";
import { processAutoAssignment, commitAssignment } from "./assignmentEngine";
import { getProfile, getSecondaryAuth, mapDoc, mapUserDoc, type User, type AssignmentEntry, type Complaint, type TimelineActivityType, guardAuth, isLoggingOutState } from "./client";

export const listCorporationStaff = async (wardNumber?: number): Promise<User[]> => {
  guardAuth();
  const fbUser = auth.currentUser;
  if (!fbUser) throw new Error("Not authenticated");

  // Load actor profile to determine jurisdiction and role
  const actor = await getProfile(fbUser.uid);
  if (!actor) throw new Error("Authorization error: Profile not found");

  const staffRef = collection(db, "users");

  // Optimized Query: For Super Admin (Full or Read-Only), query all staff.
  // For Ward Admin, we fetch the staff pool authorized for municipal assignment.
  // The security rules are flattened to permit these queries.
  if (actor.role === 'super_admin' || actor.role === 'readonly_super_admin') {
    guardAuth();
    const q = query(staffRef, where("role", "==", "staff"));
    const snap = await getDocs(q);
    return snap.docs.map(d => mapUserDoc(d));
  }

  if (actor.role === 'ward_admin') {
    const targetWard = wardNumber || actor.wardNumber;
    if (!targetWard) throw new Error("Ward Admin must be assigned to a ward");

    // Defensive execution for jurisdictional pool
    // Wrapped in individual try/catches to survive index-building phases
    let universalSnap, localSnap;

    try {
      guardAuth();
      universalSnap = await getDocs(query(staffRef, where("role", "==", "staff"), where("hasAllWardAccess", "==", true)));
    } catch (e) {
      if (!isLoggingOutState()) {
        console.error("Staff pool (Universal) load failed. Check indexes.", e);
      }
    }

    try {
      guardAuth();
      localSnap = await getDocs(query(staffRef, where("role", "==", "staff"), where("assignedWardNumbers", "array-contains", targetWard)));
    } catch (e) {
      if (!isLoggingOutState()) {
        console.error(`Staff pool (Ward ${targetWard}) load failed. Check indexes.`, e);
      }
    }

    const seen = new Set();
    const results: User[] = [];

    if (universalSnap) {
      universalSnap.docs.forEach(doc => {
        if (!seen.has(doc.id)) {
          seen.add(doc.id);
          results.push(mapUserDoc(doc));
        }
      });
    }

    if (localSnap) {
      localSnap.docs.forEach(doc => {
        if (!seen.has(doc.id)) {
          seen.add(doc.id);
          results.push(mapUserDoc(doc));
        }
      });
    }

    return results;
  }

  throw new Error("Unauthorized: Staff directory is restricted to administrators.");
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
      throw new Error(`Staff member ${staff.fullName} is not eligible for this complaint (Ward/Department mismatch).`);
    }
  }

  if (profile.role === 'ward_admin') {
    if (cData.wardNumber !== profile.wardNumber) {
      throw new Error("Unauthorized ward access");
    }
  }

  const activityType: TimelineActivityType = staff_id ? (cData.assignedStaffId ? 'COMPLAINT_REASSIGNED' : 'COMPLAINT_ASSIGNED') : 'STAFF_CHANGED';
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
    profile
  );

  const d = await getDocs(query(collection(db, "complaints"), where("complaint_id", "==", cid), limit(1)));
  return mapDoc<Complaint>(d.docs[0]);
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
