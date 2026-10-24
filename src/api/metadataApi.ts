import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/src/config/firebase";
import { type Meta } from "./client";

export const meta = async (): Promise<Meta> => {
  const d = await getDoc(doc(db, "metadata", "app"));
  if (!d.exists()) {
    return {
      departments: ["General", "Health", "Engineering", "Sanitation", "Electrical"],
      categories: ["Inquiry", "Repair", "Cleaning", "Illegal Dumping"],
      statuses: ["Submitted", "Assigned", "In Progress", "Resolved", "Closed"],
      department_categories: { "General": ["Inquiry"] }
    };
  }
  return d.data() as Meta;
};

export const updateMeta = async (data: Partial<Meta>) => {
  const ref = doc(db, "metadata", "app");
  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp()
  });
};
