import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/src/config/firebase';
import { getComplaint, type ServiceRequest } from '@/src/api/serviceRequestApi';
import { mapDoc, getProfile, type User } from '@/src/api/client';

export function useServiceRequestDetail(id: string | undefined, user: User | null) {
  const [item, setItem] = useState<ServiceRequest | null>(null);
  const [citizen, setCitizen] = useState<User | null>(null);
  const [staff, setStaff] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<'forbidden' | 'notfound' | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!id || !auth.currentUser) return;
    try {
      setLoading(true);
      const c = await getComplaint(id);
      setItem(c);
      setError(null);

      if (c.citizenId) {
        getProfile(c.citizenId).then(p => setCitizen(p)).catch(() => {});
      }
      if (c.assignedStaffId) {
        getProfile(c.assignedStaffId).then(p => setStaff(p)).catch(() => {});
      }
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (/Unauthorized|Access Denied/i.test(msg)) {
        setError('forbidden');
      } else {
        setError('notfound');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id || !auth.currentUser) {
      setItem(null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    fetchDetail();

    const unsub = onSnapshot(
      doc(db, 'serviceRequests', id),
      (snap) => {
        if (!isMounted) return;
        if (snap.exists()) {
          const c = mapDoc<ServiceRequest>(snap);
          setItem(c);
          setError(null);

          if (c.citizenId) {
            getProfile(c.citizenId).then(p => isMounted && setCitizen(p)).catch(() => {});
          }
          if (c.assignedStaffId) {
            getProfile(c.assignedStaffId).then(p => isMounted && setStaff(p)).catch(() => {});
          }
        }
        setLoading(false);
      },
      (err) => {
        console.warn('Real-time detail snapshot notice (handled):', err.message);
      }
    );

    return () => {
      isMounted = false;
      unsub();
    };
  }, [id, fetchDetail]);

  return { item, citizen, staff, loading, error, setItem, refresh: fetchDetail };
}
