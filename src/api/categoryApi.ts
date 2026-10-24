import { collection, query, orderBy, getDocs, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/src/config/firebase";
import { logAction } from "./auditApi";
import { type ComplaintCategory } from "./client";

export const listCategories = async (): Promise<ComplaintCategory[]> => {
  try {
    const q = query(collection(db, "complaintCategories"), orderBy("displayOrder", "asc"));
    const snap = await getDocs(q);
    if (snap.empty) return [];
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ComplaintCategory));
  } catch (e) {
    console.error('Failed to list categories:', e);
    return [];
  }
};

export const addCategory = async (data: Omit<ComplaintCategory, 'id'>) => {
  const res = await addDoc(collection(db, "complaintCategories"), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await logAction({ action: 'CATEGORY_CREATED', entityType: 'category', entityId: res.id, changes: { prev: null, next: data.name } });
  return res;
};

export const updateCategory = async (id: string, data: Partial<ComplaintCategory>) => {
  await updateDoc(doc(db, "complaintCategories", id), { ...data, updatedAt: serverTimestamp() });
  await logAction({ action: 'CATEGORY_UPDATED', entityType: 'category', entityId: id, changes: { prev: 'Update', next: data.name } });
};

export const deleteCategory = async (id: string) => {
  await deleteDoc(doc(db, "complaintCategories", id));
  await logAction({ action: 'CATEGORY_DELETED', entityType: 'category', entityId: id });
};
