import type { OrderStatus } from "@/types/order";

// Single source of truth for how an order status renders as a badge —
// previously duplicated (and drifting) across 5 pages. Collapses the 13
// pipeline states down to the app's 5 semantic tones instead of a bespoke
// hue per status, so color always means the same thing: warning = being
// worked on, accent = waiting on a person to act, success = done, danger =
// a problem, neutral = no action pending (draft/delivered/cancelled).
export const STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  draft: "badge-neutral",
  received: "badge-accent",
  cutting: "badge-warning",
  cutting_review: "badge-accent",
  stitching: "badge-warning",
  stitching_review: "badge-accent",
  pressing: "badge-warning",
  pressing_review: "badge-accent",
  quality_check: "badge-accent",
  ready: "badge-success",
  delivered: "badge-neutral",
  rework: "badge-danger",
  cancelled: "badge-neutral",
};

export const STATUS_LABELS: Partial<Record<OrderStatus, string>> = {
  cutting_review: "Awaiting Checker (Cutting)",
  stitching_review: "Awaiting Checker (Stitching)",
  pressing_review: "Awaiting Checker (Pressing)",
  quality_check: "Quality Check",
};

export const statusLabel = (status: OrderStatus | string): string =>
  STATUS_LABELS[status as OrderStatus] || status.replace(/_/g, " ");

export const statusBadgeClass = (status: OrderStatus | string): string =>
  STATUS_BADGE_CLASS[status as OrderStatus] || "badge-neutral";
