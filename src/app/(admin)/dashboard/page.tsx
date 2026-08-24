"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { errorMessage } from "@/lib/errorMessage";
import type { OrderStatus } from "@/types/order";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: string;
  color?: string;
}

const StatCard = ({ label, value, icon, color = "text-primary" }: StatCardProps) => (
  <div className="card flex items-center gap-4">
    <div className="text-3xl">{icon}</div>
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value ?? "—"}</p>
    </div>
  </div>
);

const STATUS_COLORS: Partial<Record<OrderStatus, string>> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  received: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  cutting: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  cutting_review: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  stitching: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  stitching_review: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  pressing: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  pressing_review: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  ready: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  delivered: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  rework: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const STATUS_LABELS: Partial<Record<OrderStatus, string>> = {
  cutting_review: "Awaiting Checker (Cutting)",
  stitching_review: "Awaiting Checker (Stitching)",
  pressing_review: "Awaiting Checker (Pressing)",
};

interface DueTomorrowOrder {
  _id: string;
  orderNumber: string;
  status: OrderStatus;
  items?: { garmentType: string }[];
  garmentType?: string;
  customer?: { name?: string };
}

interface StatusBreakdownEntry {
  _id: OrderStatus;
  count: number;
}

interface DashboardStats {
  dueTomorrowCount?: number;
  dueTomorrowOrders?: DueTomorrowOrder[];
  totalOrders?: number;
  activeOrders?: number;
  readyOrders?: number;
  overdueOrders?: number;
  totalCustomers?: number;
  revenue?: { total?: number; paid?: number };
  statusBreakdown?: StatusBreakdownEntry[];
  last7Days?: { _id: string; count: number }[];
}

export default function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = !!user && ["super_admin", "admin"].includes(user.role);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/dashboard/stats")
      .then((r) => setStats(r.data.data))
      .catch((err) => toast.error(errorMessage(err, "Failed to load dashboard")))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>

      {/* Due tomorrow alert — visible to admin and checker */}
      {!!stats?.dueTomorrowCount && stats.dueTomorrowCount > 0 && (
        <div className="card border-l-4 border-red-500 dark:border-red-600 bg-red-50 dark:bg-red-950/40">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-red-800 dark:text-red-300 flex items-center gap-2 text-sm sm:text-base">
              <span>⏰</span> Due Tomorrow — Not Ready Yet (
              {stats.dueTomorrowCount})
            </h2>
          </div>
          <div className="space-y-2">
            {stats.dueTomorrowOrders?.map((o) => (
              <Link
                key={o._id}
                href={`/orders/${o._id}`}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 bg-white dark:bg-gray-900 rounded-lg px-3 py-2 border border-red-100 dark:border-red-900 hover:border-red-300 dark:hover:border-red-700 transition-colors"
              >
                <div className="min-w-0">
                  <span className="font-mono font-medium text-primary text-sm">
                    {o.orderNumber}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">
                    {o.items?.map((it) => it.garmentType).join(", ") ||
                      o.garmentType}
                  </span>
                  {isAdmin && o.customer?.name && (
                    <span className="text-gray-400 dark:text-gray-500 text-xs ml-2">
                      · {o.customer.name}
                    </span>
                  )}
                </div>
                <span
                  className={`badge shrink-0 ${STATUS_COLORS[o.status] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}
                >
                  {STATUS_LABELS[o.status] || o.status?.replace(/_/g, " ")}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Orders" value={stats?.totalOrders} icon="📋" />
        <StatCard
          label="Active Orders"
          value={stats?.activeOrders}
          icon="⚙️"
          color="text-yellow-600"
        />
        <StatCard
          label="Ready to Pickup"
          value={stats?.readyOrders}
          icon="✅"
          color="text-green-600"
        />
        <StatCard
          label="Overdue"
          value={stats?.overdueOrders}
          icon="⚠️"
          color="text-red-600"
        />
        <StatCard
          label="Total Customers"
          value={stats?.totalCustomers}
          icon="👤"
        />
        {isAdmin && (
          <>
            <StatCard
              label="Total Revenue"
              value={`PKR ${stats?.revenue?.total?.toLocaleString() || 0}`}
              icon="💰"
              color="text-green-700"
            />
            <StatCard
              label="Amount Collected"
              value={`PKR ${stats?.revenue?.paid?.toLocaleString() || 0}`}
              icon="💵"
            />
            <StatCard
              label="Outstanding"
              value={`PKR ${((stats?.revenue?.total || 0) - (stats?.revenue?.paid || 0)).toLocaleString()}`}
              icon="📌"
              color="text-red-600"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status breakdown */}
        <div className="card">
          <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-4">Orders by Status</h2>
          <div className="space-y-2">
            {stats?.statusBreakdown?.map((s) => (
              <div key={s._id} className="flex items-center justify-between">
                <span
                  className={`badge ${STATUS_COLORS[s._id] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}
                >
                  {STATUS_LABELS[s._id] || s._id?.replace(/_/g, " ")}
                </span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Last 7 days chart */}
        <div className="card">
          <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-4">
            Orders — Last 7 Days
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats?.last7Days || []}>
              <XAxis
                dataKey="_id"
                tickFormatter={(d) => format(new Date(d), "MMM d")}
                tick={{ fontSize: 11 }}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#1a56db" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
