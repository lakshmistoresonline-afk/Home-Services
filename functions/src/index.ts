import { initializeApp, getApps } from 'firebase-admin/app';

if (getApps().length === 0) {
  initializeApp();
}

export { createServiceRequest, updateComplaintStatus } from './requests';
export { assignComplaint } from './assignment';
export { setUserRole } from './roles';
export { scheduledAutoAssign, scheduledAutoClose } from './maintenance';
