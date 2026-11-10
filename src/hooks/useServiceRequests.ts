import { useState, useEffect, useCallback } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { auth } from '@/src/config/firebase';
import { getScopedServiceRequestQuery, listServiceRequests, type ServiceRequest, type ListServiceRequestsParams } from '@/src/api/serviceRequestApi';
import { getProfile, mapDoc, type User } from '@/src/api/client';

export function useServiceRequests(user: User | null, params?: ListServiceRequestsParams) {
  const [items, setItems] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await listServiceRequests({
        ...params,
        role: user.role,
        taluk: user.taluk,
      });
      setItems(res);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [user, params?.q, params?.department, params?.status, params?.assigned_to]);

  useEffect(() => {
    if (!user || !auth.currentUser) {
      setItems([]);
      setLoading(false);
      return;
    }

    let isMounted = true;
    const reqQuery = getScopedServiceRequestQuery(
      { uid: user.uid, role: user.role, taluk: user.taluk },
      params
    );

    const unsubscribe = onSnapshot(
      reqQuery,
      (snap) => {
        if (!isMounted) return;
        const list: ServiceRequest[] = [];
        snap.docs.forEach((docSnap) => {
          const item = mapDoc<ServiceRequest>(docSnap);
          if (item && item.id) {
            list.push(item);
          }
        });

        // Filter search / status / department in memory if provided
        let filtered = list;
        if (params?.q?.trim()) {
          const search = params.q.toLowerCase().trim();
          filtered = filtered.filter(item =>
            (item.title || '').toLowerCase().includes(search) ||
            (item.description || '').toLowerCase().includes(search) ||
            (item.complaint_id || '').toLowerCase().includes(search) ||
            (item.request_id || '').toLowerCase().includes(search) ||
            (item.citizenName || '').toLowerCase().includes(search) ||
            (item.assignedStaffName || '').toLowerCase().includes(search)
          );
        }

        if (params?.department) {
          filtered = filtered.filter(item => item.departmentName === params.department || item.departmentId === params.department);
        }

        if (params?.status) {
          filtered = filtered.filter(item => item.status === params.status);
        }

        if (params?.assigned_to) {
          if (params.assigned_to === 'unassigned') {
            filtered = filtered.filter(item => !item.assignedStaffId);
          } else if (params.assigned_to === 'me') {
            filtered = filtered.filter(item => item.assignedStaffId === user.uid);
          } else {
            filtered = filtered.filter(item => !!item.assignedStaffId);
          }
        }

        setItems(filtered);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.warn('Real-time serviceRequests snapshot notice (handled):', err.message);
        refresh();
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [user?.uid, user?.role, user?.taluk, params?.q, params?.department, params?.status, params?.assigned_to, refresh]);

  return { items, loading, error, refresh };
}
