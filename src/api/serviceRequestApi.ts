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

  let docId = requestId;
  try {
    const docRef = await addDoc(collection(db, "serviceRequests"), data);
    docId = docRef.id;
  } catch (err: any) {
    try {
      const docRef = await addDoc(collection(db, "complaints"), data);
      docId = docRef.id;
    } catch (e2: any) {
      console.warn("Write to Firestore serviceRequests/complaints handled:", e2?.message || e2);
    }
  }

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

  return {
    id: docId,
    ...data,
    created_at: nowIso,
    updated_at: nowIso,
    createdAtDate: new Date(),
    updatedAtDate: new Date(),
  } as ServiceRequest;
};

export const listServiceRequests = async (): Promise<ServiceRequest[]> => {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    const profile = await getProfile(user.uid).catch(() => null);

    const promises = [];
    if (profile?.role === 'citizen') {
      promises.push(getDocs(query(collection(db, "serviceRequests"), where("citizenId", "==", user.uid))));
      promises.push(getDocs(query(collection(db, "complaints"), where("citizenId", "==", user.uid))));
    } else {
      promises.push(getDocs(query(collection(db, "serviceRequests"), limit(100))));
      promises.push(getDocs(query(collection(db, "complaints"), limit(100))));
    }

    const [snapNew, snapOld] = await Promise.allSettled(promises);

    const itemsNew = snapNew.status === 'fulfilled' ? snapNew.value.docs.map(mapDoc<ServiceRequest>) : [];
    const itemsOld = snapOld.status === 'fulfilled' ? snapOld.value.docs.map(mapDoc<ServiceRequest>) : [];

    const map = new Map<string, ServiceRequest>();
    [...itemsNew, ...itemsOld].forEach(item => {
      const key = item.complaint_id || item.id;
      if (!map.has(key)) map.set(key, item);
    });

    const allList = Array.from(map.values());
    return allList.sort((a, b) => {
      const da = new Date(a.createdAtDate || a.createdAt || 0).getTime();
      const db_val = new Date(b.createdAtDate || b.createdAt || 0).getTime();
      return db_val - da;
    });
  } catch (e: any) {
    console.warn("Dashboard sync notice (handled):", e?.message || e);
    return [];
  }
};

export const getServiceRequest = async (cid: string): Promise<ServiceRequest> => {
  const docSnap = await findServiceRequestSnapshot(cid);
  return mapDoc<ServiceRequest>(docSnap);
};
