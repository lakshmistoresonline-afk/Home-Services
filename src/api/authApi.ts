import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs, limit } from "firebase/firestore";
import { sendPasswordResetEmail, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { auth, db } from "@/src/config/firebase";
import { getProfile, type User } from "./client";

export const checkMobileUnique = async (mobile: string, excludeUid?: string): Promise<boolean> => {
  const q = query(
    collection(db, "users"),
    where("mobile", "==", mobile),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return true;
  if (excludeUid && snap.docs[0].id === excludeUid) return true;
  return false;
};

export const updateProfile = async (body: Partial<User>): Promise<User> => {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const updateData = { ...body, updatedAt: serverTimestamp() };
  await updateDoc(doc(db, "users", user.uid), updateData);
  return (await getProfile(user.uid))!;
};

export const changePassword = async (data: { current_password?: string; new_password: string }) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  if (data.current_password && user.email) {
    const cred = EmailAuthProvider.credential(user.email, data.current_password);
    await reauthenticateWithCredential(user, cred);
  }

  await updatePassword(user, data.new_password);
  return { ok: true };
};

export const sendPasswordReset = async (email: string) => {
  await sendPasswordResetEmail(auth, email);
  return { ok: true };
};

export const deleteOwnAccount = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  await updateDoc(doc(db, "users", user.uid), { isActive: false, updatedAt: serverTimestamp() });
  return { ok: true, message: "Account deactivated" };
};
