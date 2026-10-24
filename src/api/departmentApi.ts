import { collection, query, orderBy, getDocs, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/src/config/firebase";
import { logAction } from "./auditApi";
import { type Department } from "./client";

export const listDepartments = async (): Promise<Department[]> => {
  try {
    const q = query(collection(db, "departments"), orderBy("displayOrder", "asc"));
    const snap = await getDocs(q);
    if (snap.empty) return [];
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Department));
  } catch (e) {
    console.error('Failed to list departments:', e);
    return [];
  }
};

export const addDepartment = async (data: Omit<Department, 'id'>) => {
  const res = await addDoc(collection(db, "departments"), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await logAction({ action: 'DEPARTMENT_CREATED', entityType: 'department', entityId: res.id, changes: { prev: null, next: data.name } });
  return res;
};

export const updateDepartment = async (id: string, data: Partial<Department>) => {
  await updateDoc(doc(db, "departments", id), { ...data, updatedAt: serverTimestamp() });
  await logAction({ action: 'DEPARTMENT_UPDATED', entityType: 'department', entityId: id, changes: { prev: 'Update', next: data.name } });
};

export const deleteDepartment = async (id: string) => {
  await deleteDoc(doc(db, "departments", id));
  await logAction({ action: 'DEPARTMENT_DELETED', entityType: 'department', entityId: id });
};
