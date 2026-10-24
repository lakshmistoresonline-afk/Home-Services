import {
  collection,
  addDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "@/src/config/firebase";

export type NotificationType = 'SYSTEM' | 'ASSIGNMENT' | 'UPDATE' | 'ACCOUNT';
export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export const notificationService = {
  /**
   * Internal helper to create Firestore notification documents.
   * This is designed to be FCM-ready in the future.
   */
  sendNotification: async (params: {
    title: string;
    message: string;
    recipientUid: string;
    recipientRole: string;
    complaintId?: string;
    type: NotificationType;
    priority?: NotificationPriority;
  }) => {
    try {
      await addDoc(collection(db, "notifications"), {
        ...params,
        read: false,
        archived: false,
        priority: params.priority || 'MEDIUM',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error('Failed to send notification:', e);
    }
  },

  /**
   * High-level events
   */
  notifyStaffAssignment: async (staffId: string, complaintId: string, complaintTitle: string) => {
    await notificationService.sendNotification({
      title: 'New Assignment',
      message: `You have been assigned to: ${complaintTitle}`,
      recipientUid: staffId,
      recipientRole: 'staff',
      complaintId,
      type: 'ASSIGNMENT',
      priority: 'HIGH'
    });
  },

  notifyStatusChange: async (userId: string, userRole: string, complaintId: string, newStatus: string) => {
    await notificationService.sendNotification({
      title: 'Complaint Update',
      message: `Complaint ${complaintId} status changed to ${newStatus}`,
      recipientUid: userId,
      recipientRole: userRole,
      complaintId,
      type: 'UPDATE',
      priority: 'MEDIUM'
    });
  },

  notifyCitizen: async (citizenId: string, complaintId: string, message: string) => {
    await notificationService.sendNotification({
      title: 'Update on your Complaint',
      message,
      recipientUid: citizenId,
      recipientRole: 'citizen',
      complaintId,
      type: 'UPDATE',
      priority: 'MEDIUM'
    });
  },

  notifyAccountCreated: async (uid: string, role: string, name: string) => {
    await notificationService.sendNotification({
      title: 'Account Created',
      message: `Welcome ${name}! Your account has been successfully set up.`,
      recipientUid: uid,
      recipientRole: role,
      type: 'ACCOUNT',
      priority: 'LOW'
    });
  }
};
