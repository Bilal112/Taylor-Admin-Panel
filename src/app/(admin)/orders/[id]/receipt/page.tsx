"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { format } from "date-fns";
import { useAuth } from "@/context/AuthContext";
import { hasFeature } from "@/lib/features";
import { isValidObjectId } from "@/lib/validate";
import type { Order, OrderItem } from "@/types/order";

// Printable customer slip (receiptPrinting feature). Sized for an 80mm
// thermal roll but prints fine on A4 too — the print CSS in globals.css
// hides the app shell so only .print-receipt reaches the paper. Deliberately
// black-on-white in both themes: it's a paper preview, not app UI.

const lineTotal = (it: OrderItem) =>
  (it.basePrice || 0) * (it.quantity || 1) + (it.fabricAmount || 0);

export default function ReceiptPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = !!user && ["super_admin", "admin"].includes(user.role);

  useEffect(() => {
    const oid = String(id);
    if (!isValidObjectId(oid)) {
      setLoading(false);
      return;
    }
    api
      .get(`/orders/${oid}`)
      .then(({ data }) => setOrder(data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );

  if (!isAdmin || !hasFeature(user, "receiptPrinting"))
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Receipt printing is not enabled for your branch.
      </p>
    );

  if (!order)
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">Order not found.</p>
    );

  const customer = typeof order.customer === "object" ? order.customer : null;
  const branch = typeof order.branch === "object" ? order.branch : null;
  const itemsSubtotal = (order.items || []).reduce(
    (s, it) => s + lineTotal(it),
    0,
  );
  const receiptDate = order.receivedDate || order.createdAt;

  return (
    <div className="space-y-4">
      <div className="no-print flex gap-3">
        <button onClick={() => window.print()} className="btn-primary text-sm">
          🖨 Print
        </button>
        <button onClick={() => router.back()} className="btn-secondary text-sm">
          Back to Order
        </button>
      </div>

      <div className="print-receipt bg-white text-black border border-gray-300 rounded-lg p-6 w-full max-w-[340px] text-sm space-y-3">
        {/* Shop header */}
        <div className="text-center space-y-0.5">
          <p className="text-lg font-bold">✂️ {branch?.name || "Taylor App"}</p>
          {branch?.address && <p className="text-xs">{branch.address}</p>}
          {branch?.phone && <p className="text-xs">☎ {branch.phone}</p>}
        </div>

        <hr className="border-dashed border-gray-400" />

        {/* Order + customer */}
        <div className="text-xs space-y-0.5">
          <p className="flex justify-between">
            <span>Order</span>
            <span className="font-mono font-semibold">{order.orderNumber}</span>
          </p>
          {order.suitNo && (
            <p className="flex justify-between">
              <span>Suit No</span>
              <span className="font-semibold">{order.suitNo}</span>
            </p>
          )}
          {receiptDate && (
            <p className="flex justify-between">
              <span>Date</span>
              <span>{format(new Date(receiptDate), "dd MMM yyyy")}</span>
            </p>
          )}
          {order.promisedDate && (
            <p className="flex justify-between">
              <span>Ready by</span>
              <span className="font-semibold">
                {format(new Date(order.promisedDate), "dd MMM yyyy")}
              </span>
            </p>
          )}
          {customer && (
            <p className="flex justify-between">
              <span>Customer</span>
              <span className="font-semibold text-right">
                {customer.name}
                {"phone" in customer && customer.phone ? ` · ${customer.phone}` : ""}
              </span>
            </p>
          )}
          {order.rackNumber && (
            <p className="flex justify-between">
              <span>Rack</span>
              <span className="font-semibold">{order.rackNumber}</span>
            </p>
          )}
        </div>

        <hr className="border-dashed border-gray-400" />

        {/* Items */}
        <div className="text-xs space-y-1">
          {(order.items || []).map((it, i) => (
            <div key={i} className="flex justify-between gap-2">
              <span>
                {it.garmentType} × {it.quantity || 1}
                {(it.fabricAmount || 0) > 0 ? " (+fabric)" : ""}
              </span>
              <span className="whitespace-nowrap">
                {lineTotal(it).toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        <hr className="border-dashed border-gray-400" />

        {/* Totals */}
        <div className="text-xs space-y-0.5">
          <p className="flex justify-between">
            <span>Subtotal</span>
            <span>PKR {itemsSubtotal.toLocaleString()}</span>
          </p>
          {(order.rushSurcharge || 0) > 0 && (
            <p className="flex justify-between">
              <span>Rush</span>
              <span>PKR {(order.rushSurcharge || 0).toLocaleString()}</span>
            </p>
          )}
          {(order.discountAmount || 0) > 0 && (
            <p className="flex justify-between">
              <span>Discount</span>
              <span>- PKR {(order.discountAmount || 0).toLocaleString()}</span>
            </p>
          )}
          <p className="flex justify-between text-sm font-bold border-t border-gray-300 pt-1 mt-1">
            <span>TOTAL</span>
            <span>PKR {(order.totalPrice || 0).toLocaleString()}</span>
          </p>
          <p className="flex justify-between">
            <span>Paid</span>
            <span>PKR {(order.amountPaid || 0).toLocaleString()}</span>
          </p>
          <p className="flex justify-between font-bold">
            <span>Balance Due</span>
            <span>PKR {(order.balanceDue || 0).toLocaleString()}</span>
          </p>
        </div>

        <hr className="border-dashed border-gray-400" />

        <p className="text-center text-xs">
          Thank you for your order!
          <br />
          Please bring this slip at pickup.
        </p>
      </div>
    </div>
  );
}
