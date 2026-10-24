import { collection, query, where, orderBy, limit, getDocs, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/src/config/firebase";
import { type AppNotification } from "./client";

export const listNotifications = async (uid: string): Promise<AppNotification[]> => {
  const q = query(
    collection(db, "notifications"),
    where("recipientUid", "==", uid),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification));
};

export const markNotificationRead = async (id: string) => {
  await updateDoc(doc(db, "notifications", id), { read: true, updatedAt: serverTimestamp() });
};

export const markAllNotificationsRead = async (uid: string) => {
  const q = query(collection(db, "notifications"), where("recipientUid", "==", uid), where("read", "==", false));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    await updateDoc(doc(db, "notifications", d.id), { read: true, updatedAt: serverTimestamp() });
  }
};

export const deleteNotification = async (id: string) => {
  await updateDoc(doc(db, "notifications", id), { archived: true, updatedAt: serverTimestamp() });
};
