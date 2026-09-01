// Mirrors backend/constants/userEnums.ts (UserRole) and backend/models/User.ts (IUser).
// Keep in sync manually — frontend can't `require()` the backend's .ts files
// directly across the repo boundary, so these are a deliberate parallel copy.

export type UserRole =
  | "super_admin"
  | "admin"
  | "checker"
  | "cutting_master"
  | "stitcher"
  | "presser"
  | "stock_manager";

export type Gender = "male" | "female" | "other";

// Per-branch operational switches (backend Branch.settings). Branches created
// before settings existed have no object at all — treat undefined as the
// backend defaults: requireOrderPrice true, autoAssignOrders false.
export interface BranchSettings {
  requireOrderPrice?: boolean;
  autoAssignOrders?: boolean;
  // Default price per garment type (PKR) — used by the priceList feature.
  garmentPrices?: Record<string, number>;
  // Public appointment booking (appointments feature): on/off + message,
  // shift hours (HH:00) and hourly slot capacity.
  appointmentsEnabled?: boolean;
  appointmentsClosedMessage?: string;
  appointmentOpenTime?: string;
  appointmentCloseTime?: string;
  appointmentsPerHour?: number;
}

// Per-branch feature flags (backend Branch.features), assigned by the
// super_admin. Missing = the defaults in src/lib/features.ts.
export interface BranchFeatures {
  analytics?: boolean;
  upcomingDelivery?: boolean;
  branchSettings?: boolean;
  priceList?: boolean;
  whatsappNotify?: boolean;
  receiptPrinting?: boolean;
  publicStatusCheck?: boolean;
  appointments?: boolean;
  appointmentLoop?: boolean;
  collections?: boolean;
  dailySummary?: boolean;
  orderQuickActions?: boolean;
  navBadges?: boolean;
  repeatOrder?: boolean;
  changePassword?: boolean;
  orderEdit?: boolean;
}

export interface Branch {
  _id: string;
  name: string;
  address?: string;
  phone?: string;
  settings?: BranchSettings;
  features?: BranchFeatures;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  _id: string;
  name: string;
  email?: string;
  hasLogin?: boolean;
  role: UserRole;
  branch?: Branch | string;
  phone?: string;
  isActive: boolean;
  commissionPerPiece?: number;
  specialization?: string;
  createdAt?: string;
  updatedAt?: string;
}
