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
  draftAutoAssign: {
    label: "Draft Auto-Assign Button",
    description:
      "The '⚡ Auto Assign' shortcut on a draft order's page, which fills every unpicked role by workload with one click. Off = staff must always be assigned by hand from the dropdowns — the dropdowns and 'Assign & Activate' stay available either way, this only hides the shortcut.",
    default: true,
  },
  // Premium features below default OFF: the super_admin grants them per
  // branch explicitly.
  appointmentLoop: {
    label: "Appointment Tools",
    description:
      "Start an order straight from a booking, one-click WhatsApp reminders, and the customer's upcoming visit shown on the tracking page.",
    default: false,
  },
  collections: {
    label: "Collections",
    description:
      "A view of every order with balance due and the total receivable.",
    default: false,
  },
  dailySummary: {
    label: "Daily Closing Summary",
    description:
      "Printable end-of-day report — new orders, deliveries, and cash collected per payment method.",
    default: false,
  },
  orderQuickActions: {
    label: "Order Quick Actions",
    description:
      "Deliver, collect payment and set rack straight from the orders list, plus one-tap filters (due today, overdue, unpaid, drafts).",
    default: false,
  },
  navBadges: {
    label: "Sidebar Badges",
    description:
      "Live counts on the Orders menu — drafts waiting, review queue, ready for pickup.",
    default: false,
  },
  repeatOrder: {
    label: "Repeat Order",
    description:
      "One click on a past order pre-fills a new order for the same customer with the same items.",
    default: false,
  },
  changePassword: {
    label: "Change Password Page",
    description: "Staff can change their own login password from the panel.",
    default: false,
  },
  orderEdit: {
    label: "Order Editing",
    description:
      "Correct an order after creation — items, prices, dates, discount — with totals recalculated.",
    default: false,
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
