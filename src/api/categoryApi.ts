import { collection, query, orderBy, getDocs, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/src/config/firebase";
import { logAction } from "./auditApi";
import { type ComplaintCategory } from "./client";

const FALLBACK_CATEGORIES: ComplaintCategory[] = [
  { id: "app_ac", name: "AC Service & Repair", departmentId: "appliance", departmentName: "Appliance Repair", displayOrder: 10, color: "#0284C7", icon: "snow", requiresLocation: true, priority: "High", slaHours: 12, isActive: true },
  { id: "app_wm", name: "Washing Machine Repair", departmentId: "appliance", departmentName: "Appliance Repair", displayOrder: 12, color: "#0369A1", icon: "water", requiresLocation: true, priority: "Medium", slaHours: 24, isActive: true },
  { id: "clean_deep", name: "Full Home Deep Cleaning (2BHK)", departmentId: "cleaning", departmentName: "Cleaning & Pest Control", displayOrder: 20, color: "#10B981", icon: "sparkles", requiresLocation: true, priority: "Medium", slaHours: 24, isActive: true },
  { id: "well_clean", name: "Well Cleaning & Chlorination (Desilting)", departmentId: "water_systems", departmentName: "Water Systems & Well Care", displayOrder: 25, color: "#0284c7", icon: "water", requiresLocation: true, priority: "High", slaHours: 24, isActive: true },
  { id: "elec_repair", name: "Electrical Repair & Wiring", departmentId: "electrical", departmentName: "Electrician", displayOrder: 30, color: "#F59E0B", icon: "flash", requiresLocation: true, priority: "Medium", slaHours: 12, isActive: true },
  { id: "plumb_leak", name: "Tap & Pipe Leakage Fix", departmentId: "plumbing", departmentName: "Plumber", displayOrder: 40, color: "#3B82F6", icon: "water", requiresLocation: true, priority: "High", slaHours: 8, isActive: true },
  { id: "carp_assembly", name: "Furniture Assembly & Repair", departmentId: "carpentry", name: "Carpenter", displayOrder: 50, color: "#8B5CF6", icon: "construct", requiresLocation: true, priority: "Medium", slaHours: 24, isActive: true } as any,
  { id: "paint_wall", name: "Interior Wall Painting (Per Room)", departmentId: "painting", departmentName: "Painting & Waterproofing", displayOrder: 60, color: "#EC4899", icon: "color-palette", requiresLocation: true, priority: "Low", slaHours: 48, isActive: true },
  { id: "roof_leak", name: "Roof Tile Leak Repair & Waterproofing", departmentId: "monsoon_care", departmentName: "Monsoon & Waterproofing Care", displayOrder: 62, color: "#0284c7", icon: "umbrella", requiresLocation: true, priority: "High", slaHours: 24, isActive: true },
  { id: "civil_remodel", name: "Bathroom & Kitchen Remodeling", departmentId: "civil", departmentName: "Civil Works & Renovation", displayOrder: 65, color: "#92400E", icon: "home", requiresLocation: true, priority: "High", slaHours: 72, isActive: true },
  { id: "solar_clean", name: "Solar Panel Cleaning & Maintenance", departmentId: "power_backup", departmentName: "Solar & Power Backup", displayOrder: 68, color: "#f59e0b", icon: "sunny", requiresLocation: true, priority: "Medium", slaHours: 48, isActive: true },
  { id: "home_nurse", name: "In-Home Nursing & Attender Service", departmentId: "elder_care", departmentName: "Elder Care & Nursing", displayOrder: 75, color: "#10b981", icon: "medkit", requiresLocation: true, priority: "Urgent", slaHours: 4, isActive: true },
  { id: "beauty_salon", name: "Salon for Women & Men's Grooming", departmentId: "beauty", departmentName: "Salon, Spa & Grooming", displayOrder: 78, color: "#FB7185", icon: "cut", requiresLocation: true, priority: "Low", slaHours: 24, isActive: true },
  { id: "drive_hourly", name: "Personal Driver (Hourly/Daily)", departmentId: "driving", departmentName: "Driver & Automotive", displayOrder: 80, color: "#EF4444", icon: "car", requiresLocation: true, priority: "High", slaHours: 4, isActive: true },
  { id: "tech_cctv", name: "CCTV Camera Installation", departmentId: "smarthome", departmentName: "Smart Home & Tech", displayOrder: 90, color: "#6366F1", icon: "videocam", requiresLocation: true, priority: "Medium", slaHours: 24, isActive: true }
];

export const listCategories = async (): Promise<ComplaintCategory[]> => {
  try {
    let q = query(collection(db, "serviceCategories"), orderBy("displayOrder", "asc"));
    let snap = await getDocs(q);
    if (snap.empty) {
      q = query(collection(db, "complaintCategories"), orderBy("displayOrder", "asc"));
      snap = await getDocs(q);
    }
    if (snap.empty) return FALLBACK_CATEGORIES;
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ComplaintCategory));
  } catch (e: any) {
    console.warn('Using fallback categories due to permission/network state:', e?.message || e);
    return FALLBACK_CATEGORIES;
  }
};

export const addCategory = async (data: Omit<ComplaintCategory, 'id'>) => {
  const res = await addDoc(collection(db, "serviceCategories"), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await logAction({ action: 'CATEGORY_CREATED', entityType: 'category', entityId: res.id, changes: { prev: null, next: data.name } });
  return res;
};

export const updateCategory = async (id: string, data: Partial<ComplaintCategory>) => {
  await updateDoc(doc(db, "serviceCategories", id), { ...data, updatedAt: serverTimestamp() });
  await logAction({ action: 'CATEGORY_UPDATED', entityType: 'category', entityId: id, changes: { prev: 'Update', next: data.name } });
};

export const deleteCategory = async (id: string) => {
  await deleteDoc(doc(db, "serviceCategories", id));
  await logAction({ action: 'CATEGORY_DELETED', entityType: 'category', entityId: id });
};
