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

export interface Branch {
  _id: string;
  name: string;
  address?: string;
  phone?: string;
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
