// Mirrors backend/models/Customer.ts (ICustomer, IMeasurement).
import type { Gender } from "./user";

export interface Measurement {
  _id?: string;
  chest?: number;
  waist?: number;
  hips?: number;
  shoulder?: number;
  sleeveLength?: number;
  neck?: number;
  inseam?: number;
  outseam?: number;
  thigh?: number;
  height?: number;
  notes?: string;
  takenBy?: string | { _id: string; name: string };
  takenAt?: string;
}

export interface SuitNoHistoryEntry {
  _id?: string;
  suitNo: string;
  changedAt?: string;
  changedBy?: string | { _id: string; name: string };
}

export interface Customer {
  _id: string;
  branch: string | { _id: string; name: string };
  name: string;
  phone: string;
  email?: string;
  address?: string;
  gender?: Gender;
  measurements?: Measurement;
  measurementHistory?: Measurement[];
  // Standing suit/locker number — persists across visits. See
  // SuitNoHistoryEntry for the backup trail of previous values.
  suitNo?: string;
  suitNoHistory?: SuitNoHistoryEntry[];
  notes?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
