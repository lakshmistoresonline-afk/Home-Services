export type UserRole = 'citizen' | 'staff' | 'ward_admin' | 'taluk_admin' | 'super_admin' | 'readonly_super_admin';

export type UserProfile = {
  uid: string;
  fullName: string;
  email: string;
  mobile?: string;
  role: UserRole;
  taluk?: string | null;
  district?: string | null;
  departments?: string[];
  departmentIds?: string[];
  categories?: string[];
  designation?: string | null;
  isActive: boolean;
  activeComplaintCount?: number;
  completedComplaintCount?: number;
};

export type ServiceRequestDoc = {
  id: string;
  complaint_id: string;
  request_id?: string;
  citizenId: string;
  citizenName: string;
  district?: string;
  taluk?: string;
  departmentId: string;
  departmentName: string;
  categoryId: string;
  categoryName: string;
  title: string;
  description: string;
  status: string;
  price?: number | null;
  paymentMethod?: 'UPI_QR' | 'Cash' | null;
  paymentStatus?: 'Pending' | 'Paid' | 'Cash on Delivery' | null;
  assignedStaffId?: string | null;
  assignedStaffName?: string | null;
  assignedAt?: string | null;
  assignedBy?: string | null;
  assignedByName?: string | null;
  remarks?: string | null;
  resolvedAt?: string | null;
  timeline?: any[];
  assignmentHistory?: any[];
  createdAt?: any;
  updatedAt?: any;
};
