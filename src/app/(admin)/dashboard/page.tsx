"use client";
import { useEffect, useState, type ComponentType, type SVGProps } from "react";
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
import { statusLabel, statusBadgeClass } from "@/lib/orderStatus";
import {
  ClipboardDocumentListIcon,
  BoltIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  UsersIcon,
  BanknotesIcon,
  ArrowDownTrayIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import type { OrderStatus } from "@/types/order";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: Icon;
  tone?: "success" | "danger";
}

const StatCard = ({ label, value, icon: IconEl, tone }: StatCardProps) => (
  <div className="stat-card">
    <div className="stat-card-label flex items-center gap-1.5">
      <IconEl className="h-4 w-4 shrink-0" aria-hidden="true" />
      {label}
    </div>
    <p
      className={`stat-card-value ${tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : ""}`}
    >
      {value ?? "—"}
    </p>
  </div>
);

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-extrabold text-ink">Dashboard</h1>

      {/* Due tomorrow alert — visible to admin and checker */}
      {!!stats?.dueTomorrowCount && stats.dueTomorrowCount > 0 && (
        <div className="card border-l-4 border-l-danger bg-danger-soft">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-danger flex items-center gap-2 text-sm sm:text-base">
              <ExclamationTriangleIcon className="h-4 w-4" aria-hidden="true" />
              Due Tomorrow — Not Ready Yet ({stats.dueTomorrowCount})
            </h2>
          </div>
          <div className="space-y-2">
            {stats.dueTomorrowOrders?.map((o) => (
              <Link
                key={o._id}
                href={`/orders/${o._id}`}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 bg-surface rounded-lg px-3 py-2 border border-border hover:border-danger transition-colors"
              >
                <div className="min-w-0">
                  <span className="font-mono font-semibold text-accent text-sm">
                    {o.orderNumber}
                  </span>
                  <span className="text-muted text-sm ml-2">
                    {o.items?.map((it) => it.garmentType).join(", ") ||
                      o.garmentType}
                  </span>
                  {isAdmin && o.customer?.name && (
                    <span className="text-faint text-xs ml-2">
                      · {o.customer.name}
                    </span>
                  )}
                </div>
                <span className={`${statusBadgeClass(o.status)} shrink-0`}>
                  {statusLabel(o.status)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Orders" value={stats?.totalOrders} icon={ClipboardDocumentListIcon} />
        <StatCard label="Active Orders" value={stats?.activeOrders} icon={BoltIcon} />
        <StatCard label="Ready to Pickup" value={stats?.readyOrders} icon={CheckCircleIcon} tone="success" />
        <StatCard label="Overdue" value={stats?.overdueOrders} icon={ExclamationTriangleIcon} tone="danger" />
        <StatCard label="Total Customers" value={stats?.totalCustomers} icon={UsersIcon} />
        {isAdmin && (
          <>
            <StatCard
              label="Total Revenue"
              value={`PKR ${stats?.revenue?.total?.toLocaleString() || 0}`}
              icon={BanknotesIcon}
            />
            <StatCard
              label="Amount Collected"
              value={`PKR ${stats?.revenue?.paid?.toLocaleString() || 0}`}
              icon={ArrowDownTrayIcon}
              tone="success"
            />
            <StatCard
              label="Outstanding"
              value={`PKR ${((stats?.revenue?.total || 0) - (stats?.revenue?.paid || 0)).toLocaleString()}`}
              icon={ClockIcon}
              tone="danger"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status breakdown */}
        <div className="card">
          <h2 className="font-semibold text-ink mb-4">Orders by Status</h2>
          <div className="space-y-2">
            {stats?.statusBreakdown?.map((s) => (
              <div key={s._id} className="flex items-center justify-between">
                <span className={statusBadgeClass(s._id)}>{statusLabel(s._id)}</span>
                <span className="font-semibold text-ink">{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Last 7 days chart */}
        <div className="card">
          <h2 className="font-semibold text-ink mb-4">Orders — Last 7 Days</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats?.last7Days || []}>
              <XAxis
                dataKey="_id"
                tickFormatter={(d) => format(new Date(d), "MMM d")}
                tick={{ fontSize: 11 }}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="rgb(var(--color-accent))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
