"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { format } from "date-fns";
import toast from "react-hot-toast";
import clsx from "clsx";

const STATUS_COLORS = {
  draft: "bg-slate-100 text-slate-600",
  received: "bg-blue-100 text-blue-800",
  cutting: "bg-yellow-100 text-yellow-800",
  cutting_review: "bg-amber-100 text-amber-800",
  stitching: "bg-purple-100 text-purple-800",
  stitching_review: "bg-amber-100 text-amber-800",
  pressing: "bg-orange-100 text-orange-800",
  pressing_review: "bg-amber-100 text-amber-800",
  quality_check: "bg-cyan-100 text-cyan-800",
  ready: "bg-green-100 text-green-800",
  delivered: "bg-gray-100 text-gray-700",
  rework: "bg-red-100 text-red-800",
  cancelled: "bg-gray-200 text-gray-500",
};

const STATUS_LABELS = {
  cutting_review: "Awaiting Checker (Cutting)",
  stitching_review: "Awaiting Checker (Stitching)",
  pressing_review: "Awaiting Checker (Pressing)",
};

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});

  const isAdmin = ["super_admin", "admin"].includes(user?.role);
  const canSeeCustomer = isAdmin;
  const canSeeBalance = isAdmin;

  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
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
  }, [page, statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchOrders();
  };

  // "Due tomorrow, not ready" — highlight rows at risk of missing pickup
  const isDueTomorrowNotReady = (order) => {
    if (
      !order.promisedDate ||
      ["ready", "delivered", "cancelled"].includes(order.status)
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

  const colSpan = columns.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Orders</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchOrders({ silent: true })}
            disabled={refreshing}
            className="btn-secondary text-sm"
            title="Refresh orders"
          >
            {refreshing ? "⏳ Refreshing…" : "🔄 Refresh"}
          </button>
          {isAdmin && (
            <Link href="/orders/new" className="btn-primary text-sm">
              + New Order
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
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Statuses</option>
          {Object.keys(STATUS_COLORS).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s] || s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : orders.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          No orders found
        </div>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <div className="md:hidden space-y-3">
            {orders.map((order) => {
              const dueTomorrow = isDueTomorrowNotReady(order);
              return (
                <Link
                  key={order._id}
                  href={`/orders/${order._id}`}
                  className={clsx(
                    "card block space-y-2",
                    dueTomorrow && "bg-red-50 border-red-200",
                  )}
                >
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="font-mono font-medium text-primary text-sm">
                      {order.orderNumber}
                    </span>
                    <span
                      className={`badge ${STATUS_COLORS[order.status] || "bg-gray-100"}`}
                    >
                      {STATUS_LABELS[order.status] ||
                        order.status?.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {order.isRush && (
                      <span className="badge bg-red-500 text-white text-xs">
                        RUSH
                      </span>
                    )}
                    {dueTomorrow && (
                      <span className="badge bg-red-100 text-red-700 text-xs">
                        ⏰ Due Tomorrow
                      </span>
                    )}
                    {order.status === "ready" && order.rackNumber && (
                      <span className="badge bg-blue-600 text-white text-xs">
                        📦 Rack {order.rackNumber}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-700">
                    {(order.items?.length
                      ? order.items
                      : order.garmentType
                        ? [order]
                        : []
                    )
                      .map(
                        (it) =>
                          `${it.garmentType}${it.quantity > 1 ? ` ×${it.quantity}` : ""}`,
                      )
                      .join(", ")}
                  </div>
                  {order.suitNo && (
                    <div className="text-xs text-gray-400">
                      Suit No: {order.suitNo}
                    </div>
                  )}
                  {canSeeCustomer && order.customer?.name && (
                    <div className="text-xs text-gray-500">
                      {order.customer.name} · {order.customer.phone}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-50">
                    <span
                      className={
                        order.promisedDate &&
                        new Date(order.promisedDate) < new Date() &&
                        order.status !== "delivered"
                          ? "text-red-600 font-medium"
                          : "text-gray-500"
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
                            ? "text-red-600 font-medium"
                            : "text-green-600 font-medium"
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
          <div className="hidden md:block bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orders.map((order) => {
                    const dueTomorrow = isDueTomorrowNotReady(order);
                    return (
                      <tr
                        key={order._id}
                        className={clsx(
                          "hover:bg-gray-50 transition-colors",
                          dueTomorrow && "bg-red-50 hover:bg-red-100",
                        )}
                      >
                        {/* Order # — always shown, truncated to keep the column narrow */}
                        <td className="px-4 py-3 font-mono font-medium text-primary max-w-[110px]">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span
                              className="truncate inline-block max-w-[90px] align-bottom"
                              title={order.orderNumber}
                            >
                              {order.orderNumber}
                            </span>
                            {order.isRush && (
                              <span className="badge bg-red-500 text-white text-xs shrink-0">
                                RUSH
                              </span>
                            )}
                            {dueTomorrow && (
                              <span className="badge bg-red-100 text-red-700 text-xs shrink-0">
                                ⏰
                              </span>
                            )}
                            {order.status === "ready" && order.rackNumber && (
                              <span className="badge bg-blue-600 text-white text-xs shrink-0">
                                📦 {order.rackNumber}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Customer — admin only */}
                        {canSeeCustomer && (
                          <td className="px-4 py-3">
                            <div className="font-medium">
                              {order.customer?.name}
                            </div>
                            <div className="text-xs text-gray-400">
                              {order.customer?.phone}
                            </div>
                          </td>
                        )}

                        {/* Items — always shown */}
                        <td className="px-4 py-3 text-gray-700">
                          <div>
                            {(order.items?.length
                              ? order.items
                              : order.garmentType
                                ? [order]
                                : []
                            )
                              .map(
                                (it, i) =>
                                  `${it.garmentType}${it.quantity > 1 ? ` ×${it.quantity}` : ""}`,
                              )
                              .join(", ")}
                          </div>
                          {order.suitNo && (
                            <div className="text-xs text-gray-400">
                              Suit No: {order.suitNo}
                            </div>
                          )}
                        </td>

                        {/* Status — always shown */}
                        <td className="px-4 py-3">
                          <span
                            className={`badge ${STATUS_COLORS[order.status] || "bg-gray-100"}`}
                          >
                            {STATUS_LABELS[order.status] ||
                              order.status?.replace(/_/g, " ")}
                          </span>
                        </td>

                        {/* Promised date — always shown */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={
                              order.promisedDate &&
                              new Date(order.promisedDate) < new Date() &&
                              order.status !== "delivered"
                                ? "text-red-600 font-medium"
                                : "text-gray-700"
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
                          <td className="px-4 py-3 font-medium whitespace-nowrap">
                            <span
                              className={
                                order.balanceDue > 0
                                  ? "text-red-600"
                                  : "text-green-600"
                              }
                            >
                              PKR {order.balanceDue?.toLocaleString()}
                            </span>
                          </td>
                        )}

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <Link
                            href={`/orders/${order._id}`}
                            className="text-primary hover:underline text-xs font-medium"
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

            {pagination.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                <span className="text-sm text-gray-500">
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
          {pagination.pages > 1 && (
            <div className="md:hidden flex items-center justify-between px-1">
              <span className="text-xs text-gray-500">
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
