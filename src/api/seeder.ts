import { doc, setDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/src/config/firebase";
import { type RoleRecord, type ComplaintStatusRecord, type Ward } from "./client";
import { THRISSUR_WARDS } from "@/src/data/wards";

export const seedWards = async (): Promise<Ward[]> => {
  for (const w of THRISSUR_WARDS) {
    await setDoc(doc(db, "wards", w.wardNumber.toString()), {
      wardNumber: w.wardNumber,
      name: w.name,
      isActive: true,
      createdAt: serverTimestamp(),
    });
  }
  return THRISSUR_WARDS.map(w => ({ wardNumber: w.wardNumber, name: w.name, isActive: true }));
};

export const seedRBAC = async (): Promise<RoleRecord[]> => {
  const perms = [
    { id: 'view_dashboard', name: 'View Dashboard', module: 'General' },
    { id: 'manage_users', name: 'Manage Users', module: 'Admin' },
    { id: 'manage_staff', name: 'Manage Staff', module: 'Admin' },
    { id: 'manage_departments', name: 'Manage Departments', module: 'System' },
    { id: 'manage_categories', name: 'Manage Categories', module: 'System' },
    { id: 'manage_wards', name: 'Manage Wards', module: 'System' },
    { id: 'assign_complaints', name: 'Assign Complaints', module: 'Workflow' },
    { id: 'reassign_complaints', name: 'Reassign Complaints', module: 'Workflow' },
    { id: 'close_complaints', name: 'Close Complaints', module: 'Workflow' },
    { id: 'update_progress', name: 'Update Progress', module: 'Workflow' },
    { id: 'upload_photos', name: 'Upload Photos', module: 'Workflow' },
    { id: 'view_reports', name: 'View Reports', module: 'System' },
    { id: 'view_audit_logs', name: 'View Audit Logs', module: 'Security' },
    { id: 'create_complaint', name: 'Create Complaint', module: 'Citizen' },
    { id: 'view_own_complaints', name: 'View Own Complaints', module: 'Citizen' },
  ];

  for (const p of perms) {
    await setDoc(doc(db, "permissions", p.id), { ...p, isActive: true, createdAt: serverTimestamp() });
  }

  const roles = [
    { id: 'super_admin', name: 'Super Admin', perms: perms.map(p => p.id) },
    { id: 'ward_admin', name: 'Ward Admin', perms: ['view_dashboard', 'assign_complaints', 'reassign_complaints', 'close_complaints', 'view_reports'] },
    { id: 'staff', name: 'Field Staff', perms: ['view_dashboard', 'update_progress', 'upload_photos', 'add_notes'] },
    { id: 'citizen', name: 'Citizen', perms: ['create_complaint', 'view_own_complaints'] },
  ];

  const records: RoleRecord[] = [];
  for (const r of roles) {
    await setDoc(doc(db, "roles", r.id), { name: r.name, permissions: r.perms, isActive: true, createdAt: serverTimestamp() });
    records.push({ id: r.id, name: r.name, description: '', permissions: r.perms, isActive: true });
  }
  return records;
};

export const seedWorkflow = async (): Promise<ComplaintStatusRecord[]> => {
  const defaults = [
    { name: 'Submitted', color: '#F59E0B', icon: 'file-tray-full', order: 10 },
    { name: 'Assigned', color: '#7C3AED', icon: 'person', order: 20 },
    { name: 'Accepted', color: '#3B82F6', icon: 'checkmark-circle', order: 30 },
    { name: 'In Progress', color: '#3B82F6', icon: 'time', order: 40 },
    { name: 'Waiting', color: '#F59E0B', icon: 'pause', order: 50 },
    { name: 'Completed', color: '#10B981', icon: 'checkbox', order: 60 },
    { name: 'Resolved', color: '#10B981', icon: 'checkmark-done', order: 70 },
    { name: 'Closed', color: '#64748B', icon: 'lock-closed', order: 80 },
    { name: 'Rejected', color: '#EF4444', icon: 'close-circle', order: 90 },
    { name: 'Reopened', color: '#F59E0B', icon: 'refresh', order: 100 },
  ];

  const batch: ComplaintStatusRecord[] = [];
  for (const s of defaults) {
    const docRef = await addDoc(collection(db, "complaintStatuses"), {
      name: s.name,
      color: s.color,
      icon: s.icon,
      displayOrder: s.order,
      isActive: true,
      createdAt: serverTimestamp()
    });
    batch.push({ id: docRef.id, name: s.name, color: s.color, icon: s.icon, displayOrder: s.order, isActive: true });
  }
  return batch;
};

export const seedCategories = async () => {
  const cats = [
    { name: 'Street Light', dept: 'Electrical', sla: 48 },
    { name: 'Pothole', dept: 'Engineering', sla: 72 },
    { name: 'Garbage', dept: 'Sanitation', sla: 24 },
    { name: 'Water Leak', dept: 'Water Authority', sla: 12 },
  ];

  for (const c of cats) {
    await addDoc(collection(db, "complaintCategories"), {
      name: c.name,
      departmentName: c.dept,
      departmentId: c.dept.toLowerCase(),
      slaHours: c.sla,
      isActive: true,
      createdAt: serverTimestamp()
    });
  }
};
