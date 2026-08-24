// Mirrors backend/constants/orderEnums.ts and backend/models/Order.ts
// (GarmentType, PaymentMethod, FabricSource, OrderStatus, IOrder, IOrderItem,
// IPayment, IStatusHistoryEntry).
import type { Customer } from "./customer";

export type GarmentType =
  | "Simple Suit"
  | "4 Part & Fancy Button"
  | "Designing Suit"
  | "Selling Suit with Press"
  | "Embroidery Suit";

export type PaymentMethod = "cash" | "card" | "bank_transfer" | "mobile_money";

export type FabricSource = "customer_provided" | "shop_supplied";

export type OrderStatus =
  | "draft"
  | "received"
  | "cutting"
  | "cutting_review"
  | "stitching"
  | "stitching_review"
  | "pressing"
  | "pressing_review"
  | "quality_check"
  | "ready"
  | "delivered"
  | "rework"
  | "cancelled";

export interface OrderItem {
  garmentType: GarmentType;
  quantity: number;
  basePrice: number;
  fabric?: string;
  fabricSource: FabricSource;
  fabricAmount: number;
}

export interface Payment {
  amount: number;
  method: PaymentMethod;
  date: string;
  note?: string;
  recordedBy?: string | { _id: string; name: string };
}

export interface StatusHistoryEntry {
  status: OrderStatus;
  changedBy?: string | { _id: string; name: string };
  changedAt: string;
  note?: string;
}

// Staff refs on an order are populated with just { _id, name } (and phone,
// on the order-detail GET) by the backend, or left as a plain id string when
// unpopulated.
export type StaffRef = string | { _id: string; name: string; phone?: string };

export interface Order {
  _id: string;
  branch: string | { _id: string; name: string };
  orderNumber: string;
  customer: string | Customer | { _id: string; name: string; phone: string };
  suitNo?: string;
  items: OrderItem[];
  styleNotes?: string;
  designImageUrl?: string;
  measurements?: unknown;
  status: OrderStatus;
  statusHistory: StatusHistoryEntry[];
  checkerRemark?: string;
  cuttingMaster?: StaffRef;
  stitcher?: StaffRef;
  presser?: StaffRef;
  stockManager?: StaffRef;
  receivedDate?: string;
  promisedDate: string;
  deliveredDate?: string;
  isRush?: boolean;
  rushSurcharge?: number;
  discountAmount?: number;
  totalPrice: number;
  payments: Payment[];
  amountPaid: number;
  balanceDue: number;
  isPaid: boolean;
  rackNumber?: string;
  isPickedUp?: boolean;
  reworkReason?: string;
  reworkCount?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}
