import {
  collection,
  query,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  setDoc,
  orderBy,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/src/config/firebase";
import { type Ward } from "./client";
import { logAction } from "./auditApi";

/**
 * Lists all wards from the system.
 */
export const listWards = async (): Promise<Ward[]> => {
  try {
    const q = query(collection(db, "wards"), orderBy("wardNumber", "asc"));
    const snap = await getDocs(q);
    if (snap.empty) return [];
    return snap.docs.map(d => ({ ...d.data() } as Ward));
  } catch (e) {
    console.error('Failed to list wards:', e);
    return [];
  }
};

/**
 * Adds or updates a ward record.
 */
export const upsertWard = async (data: Ward) => {
  const ref = doc(db, "wards", data.wardNumber.toString());
  await setDoc(ref, {
    ...data,
    updatedAt: serverTimestamp()
  }, { merge: true });

  await logAction({
    action: 'WARD_UPDATED',
    entityType: 'system',
    entityId: data.wardNumber.toString(),
    changes: { next: data.name }
  });
};

/**
 * Toggles a ward's active status.
 */
export const toggleWard = async (wardNumber: number, isActive: boolean) => {
  const ref = doc(db, "wards", wardNumber.toString());
  await updateDoc(ref, {
    isActive,
    updatedAt: serverTimestamp()
  });

  await logAction({
    action: isActive ? 'WARD_ACTIVATED' : 'WARD_DEACTIVATED',
    entityType: 'system',
    entityId: wardNumber.toString()
  });
};

/**
 * Deletes a ward record.
 */
export const deleteWard = async (wardNumber: number) => {
  const ref = doc(db, "wards", wardNumber.toString());
  await deleteDoc(ref);

  await logAction({
    action: 'WARD_DELETED',
    entityType: 'system',
    entityId: wardNumber.toString()
  });
};
