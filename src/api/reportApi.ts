import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/src/config/firebase";
import { mapDoc, type Complaint } from "./client";

/**
 * Generates a report dataset based on filters.
 */
export const generateReportData = async (filters: {
  startDate?: Date;
  endDate?: Date;
  wardNumber?: number;
  departmentName?: string;
  status?: string;
}): Promise<Complaint[]> => {
  try {
    let q = query(collection(db, "complaints"), orderBy("createdAt", "asc"));

    if (filters.wardNumber) {
      q = query(q, where("wardNumber", "==", filters.wardNumber));
    }
    if (filters.departmentName) {
      q = query(q, where("departmentName", "==", filters.departmentName));
    }
    if (filters.status) {
      q = query(q, where("status", "==", filters.status));
    }

    const snap = await getDocs(q);
    if (snap.empty) return [];

    let results = snap.docs.map(mapDoc<Complaint>);

    // Date filtering (Client-side because Firestore inequalities on different fields are complex)
    if (filters.startDate) {
      results = results.filter(c => new Date(c.createdAt?.toDate?.() || c.createdAt) >= filters.startDate!);
    }
    if (filters.endDate) {
      results = results.filter(c => new Date(c.createdAt?.toDate?.() || c.createdAt) <= filters.endDate!);
    }

    return results || [];
  } catch (e) {
    console.error('Failed to generate report data:', e);
    return [];
  }
};

/**
 * Export function
 */
export const exportToCSV = (data: Complaint[]): string => {
  const headers = ["ID", "Title", "Status", "Ward", "Department", "Created At"];
  const rows = data.map(c => [
    c.complaint_id,
    `"${c.title.replace(/"/g, '""')}"`,
    c.status,
    c.wardNumber,
    c.departmentName,
    new Date(c.createdAt?.toDate?.() || c.createdAt).toLocaleString()
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
};
