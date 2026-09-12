"use client";
import { useCallback, useEffect, useState, type ComponentType, type SVGProps } from "react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { errorMessage } from "@/lib/errorMessage";
import { useAuth } from "@/context/AuthContext";
import {
  PrinterIcon,
  ScissorsIcon,
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  BanknotesIcon,
  CheckCircleIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import type { Branch } from "@/types/user";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

// Daily closing summary (feature flag `dailySummary`) — what the admin
// reconciles the cash drawer against at the end of the day. The Print
// button uses the global print CSS (app chrome is hidden automatically).
interface Summary {
  newOrders: { count: number; value: number };
  delivered: number;
  payments: { _id: string; amount: number; count: number }[];
  collectedTotal: number;
  appointments: { _id: string; count: number }[];
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank Transfer",
  mobile_money: "Mobile Money",
};

const day = (d: Date) => d.toLocaleDateString("en-CA");

export default function DailySummaryPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const [date, setDate] = useState(() => day(new Date()));
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSuperAdmin) return;
    api
      .get("/branches")
      .then(({ data }) => setBranches(data.data))
      .catch(() => {});
  }, [isSuperAdmin]);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get("/dashboard/daily-summary", {
        params: { date, ...(branchId ? { branch: branchId } : {}) },
      })
      .then(({ data }) => setData(data.data))
      .catch((err) => toast.error(errorMessage(err, "Failed to load summary")))
      .finally(() => setLoading(false));
  }, [date, branchId]);

  useEffect(load, [load]);

  const appointmentsBooked = (data?.appointments || []).reduce(
    (s, a) => s + a.count,
    0,
  );

  const summaryTiles: { label: string; value: string; icon: Icon; tone?: "success" }[] = data
    ? [
        { label: "New Orders", value: String(data.newOrders.count), icon: ClipboardDocumentListIcon },
        {
          label: "Orders Value",
          value: `PKR ${(data.newOrders.value || 0).toLocaleString()}`,
          icon: BanknotesIcon,
        },
        { label: "Delivered", value: String(data.delivered), icon: CheckCircleIcon, tone: "success" },
        {
          label: "Cash Collected",
          value: `PKR ${data.collectedTotal.toLocaleString()}`,
          icon: ArrowDownTrayIcon,
          tone: "success",
        },
      ]
    : [];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-extrabold text-ink">
          Daily Summary
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            className="input text-sm w-auto"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          {isSuperAdmin && (
            <select
              className="input text-sm w-auto"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          <button onClick={() => window.print()} className="btn-primary text-sm">
            <PrinterIcon className="h-4 w-4" aria-hidden="true" />
            Print
          </button>
        </div>
      </div>

      {loading || !data ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      ) : (
        <div className="space-y-4">
          <p className="hidden print:flex items-center gap-1.5 text-lg font-bold">
            <ScissorsIcon className="h-4 w-4" aria-hidden="true" />
            Daily Summary — {new Date(`${date}T00:00:00`).toLocaleDateString()}
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryTiles.map(({ label, value, icon: TileIcon, tone }) => (
              <div key={label} className="stat-card">
                <div className="stat-card-label flex items-center gap-1.5">
                  <TileIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {label}
                </div>
                <p className={`stat-card-value ${tone === "success" ? "text-success" : ""}`}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="card p-0 overflow-hidden">
            <h2 className="font-semibold text-ink px-4 py-3 border-b border-border">
              Payments Collected
            </h2>
            {data.payments.length === 0 ? (
              <p className="px-4 py-6 text-sm text-faint">
                No payments recorded this day.
              </p>
            ) : (
              <table className="table">
                <tbody>
                  {data.payments.map((p) => (
                    <tr key={p._id}>
                      <td className="text-muted">
                        {METHOD_LABELS[p._id] || p._id}
                        <span className="text-xs text-faint ml-2">
                          {p.count} payment{p.count === 1 ? "" : "s"}
                        </span>
                      </td>
                      <td className="text-right font-semibold text-ink">
                        PKR {p.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border">
                    <td className="font-bold text-ink">
                      Total
                    </td>
                    <td className="text-right font-bold text-ink">
                      PKR {data.collectedTotal.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {appointmentsBooked > 0 && (
            <p className="flex items-center gap-1.5 text-sm text-muted">
              <CalendarDaysIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {appointmentsBooked} appointment
              {appointmentsBooked === 1 ? "" : "s"} for this day (
              {(data.appointments || [])
                .map((a) => `${a.count} ${a._id}`)
                .join(", ")}
              )
            </p>
          )}
        </div>
      )}
    </div>
  );
}
