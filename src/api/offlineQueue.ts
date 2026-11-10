import AsyncStorage from '@react-native-async-storage/async-storage';
import { adminUpdateStatus } from './workflowApi';
import { assignComplaint } from './assignmentEngine';

const OFFLINE_QUEUE_KEY = '@homeservice_offline_queue_v1';

export interface PendingAction {
  id: string;
  type: 'UPDATE_STATUS' | 'ASSIGN_STAFF';
  requestId: string;
  payload: any;
  createdAt: string;
}

export const getPendingOfflineActions = async (): Promise<PendingAction[]> => {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

export const enqueueOfflineAction = async (action: Omit<PendingAction, 'id' | 'createdAt'>): Promise<void> => {
  try {
    const current = await getPendingOfflineActions();
    const newAction: PendingAction = {
      ...action,
      id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [...current, newAction];
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to enqueue offline action:', e);
  }
};

export const syncOfflineQueue = async (): Promise<number> => {
  try {
    const actions = await getPendingOfflineActions();
    if (actions.length === 0) return 0;

    let syncedCount = 0;
    const remaining: PendingAction[] = [];

    for (const act of actions) {
      try {
        if (act.type === 'UPDATE_STATUS') {
          await adminUpdateStatus(act.requestId, act.payload);
          syncedCount++;
        } else if (act.type === 'ASSIGN_STAFF') {
          await assignComplaint(act.requestId, act.payload.staffId);
          syncedCount++;
        }
      } catch (e) {
        console.warn(`Failed to sync action ${act.id}, keeping in queue:`, e);
        remaining.push(act);
      }
    }

    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    return syncedCount;
  } catch (e) {
    console.warn('Failed to sync offline queue:', e);
    return 0;
  }
};
