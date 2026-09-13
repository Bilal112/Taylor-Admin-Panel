"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useDialog } from "@/context/DialogContext";
import { format } from "date-fns";
import toast from "react-hot-toast";
import clsx from "clsx";
import { errorMessage } from "@/lib/errorMessage";
import { hasFeature } from "@/lib/features";
import { STATUS_BADGE_CLASS, statusLabel, statusBadgeClass } from "@/lib/orderStatus";
import {
  ClockIcon,
  FireIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  PlusIcon,
  ArchiveBoxIcon,
  CheckCircleIcon,
  XCircleIcon,
  BanknotesIcon,
  ClipboardDocumentCheckIcon,
} from "@heroicons/react/24/outline";
import type { Order, OrderStatus, PaymentMethod } from "@/types/order";
import type { Pagination } from "@/types/api";

type Chip = "" | "today" | "overdue" | "unpaid" | "drafts";

// Same set as the order detail page's payment form — kept here too since the
// list page collects payment (Pay/Deliver quick actions) independently.
const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "mobile_money", label: "Mobile Money" },
];

const CHIPS: { key: Chip; label: string; icon: typeof ClockIcon }[] = [
  { key: "", label: "All", icon: DocumentTextIcon },
  { key: "today", label: "Due Today", icon: ClockIcon },
  { key: "overdue", label: "Overdue", icon: FireIcon },
  { key: "unpaid", label: "Unpaid", icon: CurrencyDollarIcon },
  { key: "drafts", label: "Drafts", icon: DocumentTextIcon },
];

export default function OrdersPage() {
  const { user } = useAuth();
  const dialog = useDialog();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Partial<Pagination>>({});
  const [chip, setChip] = useState<Chip>("");
  // "Awaiting Review" quick filter — the three *_review stages at once,
  // so a checker doesn't have to pick them one at a time from the dropdown.
  const [reviewOnly, setReviewOnly] = useState(false);

  const isAdmin = !!user && ["super_admin", "admin"].includes(user.role);
  const isChecker = user?.role === "checker";
  const isDeliveryStaff = user?.role === "delivery_staff";
  // Who can approve/reject — same roles the backend's /:id/review and
  // /bulk-review routes accept.
  const canReview = isAdmin || isChecker;
  // Who can use the Deliver/Pay row actions — same roles the backend's
  // /:id/status (ready->delivered) and /:id/payment routes accept. Not
  // feature-flagged like the other quick actions below: this is
  // delivery_staff's entire job, not an optional admin convenience.
  const canDeliver = isAdmin || isDeliveryStaff;
  const quickActions = isAdmin && hasFeature(user, "orderQuickActions");
  const canSeeCustomer = isAdmin || isDeliveryStaff;
  const canSeeBalance = isAdmin || isDeliveryStaff;

  const [refreshing, setRefreshing] = useState(false);

  // Bulk review — selected order ids (only ever populated with orders
  // currently at a *_review stage; see toggleOne/toggleSelectAll).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const fetchOrders = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (search) params.search = search;
      if (reviewOnly) params.status = "cutting_review,stitching_review,pressing_review";
      else if (statusFilter) params.status = statusFilter;
      // Quick-filter chips (orderQuickActions feature)
      if (chip === "unpaid") params.unpaid = "1";
      else if (chip === "today") params.due = "today";
      else if (chip === "overdue") params.due = "overdue";
      else if (chip === "drafts") params.status = "draft";
      const { data } = await api.get("/orders", { params });
      setOrders(data.data);
      setPagination(data.pagination);
      setSelected(new Set());
      if (silent) toast.success("Orders refreshed");
    } catch {
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, chip, reviewOnly]);

  // ── Bulk review — approve/reject every selected order in one call
  // instead of opening each order's detail page. Only orders at a *_review
  // stage are ever selectable (see the checkbox render below). ───────────
  const reviewableIds = orders
    .filter((o) => o.status.endsWith("_review"))
    .map((o) => o._id);
  const allReviewableSelected =
    reviewableIds.length > 0 && reviewableIds.every((id) => selected.has(id));

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSelectAll = () =>
    setSelected(allReviewableSelected ? new Set() : new Set(reviewableIds));

  const runBulkReview = async (decision: "approve" | "reject", remark?: string) => {
    setBulkBusy(true);
    try {
      const { data } = await api.put("/orders/bulk-review", {
        orderIds: Array.from(selected),
        decision,
        remark,
      });
      const { succeeded, failed } = data.data as {
        succeeded: string[];
        failed: { id: string; message: string }[];
      };
      const verb = decision === "approve" ? "approved" : "rejected";
      if (failed.length === 0) {
        toast.success(`${succeeded.length} order${succeeded.length === 1 ? "" : "s"} ${verb}`);
      } else {
        toast.error(
          `${succeeded.length} ${verb}, ${failed.length} failed — ${failed[0].message}${failed.length > 1 ? ` (+${failed.length - 1} more)` : ""}`,
          { duration: 6000 },
        );
      }
      setSelected(new Set());
      fetchOrders({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err, "Bulk review failed"));
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkApprove = async () => {
    const ok = await dialog.confirm({
      title: "Approve Selected Orders",
      message: `Approve all ${selected.size} selected order(s)? Each moves to its next stage.`,
      confirmText: "Approve All",
    });
    if (ok) runBulkReview("approve");
  };

  const bulkReject = async () => {
    const remark = await dialog.prompt({
      title: "Reject Selected Orders",
      message: `This note (optional) is added to all ${selected.size} selected order(s) — each is sent back to its current working stage.`,
      placeholder: "e.g. Sleeve length is off — redo",
      confirmText: "Reject All",
    });
    if (remark !== null) runBulkReview("reject", remark.trim() || undefined);
  };

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fetchOrders();
  };

  // ── Quick actions (orderQuickActions feature) — the three moves an admin
  // makes all day, straight from the row, via the themed dialog (DialogContext)
  // rather than native window.prompt/confirm. The API enforces all the usual
  // rules either way. ────────────────────────────────────────────────────
  const markReady = async (order: Order) => {
    const rack = await dialog.prompt({
      title: "Mark as Ready",
      message: "Enter the rack number for this order.",
      defaultValue: order.rackNumber || "",
      placeholder: "e.g. R-5",
      confirmText: "Mark Ready",
    });
    if (rack === null) return;
    if (!rack.trim()) {
      toast.error("Rack number is required");
      return;
    }
    try {
      await api.put(`/orders/${order._id}/status`, {
        status: "ready",
        rackNumber: rack.trim(),
      });
      toast.success("Marked as ready 📦");
      fetchOrders({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update order"));
    }
  };

  // Asks amount, then payment method (same options as the order detail
  // page's payment form) — two themed prompts in sequence since a single
  // dialog only ever resolves one value. Returns null if the admin backs
  // out of either step.
  const promptForPayment = async (
    balanceDue: number,
  ): Promise<{ amount: number; method: PaymentMethod } | null> => {
    const amountStr = await dialog.prompt({
      title: "Collect Payment",
      message: `Balance due: PKR ${balanceDue.toLocaleString()}`,
      defaultValue: String(balanceDue || ""),
      type: "number",
      min: 1,
      max: balanceDue,
      confirmText: "Next",
    });
    if (amountStr === null) return null;
    const amount = Number(amountStr);
    if (!(amount > 0)) {
      toast.error("Enter a valid amount");
      return null;
    }
    // The `max` attribute only limits the spinner — a typed value can still
    // exceed it, so this is the real gate (the API enforces it too).
    if (amount > balanceDue) {
      toast.error(`Cannot exceed the balance due (PKR ${balanceDue.toLocaleString()})`);
      return null;
    }
    const method = await dialog.prompt({
      title: "Payment Method",
      message: `Recording PKR ${amount.toLocaleString()}. How did they pay?`,
      type: "select",
      options: PAYMENT_METHOD_OPTIONS,
      confirmText: "Record Payment",
    });
    if (method === null) return null;
    return { amount, method: method as PaymentMethod };
  };

  const collectPayment = async (order: Order) => {
    const result = await promptForPayment(order.balanceDue || 0);
    if (!result) return;
    try {
      await api.put(`/orders/${order._id}/payment`, result);
      toast.success("Payment recorded");
      fetchOrders({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err, "Failed to record payment"));
    }
  };

  const deliverOrder = async (order: Order) => {
    try {
      const balanceDue = order.balanceDue || 0;
      if (balanceDue > 0) {
        const paid = await dialog.confirm({
          title: "Deliver Order",
          message: `Balance due is PKR ${balanceDue.toLocaleString()}. Did the customer pay before pickup?`,
          confirmText: "Yes, Collect Payment",
          cancelText: "No, Deliver Anyway",
        });
        if (paid) {
          const method = await dialog.prompt({
            title: "Payment Method",
            message: `Recording the full balance — PKR ${balanceDue.toLocaleString()}. How did they pay?`,
            type: "select",
            options: PAYMENT_METHOD_OPTIONS,
            confirmText: "Collect & Deliver",
          });
          // Backed out of picking a method — stop here rather than deliver
          // without knowing whether/how the balance was actually collected.
          if (method === null) return;
          await api.put(`/orders/${order._id}/payment`, {
            amount: balanceDue,
            method: method as PaymentMethod,
          });
        }
        // Not paid — deliver anyway, balance stays outstanding for later.
      } else {
        const ok = await dialog.confirm({
          title: "Deliver Order",
          message: "Mark this order as delivered?",
          confirmText: "Deliver",
        });
        if (!ok) return;
      }
      await api.put(`/orders/${order._id}/status`, { status: "delivered" });
      toast.success("Delivered");
      fetchOrders({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err, "Failed to deliver order"));
    }
  };

  // "Due tomorrow, not ready" — highlight rows at risk of missing pickup
  const isDueTomorrowNotReady = (order: Order) => {
    if (
      !order.promisedDate ||
      (["ready", "delivered", "cancelled"] as OrderStatus[]).includes(order.status)
    )
      return false;
    const promised = new Date(order.promisedDate);
    const now = new Date();
    const startOfTomorrow = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );
    const startOfDayAfter = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 2,
    );
    return promised >= startOfTomorrow && promised < startOfDayAfter;
  };

  // Build columns dynamically based on role
  const columns = [
    { key: "select", label: "", show: canReview },
    { key: "order", label: "Order #", show: true },
    { key: "customer", label: "Customer", show: canSeeCustomer },
    { key: "garment", label: "Garment", show: true },
    { key: "status", label: "Status", show: true },
    { key: "promised", label: "Promised", show: true },
    { key: "balance", label: "Balance Due", show: canSeeBalance },
    { key: "actions", label: "", show: true },
  ].filter((c) => c.show);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl sm:text-2xl font-extrabold text-ink">Orders</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchOrders({ silent: true })}
            disabled={refreshing}
            className="btn-secondary text-sm"
            title="Refresh orders"
          >
            <ArrowPathIcon className={clsx("h-4 w-4", refreshing && "animate-spin")} aria-hidden="true" />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          {isAdmin && (
            <Link href="/orders/new" className="btn-primary text-sm">
              <PlusIcon className="h-4 w-4" aria-hidden="true" />
              New Order
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex gap-3 flex-wrap">
        <form
          onSubmit={handleSearch}
          className="flex gap-2 flex-1 min-w-[200px]"
        >
          <input
            className="input flex-1"
            placeholder="Search order #, suit #, or customer name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn-primary text-sm shrink-0">
            Search
          </button>
        </form>
        <select
          className="input w-full sm:w-48"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as OrderStatus | "");
            setReviewOnly(false);
            setPage(1);
          }}
        >
          <option value="">All Statuses</option>
          {(Object.keys(STATUS_BADGE_CLASS) as OrderStatus[]).map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </div>

      {/* Awaiting-review quick filter — checker/admin only, not feature-gated
          (this is core review workflow, not the optional orderQuickActions
          convenience chips below). Spans all three *_review stages at once. */}
      {canReview && (
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setReviewOnly((v) => !v);
              setStatusFilter("");
              setPage(1);
            }}
            className={clsx(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
              reviewOnly
                ? "bg-accent text-white border-accent"
                : "border-border text-muted hover:border-accent hover:text-accent",
            )}
          >
            <ClipboardDocumentCheckIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Awaiting Review
          </button>
        </div>
      )}

      {/* Quick-filter chips (orderQuickActions feature) */}
      {quickActions && (
        <div className="flex gap-2 flex-wrap">
          {CHIPS.map(({ key, label, icon: ChipIcon }) => (
            <button
              key={key}
              onClick={() => {
                setChip(key);
                setPage(1);
              }}
              className={clsx(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                chip === key
                  ? "bg-accent text-white border-accent"
                  : "border-border text-muted hover:border-accent hover:text-accent",
              )}
            >
              <ChipIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Bulk review action bar — appears once 1+ review-stage rows are picked */}
      {canReview && selected.size > 0 && (
        <div className="card flex items-center justify-between flex-wrap gap-3 bg-accent-soft border-accent/30">
          <span className="text-sm font-semibold text-ink">
            {selected.size} order{selected.size === 1 ? "" : "s"} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={bulkApprove}
              disabled={bulkBusy}
              className="btn-primary text-sm"
            >
              <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
              Approve All
            </button>
            <button
              onClick={bulkReject}
              disabled={bulkBusy}
              className="btn-secondary text-sm"
            >
              <XCircleIcon className="h-4 w-4" aria-hidden="true" />
              Reject All
            </button>
            <button
              onClick={() => setSelected(new Set())}
              disabled={bulkBusy}
              className="text-xs text-muted hover:text-ink"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        </div>
      ) : orders.length === 0 ? (
        <div className="card text-center py-12 text-faint">No orders found</div>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <div className="md:hidden space-y-3">
            {orders.map((order) => {
              const dueTomorrow = isDueTomorrowNotReady(order);
              const customer = typeof order.customer === "object" ? order.customer : null;
              return (
                <Link
                  key={order._id}
                  href={`/orders/${order._id}`}
                  className={clsx(
                    "card block space-y-2",
                    dueTomorrow && "bg-danger-soft border-danger/30",
                  )}
                >
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="font-mono font-semibold text-accent text-sm">
                      {order.orderNumber}
                    </span>
                    <div className="flex items-center gap-2">
                      {canReview && order.status.endsWith("_review") && (
                        <input
                          type="checkbox"
                          className="accent-accent h-4 w-4"
                          checked={selected.has(order._id)}
                          readOnly
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleOne(order._id);
                          }}
                          aria-label={`Select order ${order.orderNumber} for bulk review`}
                        />
                      )}
                      <span className={statusBadgeClass(order.status)}>
                        {statusLabel(order.status)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {order.isRush && <span className="badge-danger text-xs">RUSH</span>}
                    {dueTomorrow && (
                      <span className="badge-danger text-xs">
                        <ClockIcon className="h-3 w-3" aria-hidden="true" />
                        Due Tomorrow
                      </span>
                    )}
                    {order.status === "ready" && order.rackNumber && (
                      <span className="badge-accent text-xs">
                        <ArchiveBoxIcon className="h-3 w-3" aria-hidden="true" />
                        Rack {order.rackNumber}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted">
                    {(order.items || [])
                      .map(
                        (it) =>
                          `${it.garmentType}${it.quantity > 1 ? ` ×${it.quantity}` : ""}`,
                      )
                      .join(", ")}
                  </div>
                  {order.suitNo && (
                    <div className="text-xs text-faint">Suit No: {order.suitNo}</div>
                  )}
                  {order.status === "delivered" && order.deliveredBy && (
                    <div className="text-xs text-faint">
                      Delivered by{" "}
                      {(typeof order.deliveredBy === "object" && order.deliveredBy.name) || "—"}
                    </div>
                  )}
                  {canSeeCustomer && customer?.name && (
                    <div className="text-xs text-muted">
                      {customer.name} · {"phone" in customer ? customer.phone : ""}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
                    <span
                      className={
                        order.promisedDate &&
                        new Date(order.promisedDate) < new Date() &&
                        order.status !== "delivered"
                          ? "text-danger font-semibold"
                          : "text-muted"
                      }
                    >
                      {order.promisedDate
                        ? format(new Date(order.promisedDate), "dd MMM yyyy")
                        : "—"}
                    </span>
                    {canSeeBalance && (
                      <span
                        className={
                          order.balanceDue > 0
                            ? "text-danger font-semibold"
                            : "text-success font-semibold"
                        }
                      >
                        PKR {order.balanceDue?.toLocaleString()}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block table-wrap">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th key={col.key} className="whitespace-nowrap">
                        {col.key === "select" ? (
                          reviewableIds.length > 0 && (
                            <input
                              type="checkbox"
                              className="accent-accent h-4 w-4"
                              checked={allReviewableSelected}
                              onChange={toggleSelectAll}
                              aria-label="Select all orders awaiting review"
                            />
                          )
                        ) : (
                          col.label
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const dueTomorrow = isDueTomorrowNotReady(order);
                    const customer = typeof order.customer === "object" ? order.customer : null;
                    return (
                      <tr
                        key={order._id}
                        className={clsx(dueTomorrow && "bg-danger-soft")}
                      >
                        {/* Select — checker/admin only, only for orders actually awaiting review */}
                        {canReview && (
                          <td>
                            {order.status.endsWith("_review") && (
                              <input
                                type="checkbox"
                                className="accent-accent h-4 w-4"
                                checked={selected.has(order._id)}
                                onChange={() => toggleOne(order._id)}
                                aria-label={`Select order ${order.orderNumber} for bulk review`}
                              />
                            )}
                          </td>
                        )}

                        {/* Order # — always shown, truncated to keep the column narrow */}
                        <td className="font-mono font-semibold text-accent max-w-[110px]">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span
                              className="truncate inline-block max-w-[90px] align-bottom"
                              title={order.orderNumber}
                            >
                              {order.orderNumber}
                            </span>
                            {order.isRush && (
                              <span className="badge-danger text-xs shrink-0">RUSH</span>
                            )}
                            {dueTomorrow && (
                              <span className="badge-danger text-xs shrink-0" title="Due tomorrow">
                                <ClockIcon className="h-3 w-3" aria-hidden="true" />
                              </span>
                            )}
                            {order.status === "ready" && order.rackNumber && (
                              <span className="badge-accent text-xs shrink-0">
                                <ArchiveBoxIcon className="h-3 w-3" aria-hidden="true" />
                                {order.rackNumber}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Customer — admin only */}
                        {canSeeCustomer && (
                          <td>
                            <div className="font-semibold text-ink">{customer?.name}</div>
                            <div className="text-xs text-faint">
                              {customer && "phone" in customer ? customer.phone : ""}
                            </div>
                          </td>
                        )}

                        {/* Items — always shown */}
                        <td className="text-muted">
                          <div>
                            {(order.items || [])
                              .map(
                                (it) =>
                                  `${it.garmentType}${it.quantity > 1 ? ` ×${it.quantity}` : ""}`,
                              )
                              .join(", ")}
                          </div>
                          {order.suitNo && (
                            <div className="text-xs text-faint">Suit No: {order.suitNo}</div>
                          )}
                          {order.status === "delivered" && order.deliveredBy && (
                            <div className="text-xs text-faint">
                              Delivered by{" "}
                              {(typeof order.deliveredBy === "object" && order.deliveredBy.name) || "—"}
                            </div>
                          )}
                        </td>

                        {/* Status — always shown */}
                        <td>
                          <span className={statusBadgeClass(order.status)}>
                            {statusLabel(order.status)}
                          </span>
                        </td>

                        {/* Promised date — always shown */}
                        <td className="whitespace-nowrap">
                          <span
                            className={
                              order.promisedDate &&
                              new Date(order.promisedDate) < new Date() &&
                              order.status !== "delivered"
                                ? "text-danger font-semibold"
                                : "text-muted"
                            }
                          >
                            {order.promisedDate
                              ? format(
                                  new Date(order.promisedDate),
                                  "dd MMM yyyy",
                                )
                              : "—"}
                          </span>
                        </td>

                        {/* Balance — admin only */}
                        {canSeeBalance && (
                          <td className="font-semibold whitespace-nowrap">
                            <span className={order.balanceDue > 0 ? "text-danger" : "text-success"}>
                              PKR {order.balanceDue?.toLocaleString()}
                            </span>
                          </td>
                        )}

                        {/* Actions */}
                        <td className="whitespace-nowrap">
                          {quickActions && order.status === "quality_check" && (
                            <button
                              onClick={() => markReady(order)}
                              className="inline-flex items-center gap-1 text-xs text-accent hover:underline mr-3"
                            >
                              <ArchiveBoxIcon className="h-3.5 w-3.5" aria-hidden="true" />
                              Rack
                            </button>
                          )}
                          {canDeliver && order.status === "ready" && (
                            <button
                              onClick={() => deliverOrder(order)}
                              className="inline-flex items-center gap-1 text-xs text-success hover:underline mr-3"
                            >
                              <CheckCircleIcon className="h-3.5 w-3.5" aria-hidden="true" />
                              Deliver
                            </button>
                          )}
                          {canDeliver &&
                            (order.balanceDue || 0) > 0 &&
                            order.status !== "cancelled" && (
                              <button
                                onClick={() => collectPayment(order)}
                                className="inline-flex items-center gap-1 text-xs text-warning hover:underline mr-3"
                              >
                                <BanknotesIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                Pay
                              </button>
                            )}
                          <Link
                            href={`/orders/${order._id}`}
                            className="text-accent hover:underline text-xs font-semibold"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!!pagination.pages && pagination.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface-hover">
                <span className="text-sm text-muted">
                  Page {pagination.page} of {pagination.pages} (
                  {pagination.total} total)
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="btn-secondary text-xs px-3 py-1 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <button
                    disabled={page >= pagination.pages}
                    onClick={() => setPage((p) => p + 1)}
                    className="btn-secondary text-xs px-3 py-1 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile pagination */}
          {!!pagination.pages && pagination.pages > 1 && (
            <div className="md:hidden flex items-center justify-between px-1">
              <span className="text-xs text-muted">
                Page {pagination.page} of {pagination.pages} ({pagination.total}{" "}
                total)
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="btn-secondary text-xs px-3 py-1 disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  disabled={page >= pagination.pages}
                  onClick={() => setPage((p) => p + 1)}
                  className="btn-secondary text-xs px-3 py-1 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
