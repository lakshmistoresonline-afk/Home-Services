import { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs } from "firebase/firestore";
import { Platform } from "react-native";
import { auth, db } from "@/src/config/firebase";
import { getProfile, type AuditEntry } from "./client";

export const logAction = async (params: {
  action: string;
  entityType: AuditEntry['entity']['type'];
  entityId: string;
  changes?: AuditEntry['changes'];
}) => {
  try {
    const fbUser = auth.currentUser;
    if (!fbUser) return;

    const profile = await getProfile(fbUser.uid);

    const log: any = {
      timestamp: serverTimestamp(),
      actor: {
        uid: fbUser.uid,
        name: profile?.fullName || 'Unknown',
        role: profile?.role || 'citizen',
      },
      action: params.action,
      entity: {
        type: params.entityType,
        id: params.entityId,
      },
      context: {
        device: Platform.OS + ' ' + Platform.Version,
      }
    };

    if (params.changes) {
      log.changes = {
        prev: params.changes.prev === undefined ? null : params.changes.prev,
        next: params.changes.next === undefined ? null : params.changes.next
      };
    }

    await addDoc(collection(db, "auditLogs"), log);
  } catch (e) {
    console.error('Audit Log failed:', e);
  }
};

export const listAuditLogs = async (opts: {
  action?: string;
  role?: string;
  entityType?: string;
  startDate?: Date;
  endDate?: Date;
} = {}): Promise<AuditEntry[]> => {
  try {
    let q = query(collection(db, "auditLogs"), orderBy("timestamp", "desc"), limit(100));

    const snap = await getDocs(q);
    if (snap.empty) return [];

    let results = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      timestamp: d.data().timestamp?.toDate?.()?.toISOString() || new Date().toISOString()
    } as AuditEntry));

    if (opts.action) results = results.filter(l => l.action === opts.action);
    if (opts.role) results = results.filter(l => l.actor?.role === opts.role);
    if (opts.entityType) results = results.filter(l => l.entity?.type === opts.entityType);

    return results;
  } catch (e) {
    console.error('Failed to list audit logs:', e);
    return [];
  }
};
