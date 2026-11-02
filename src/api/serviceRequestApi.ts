import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { db, auth } from "@/src/config/firebase";
import { logAction } from "./auditApi";
import { getProfile, findTalukAdmin, mapDoc, type ServiceRequest, type TimelineAttachment } from "./client";

export const findServiceRequestSnapshot = async (cid: string): Promise<QueryDocumentSnapshot> => {
  if (!auth.currentUser) throw new Error("Authentication required");

  let q = query(collection(db, "serviceRequests"), where("complaint_id", "==", cid), limit(1));
  let snap = await getDocs(q);

  if (snap.empty) {
    q = query(collection(db, "serviceRequests"), where("request_id", "==", cid), limit(1));
    snap = await getDocs(q);
  }

  if (snap.empty) {
    q = query(collection(db, "complaints"), where("complaint_id", "==", cid), limit(1));
    snap = await getDocs(q);
  }

  if (snap.empty) throw new Error("Service request not found or access denied");

  return snap.docs[0];
};

export const createServiceRequest = async (body: {
  category: string;
  title: string;
  description: string;
  attachments?: TimelineAttachment[];
}): Promise<ServiceRequest> => {
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required to raise a service request.");

  const categoriesSnap = await getDocs(query(collection(db, 'serviceCategories'), where('name', '==', body.category), limit(1)));
  let catData: any = null;
  if (!categoriesSnap.empty) {
    catData = categoriesSnap.docs[0].data();
  }

  const profile = await getProfile(user.uid);
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
    slaDueAt: null,
    slaBreached: false,
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

  const docRef = await addDoc(collection(db, "serviceRequests"), data);

  await logAction({
    action: 'REQUEST_CREATED',
    entityType: 'service_request',
    entityId: requestId,
    changes: { next: data.title }
  });

  const d = await getDoc(docRef);
  return mapDoc<ServiceRequest>(d);
};

export const listServiceRequests = async (): Promise<ServiceRequest[]> => {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    const profile = await getProfile(user.uid);
    let q;
    if (profile?.role === 'citizen') {
      q = query(
        collection(db, "serviceRequests"),
        where("citizenId", "==", user.uid)
      );
    } else {
      q = query(
        collection(db, "serviceRequests"),
        limit(100)
      );
    }

    const snap = await getDocs(q);
    const list = snap.docs.map(mapDoc<ServiceRequest>);
    return list.sort((a, b) => {
      const da = new Date(a.createdAtDate || a.createdAt || 0).getTime();
      const db_val = new Date(b.createdAtDate || b.createdAt || 0).getTime();
      return db_val - da;
    });
  } catch (e: any) {
    console.warn("Failed to list service requests (handled):", e?.message || e);
    return [];
  }
};

export const getServiceRequest = async (cid: string): Promise<ServiceRequest> => {
  const docSnap = await findServiceRequestSnapshot(cid);
  return mapDoc<ServiceRequest>(docSnap);
};
