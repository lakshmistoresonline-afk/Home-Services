import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  serverTimestamp,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { db, auth } from "@/src/config/firebase";
import { logAction } from "./auditApi";
import { getProfile, mapDoc, type ServiceRequest, type TimelineAttachment } from "./client";

export const findServiceRequestSnapshot = async (cid: string): Promise<QueryDocumentSnapshot> => {
  if (!auth.currentUser) throw new Error("Unauthorized access");

  // 1. Direct document lookup by ID in Firestore
  try {
    const directDoc = await getDoc(doc(db, "serviceRequests", cid));
    if (directDoc.exists()) return directDoc as any;
  } catch (e) { }

  // 2. Query by complaint_id or request_id in Firestore
  try {
    const q1 = await getDocs(query(collection(db, "serviceRequests"), where("complaint_id", "==", cid), limit(1)));
    if (!q1.empty) return q1.docs[0];
  } catch (e) { }

  try {
    const q2 = await getDocs(query(collection(db, "serviceRequests"), where("request_id", "==", cid), limit(1)));
    if (!q2.empty) return q2.docs[0];
  } catch (e) { }

  throw new Error("Service request not found");
};

export const createServiceRequest = async (body: {
  category: string;
  title: string;
  description: string;
  attachments?: TimelineAttachment[];
}): Promise<ServiceRequest> => {
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required to raise a service request.");

  let catData: any = null;
  try {
    const categoriesSnap = await getDocs(query(collection(db, 'serviceCategories'), where('name', '==', body.category), limit(1)));
    if (!categoriesSnap.empty) {
      catData = categoriesSnap.docs[0].data();
    }
  } catch (e) {
    /* non-blocking category lookup */
  }

  const profile = await getProfile(user.uid).catch(() => null);
  const district = profile?.district || 'Thrissur';
  const taluk = profile?.taluk || 'Thrissur';

  const requestId = `SRV-${Math.floor(100000 + Math.random() * 900000)}`;

  const nowIso = new Date().toISOString();
  const initialTimeline = [
    {
      id: `init-${Date.now()}`,
      type: 'REQUEST_CREATED',
      title: 'Service Request Submitted',
      description: 'Your service request has been registered and is awaiting provider assignment.',
      performedBy: user.uid,
      performedByName: profile?.fullName || user.email || 'Customer',
      performedByRole: profile?.role || 'citizen',
      timestamp: nowIso,
      attachments: body.attachments || [],
    }
  ];

  const data: any = {
    complaint_id: requestId,
    request_id: requestId,
    citizenId: user.uid,
    citizenName: profile?.fullName || user.email || 'Customer',
    district,
    taluk,
    departmentId: catData?.departmentId || 'general',
    departmentName: catData?.departmentName || 'General',
    categoryId: catData?.id || 'gen_inq',
    categoryName: body.category,
    title: body.title,
    description: body.description,
    status: 'Submitted',
    photos: (body.attachments || []).map(a => a.url),
    attachments: body.attachments || [],
    assignedStaffId: null,
    assignedStaffName: null,
    assignedDepartment: null,
    assignedAt: null,
    assignedBy: null,
    assignedByName: null,
    assignmentHistory: [],
    remarks: null,
    resolvedAt: null,
    resolutionDuration: null,
    history: [{
      actor_id: user.uid,
      actor_name: profile?.fullName || 'Customer',
      actor_role: profile?.role || 'citizen',
      action: 'created',
      newStatus: 'Submitted',
      details: { title: body.title, category: body.category },
      at: nowIso,
    }],
    comments: [],
    timeline: initialTimeline,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // Persist directly to Cloud Firestore under document key requestId
  await setDoc(doc(db, "serviceRequests", requestId), data);

  try {
    await logAction({
      action: 'REQUEST_CREATED',
      entityType: 'service_request',
      entityId: requestId,
      changes: { next: data.title }
    });
  } catch (e) {
    /* non-blocking audit log */
  }

  const createdDoc = await getDoc(doc(db, "serviceRequests", requestId));
  if (createdDoc.exists()) {
    return mapDoc<ServiceRequest>(createdDoc as any);
  }

  return {
    id: requestId,
    ...data,
    createdAt: nowIso,
    updatedAt: nowIso,
    createdAtDate: new Date(),
    updatedAtDate: new Date(),
  };
};

export const listServiceRequests = async (): Promise<ServiceRequest[]> => {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    const profile = await getProfile(user.uid).catch(() => null);
    const isCitizen = !profile?.role || profile?.role === 'citizen';

    let snaps: any[] = [];
    if (isCitizen) {
      const q1 = await getDocs(query(collection(db, "serviceRequests"), where("citizenId", "==", user.uid))).catch(() => null);
      const q2 = await getDocs(query(collection(db, "serviceRequests"), where("citizenId", "==", "citizen_01"))).catch(() => null);
      snaps = [q1, q2];
    } else {
      const q = await getDocs(query(collection(db, "serviceRequests"), limit(200))).catch(() => null);
      snaps = [q];
    }

    const map = new Map<string, ServiceRequest>();

    // Load Cloud Firestore network documents ONLY
    snaps.forEach(snap => {
      if (snap && !snap.empty) {
        snap.docs.map(mapDoc<ServiceRequest>).forEach((item: ServiceRequest) => {
          const key = item.complaint_id || item.request_id || item.id;
          if (key && !map.has(key)) {
            map.set(key, item);
          }
        });
      }
    });

    const getTime = (item: ServiceRequest) => {
      if (item.createdAtDate instanceof Date && !isNaN(item.createdAtDate.getTime())) {
        return item.createdAtDate.getTime();
      }
      if (typeof item.createdAt === 'string' && !isNaN(new Date(item.createdAt).getTime())) {
        return new Date(item.createdAt).getTime();
      }
      if (typeof item.created_at === 'string' && !isNaN(new Date(item.created_at).getTime())) {
        return new Date(item.created_at).getTime();
      }
      return 0;
    };

    const allList = Array.from(map.values());
    return allList.sort((a, b) => getTime(b) - getTime(a));
  } catch (e: any) {
    console.warn("Failed to fetch serviceRequests from Firestore:", e?.message || e);
    return [];
  }
};

export const getServiceRequest = async (cid: string): Promise<ServiceRequest> => {
  const docSnap = await findServiceRequestSnapshot(cid);
  return mapDoc<ServiceRequest>(docSnap);
};

export const listComplaints = listServiceRequests;
export const getComplaint = getServiceRequest;
export const adminList = listServiceRequests;
export const adminStats = async () => {
  const list = await listServiceRequests();
  return {
    total: list.length,
    submitted: list.filter(r => r.status === 'Submitted').length,
    assigned: list.filter(r => r.status === 'Assigned').length,
    in_progress: list.filter(r => r.status === 'In Progress').length,
    resolved: list.filter(r => r.status === 'Resolved' || r.status === 'Completed').length,
    closed: list.filter(r => r.status === 'Closed').length,
    unassigned: list.filter(r => !r.assignedStaffId).length,
    assignedToday: 0,
    completedToday: 0,
    avgResolutionTime: 0,
    slaBreachedCount: 0,
    dueTodayCount: 0,
    nearSlaCount: 0,
    criticalBreachCount: 0
  };
};
