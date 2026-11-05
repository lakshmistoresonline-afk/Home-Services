import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/src/config/firebase";
import { mapDoc, type ServiceRequest } from "./client";

/**
 * Generates a report dataset based on filters.
 */
export const generateReportData = async (filters: {
  startDate?: Date;
  endDate?: Date;
  taluk?: string;
  departmentName?: string;
  status?: string;
}): Promise<ServiceRequest[]> => {
  try {
    let q = query(collection(db, "serviceRequests"), orderBy("createdAt", "asc"));

    if (filters.taluk) {
      q = query(q, where("taluk", "==", filters.taluk));
    }
    if (filters.departmentName) {
      q = query(q, where("departmentName", "==", filters.departmentName));
    }
    if (filters.status) {
      q = query(q, where("status", "==", filters.status));
    }

    const snap = await getDocs(q);
    if (snap.empty) return [];

    let results = snap.docs.map(mapDoc<ServiceRequest>);

    // Date filtering
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
export const exportToCSV = (data: ServiceRequest[]): string => {
  const headers = ["ID", "Title", "Status", "Taluk", "Department", "Created At"];
  const rows = data.map(c => [
    c.complaint_id || c.id,
    `"${c.title.replace(/"/g, '""')}"`,
    c.status,
    c.taluk || 'Thrissur',
    c.departmentName,
    new Date(c.createdAt?.toDate?.() || c.createdAt).toLocaleString()
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
};
