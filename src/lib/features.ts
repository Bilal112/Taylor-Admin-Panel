import type { User } from "@/types/user";

// Mirror of backend/constants/features.ts — keep the two in sync manually,
// same as the other backend enum copies in src/types.
//
// Per-branch feature flags, assigned by the super_admin on the Settings page
// (Features card). The backend enforces them with requireFeature(); this
// helper is only for hiding the matching UI.
export const FEATURES = {
  analytics: {
    label: "Staff Performance Analytics",
    description:
      "The Analytics page — per-staff orders, pieces, commission and rejections.",
    default: true,
  },
  upcomingDelivery: {
    label: "Upcoming Delivery",
    description: "The Upcoming Delivery page (orders promised for a given day).",
    default: true,
  },
  branchSettings: {
    label: "Self-service Branch Settings",
    description:
      "Branch admin can change their own order settings and price list. Off = only the super admin changes them.",
    default: true,
  },
  priceList: {
    label: "Default Price List",
    description:
      "Auto-fill item prices on the New Order form from the branch's price list.",
    default: true,
  },
  whatsappNotify: {
    label: "WhatsApp Messages",
    description:
      "One-click WhatsApp message to the customer when an order is ready.",
    default: true,
  },
  receiptPrinting: {
    label: "Receipt Printing",
    description:
      "Print a customer slip for an order — items, totals, advance and balance.",
    default: true,
  },
  publicStatusCheck: {
    label: "Public Order Tracking",
    description:
      "Customers can check their order status online with just their phone number.",
    default: true,
  },
  appointments: {
    label: "Online Appointments",
    description:
      "Customers can book a visit online; the admin manages the day's list, shift hours and slot capacity.",
    default: true,
  },
} as const;

export type FeatureKey = keyof typeof FEATURES;

export const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[];

// super_admin always has every feature — flags scope what a BRANCH may use,
// and super_admin belongs to no branch. Branch users read the flag off the
// populated branch on their session user; branches saved before a flag
// existed fall back to the registry default. (Values refresh on page load,
// when /auth/me repopulates the branch.)
export function hasFeature(user: User | null, key: FeatureKey): boolean {
  if (!user) return false;
  if (user.role === "super_admin") return true;
  const branch = typeof user.branch === "object" ? user.branch : null;
  return branch?.features?.[key] ?? FEATURES[key].default;
}
