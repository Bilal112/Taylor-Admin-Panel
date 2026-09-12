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
  BanknotesIcon,
} from "@heroicons/react/24/outline";
import type { Order, OrderStatus } from "@/types/order";
import type { Pagination } from "@/types/api";

type Chip = "" | "today" | "overdue" | "unpaid" | "drafts";

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

  const isAdmin = !!user && ["super_admin", "admin"].includes(user.role);
  const quickActions = isAdmin && hasFeature(user, "orderQuickActions");
  const canSeeCustomer = isAdmin;
  const canSeeBalance = isAdmin;

  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      // Quick-filter chips (orderQuickActions feature)
      if (chip === "unpaid") params.unpaid = "1";
      else if (chip === "today") params.due = "today";
      else if (chip === "overdue") params.due = "overdue";
      else if (chip === "drafts") params.status = "draft";
      const { data } = await api.get("/orders", { params });
      setOrders(data.data);
      setPagination(data.pagination);
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
  }, [page, statusFilter, chip]);

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

  const collectPayment = async (order: Order) => {
    const balanceDue = order.balanceDue || 0;
    const amountStr = await dialog.prompt({
      title: "Collect Payment",
      message: `Balance due: PKR ${balanceDue.toLocaleString()}`,
      defaultValue: String(balanceDue || ""),
      type: "number",
      min: 1,
      max: balanceDue,
      confirmText: "Record Payment",
    });
    if (amountStr === null) return;
    const amount = Number(amountStr);
    if (!(amount > 0)) {
      toast.error("Enter a valid amount");
      return;
    }
    // The `max` attribute only limits the spinner — a typed value can still
    // exceed it, so this is the real gate (the API enforces it too).
    if (amount > balanceDue) {
      toast.error(`Cannot exceed the balance due (PKR ${balanceDue.toLocaleString()})`);
      return;
    }
    try {
      await api.put(`/orders/${order._id}/payment`, { amount, method: "cash" });
      toast.success("Payment recorded 💵");
      fetchOrders({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err, "Failed to record payment"));
    }
  };

  const deliverOrder = async (order: Order) => {
    try {
      if ((order.balanceDue || 0) > 0) {
        const collect = await dialog.confirm({
          title: "Collect Balance & Deliver",
          message: `Balance due is PKR ${order.balanceDue.toLocaleString()}. Collect it as cash and mark delivered?`,
          confirmText: "Collect & Deliver",
        });
        if (!collect) return;
        await api.put(`/orders/${order._id}/payment`, {
          amount: order.balanceDue,
          method: "cash",
        });
      } else {
        const ok = await dialog.confirm({
          title: "Deliver Order",
          message: "Mark this order as delivered?",
          confirmText: "Deliver",
        });
        if (!ok) return;
      }
      await api.put(`/orders/${order._id}/status`, { status: "delivered" });
      toast.success("Delivered ✓");
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
                    <span className={statusBadgeClass(order.status)}>
                      {statusLabel(order.status)}
                    </span>
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
                        {col.label}
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
                          {quickActions && order.status === "ready" && (
                            <button
                              onClick={() => deliverOrder(order)}
                              className="inline-flex items-center gap-1 text-xs text-success hover:underline mr-3"
                            >
                              <CheckCircleIcon className="h-3.5 w-3.5" aria-hidden="true" />
                              Deliver
                            </button>
                          )}
                          {quickActions &&
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
