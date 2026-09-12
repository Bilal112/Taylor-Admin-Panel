"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { errorMessage } from "@/lib/errorMessage";
import { useAuth } from "@/context/AuthContext";
import { statusBadgeClass, statusLabel } from "@/lib/orderStatus";
import {
  BanknotesIcon,
  ClipboardDocumentListIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import type { Branch } from "@/types/user";

// Collections (feature flag `collections`): every order still owing money.
interface CollectionRow {
  _id: string;
  orderNumber: string;
  suitNo?: string;
  status: string;
  totalPrice: number;
  amountPaid: number;
  balanceDue: number;
  promisedDate?: string;
  customer: { _id: string; name: string; phone?: string } | string;
  branch: { _id: string; name: string } | string;
}

export default function CollectionsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [rows, setRows] = useState<CollectionRow[]>([]);
  const [totals, setTotals] = useState({ count: 0, receivable: 0 });
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
      .get("/dashboard/collections", {
        params: branchId ? { branch: branchId } : {},
      })
      .then(({ data }) => {
        setRows(data.data);
        setTotals(data.totals);
      })
      .catch((err) => toast.error(errorMessage(err, "Failed to load collections")))
      .finally(() => setLoading(false));
  }, [branchId]);

  useEffect(load, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-extrabold text-ink">
          Collections
        </h1>
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
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className="stat-card">
          <div className="stat-card-label flex items-center gap-1.5">
            <BanknotesIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            Total Receivable
          </div>
          <p className="stat-card-value text-danger">
            PKR {totals.receivable.toLocaleString()}
          </p>
        </div>
        <div className="stat-card">
          <div className="stat-card-label flex items-center gap-1.5">
            <ClipboardDocumentListIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            Orders With Balance
          </div>
          <p className="stat-card-value">
            {totals.count.toLocaleString()}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card text-center py-12 text-faint flex flex-col items-center gap-2">
          <CheckCircleIcon className="h-8 w-8 text-success" aria-hidden="true" />
          Nothing outstanding — everything is paid up
        </div>
      ) : (
        <div className="table-wrap">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  {isSuperAdmin && !branchId && <th>Branch</th>}
                  <th>Status</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Balance Due</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const cust = typeof r.customer === "object" ? r.customer : null;
                  return (
                    <tr key={r._id}>
                      <td>
                        <Link
                          href={`/orders/${r._id}`}
                          className="font-mono text-accent hover:underline"
                        >
                          {r.suitNo ? `Suit ${r.suitNo}` : r.orderNumber}
                        </Link>
                      </td>
                      <td>
                        <span className="font-medium text-ink">
                          {cust?.name || "—"}
                        </span>
                        {cust?.phone && (
                          <p className="text-xs text-faint">
                            {cust.phone}
                          </p>
                        )}
                      </td>
                      {isSuperAdmin && !branchId && (
                        <td className="text-muted">
                          {(typeof r.branch === "object" && r.branch?.name) || "—"}
                        </td>
                      )}
                      <td>
                        <span className={statusBadgeClass(r.status)}>
                          {statusLabel(r.status)}
                        </span>
                      </td>
                      <td className="text-right text-muted">
                        {r.totalPrice?.toLocaleString()}
                      </td>
                      <td className="text-right text-muted">
                        {r.amountPaid?.toLocaleString()}
                      </td>
                      <td className="text-right font-bold text-danger">
                        PKR {r.balanceDue?.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
