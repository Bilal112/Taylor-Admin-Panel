"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { statusBadgeClass, statusLabel } from "@/lib/orderStatus";
import { TruckIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import type { Order } from "@/types/order";

// Default to tomorrow (browser-local day), same convention as the backend default.
const tomorrowStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD
};

export default function UpcomingDeliveryPage() {
  const { user } = useAuth();
  const isAdmin = !!user && ["super_admin", "admin"].includes(user.role);
  const [date, setDate] = useState(tomorrowStr());
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = (d: string) => {
    setLoading(true);
    api
      .get("/orders/upcoming-delivery", { params: { date: d } })
      .then((r) => setOrders(r.data.data))
      .catch(() => toast.error("Failed to load upcoming deliveries"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const itemsSummary = (order: Order) =>
    (order.items?.length ? order.items : [])
      .map(
        (it) => `${it.garmentType}${it.quantity > 1 ? ` ×${it.quantity}` : ""}`,
      )
      .join(", ");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-extrabold text-ink">
          <TruckIcon className="h-5 w-5 text-accent" aria-hidden="true" />
          Upcoming Delivery
        </h1>
        <button
          onClick={() => fetchOrders(date)}
          className="btn-secondary text-sm"
        >
          <ArrowPathIcon className="h-4 w-4" aria-hidden="true" />
          Refresh
        </button>
      </div>

      {/* Date picker — defaults to tomorrow, admin/checker can change it */}
      <div className="card p-4 flex items-center gap-3 flex-wrap">
        <label className="text-sm font-semibold text-ink">
          Promised Date
        </label>
        <input
          type="date"
          className="input w-auto"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setDate(tomorrowStr())}
          className="text-xs text-accent hover:underline"
        >
          Reset to tomorrow
        </button>
        <span className="text-sm text-faint ml-auto">
          {orders.length} order{orders.length !== 1 ? "s" : ""} promised{" "}
          {date === tomorrowStr()
            ? "tomorrow"
            : format(new Date(`${date}T00:00:00`), "dd MMM yyyy")}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        </div>
      ) : orders.length === 0 ? (
        <div className="card text-center py-12 text-faint">
          No orders promised for this date
        </div>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <div className="md:hidden space-y-3">
            {orders.map((order) => {
              const customer = typeof order.customer === "object" ? order.customer : null;
              return (
                <Link
                  key={order._id}
                  href={`/orders/${order._id}`}
                  className="card block space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-accent text-sm">
                      {order.orderNumber}
                    </span>
                    <span className={statusBadgeClass(order.status)}>
                      {statusLabel(order.status)}
                    </span>
                  </div>
                  <div className="text-sm text-muted">
                    {itemsSummary(order)}
                  </div>
                  {isAdmin && customer?.name && (
                    <div className="text-xs text-faint">
                      {customer.name} · {"phone" in customer ? customer.phone : ""}
                    </div>
                  )}
                  {order.suitNo && (
                    <div className="text-xs text-faint">
                      Suit No: {order.suitNo}
                    </div>
                  )}
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
                    <th>Order #</th>
                    {isAdmin && <th>Customer</th>}
                    <th>Items</th>
                    <th>Suit No</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const customer = typeof order.customer === "object" ? order.customer : null;
                    return (
                      <tr key={order._id}>
                        <td className="font-mono font-semibold text-accent">
                          {order.orderNumber}
                        </td>
                        {isAdmin && (
                          <td>
                            <div className="font-medium text-ink">
                              {customer?.name}
                            </div>
                            <div className="text-xs text-faint">
                              {customer && "phone" in customer ? customer.phone : ""}
                            </div>
                          </td>
                        )}
                        <td className="text-muted">
                          {itemsSummary(order)}
                        </td>
                        <td className="text-muted">
                          {order.suitNo || "—"}
                        </td>
                        <td>
                          <span className={statusBadgeClass(order.status)}>
                            {statusLabel(order.status)}
                          </span>
                        </td>
                        <td>
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
          </div>
        </>
      )}
    </div>
  );
}
