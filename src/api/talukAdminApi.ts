import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp, setDoc, limit } from "firebase/firestore";
import { createUserWithEmailAndPassword, signOut as firebaseSignOut } from "firebase/auth";
import { db } from "@/src/config/firebase";
import { logAction } from "./auditApi";
import { notificationService } from "@/src/services/notifications";
import { getProfile, getSecondaryAuth, mapDoc, type User } from "./client";

export const listTalukAdmins = async (): Promise<User[]> => {
  const q = query(collection(db, "users"), where("role", "==", "taluk_admin"));
  const snap = await getDocs(q);
  return snap.docs.map(d => mapDoc<User>(d));
};

export const listAdmins = async () => {
  return listTalukAdmins();
};

export const createTalukAdmin = async (data: { fullName: string; email: string; mobile: string; district: string; taluk: string; password?: string }): Promise<User> => {
  const password = data.password || "TempPass123!";
  const authInstance = getSecondaryAuth();
  const cred = await createUserWithEmailAndPassword(authInstance, data.email, password);
  const uid = cred.user.uid;
  await firebaseSignOut(authInstance);

  const userDoc: Partial<User> = {
    uid,
    fullName: data.fullName,
    email: data.email,
    mobile: data.mobile,
    role: 'taluk_admin',
    district: data.district,
    taluk: data.taluk,
    isActive: true,
  };

  await setDoc(doc(db, 'users', uid), {
    ...userDoc,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await logAction({ action: 'TALUK_ADMIN_CREATED', entityType: 'auth', entityId: uid, changes: { prev: null, next: data.fullName } });
  await notificationService.notifyAccountCreated(uid, 'taluk_admin', data.fullName);

  return (await getProfile(uid))!;
};

export const updateTalukAdmin = async (uid: string, data: Partial<User>): Promise<User> => {
  await updateDoc(doc(db, "users", uid), {
    ...data,
    updatedAt: serverTimestamp()
  });
  return (await getProfile(uid))!;
};

export const promoteToAdmin = async (uid: string) => {
  await updateDoc(doc(db, "users", uid), { role: 'taluk_admin', updatedAt: serverTimestamp() });
  return (await getProfile(uid))!;
};

export const demoteAdmin = async (uid: string) => {
  await updateDoc(doc(db, "users", uid), { role: 'staff', updatedAt: serverTimestamp() });
  return (await getProfile(uid))!;
};

export const getTalukAdminContact = async (taluk: string): Promise<User | null> => {
  const q = query(
    collection(db, "users"),
    where("role", "==", "taluk_admin"),
    where("taluk", "==", taluk),
    where("isActive", "==", true),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return getProfile(snap.docs[0].id);
};

// Aliases for backward compatibility in codebase imports
export const listWardAdmins = listTalukAdmins;
export const createWardAdmin = createTalukAdmin;
export const updateWardAdmin = updateTalukAdmin;
export const getWardAdminContact = getTalukAdminContact;
