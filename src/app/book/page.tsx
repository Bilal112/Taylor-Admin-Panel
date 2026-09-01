"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { normalizePkMobile, PHONE_ERROR } from "@/lib/phone";
import { to12h } from "@/lib/time";

// PUBLIC page — no login. Customers pick a branch, a day and an hour slot,
// leave their name + phone, and get a confirmation. Availability and all
// rules (hours, capacity, one active booking per phone) are enforced by
// /api/public — this page just renders what the API says.

interface PublicBranch {
  _id: string;
  name: string;
  address?: string;
  city?: string;
  enabled: boolean;
  message: string;
  openTime: string;
  closeTime: string;
}

interface Slot {
  time: string;
  remaining: number;
  past: boolean;
}

const day = (d: Date) => d.toLocaleDateString("en-CA");

export default function BookPage() {
  const [branches, setBranches] = useState<PublicBranch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [date, setDate] = useState(() => day(new Date()));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsMsg, setSlotsMsg] = useState(""); // "closed" message, if any
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState<{
    branch: string;
    date: string;
    time: string;
    visitTime?: string;
    name: string;
  } | null>(null);

  const maxDate = day(new Date(Date.now() + 30 * 86400000));
  const branch = branches.find((b) => b._id === branchId);
  // Live feedback while typing — the submit handler re-checks anyway, and
  // the server is the final gate.
  const phoneInvalid = phone.trim() !== "" && !normalizePkMobile(phone);

  useEffect(() => {
    api
      .get("/public/branches")
      .then(({ data }) => {
        setBranches(data.data);
        if (data.data.length === 1) setBranchId(data.data[0]._id);
      })
      .catch(() => setError("Could not load branches — please try again later"));
  }, []);

  useEffect(() => {
    setTime("");
    setSlots([]);
    setSlotsMsg("");
    if (!branchId || !date) return;
    if (branch && !branch.enabled) {
      setSlotsMsg(branch.message);
      return;
    }
    setLoadingSlots(true);
    api
      .get("/public/slots", { params: { branch: branchId, date } })
      .then(({ data }) => {
        if (data.enabled === false) setSlotsMsg(data.message);
        else setSlots(data.data);
      })
      .catch(() => setSlotsMsg("Could not load times — please try again"))
      .finally(() => setLoadingSlots(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, date]);

  const book = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!branchId || !time) return;
    const normalizedPhone = normalizePkMobile(phone);
    if (!normalizedPhone) {
      setError(PHONE_ERROR);
      return;
    }
    setBooking(true);
    setError("");
    try {
      const { data } = await api.post("/public/appointments", {
        branch: branchId,
        date,
        time,
        name: name.trim(),
        phone: normalizedPhone,
      });
      setConfirmed(data.data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Booking failed — please try again";
      setError(msg);
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-light to-white dark:from-gray-900 dark:to-gray-950 px-4 py-10">
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary">
            <Link href="/">✂️ Taylor App</Link>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Book an appointment
          </p>
        </div>

        {confirmed ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 text-center space-y-3 border border-transparent dark:border-gray-800">
            <p className="text-4xl">✅</p>
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              Appointment booked!
            </p>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-0.5">
              <p>
                {confirmed.branch} —{" "}
                {new Date(`${confirmed.date}T00:00:00`).toLocaleDateString()}
              </p>
              <p>Under the name {confirmed.name}</p>
            </div>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Please visit the shop near{" "}
              <span className="text-primary">
                {to12h(confirmed.visitTime || confirmed.time)}
              </span>
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Please arrive on time. To change it, visit or call the shop.
            </p>
          </div>
        ) : (
          <form
            onSubmit={book}
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 space-y-4 border border-transparent dark:border-gray-800"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Branch
              </label>
              <select
                required
                className="input"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                <option value="">Select branch…</option>
                {branches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                    {b.city ? ` — ${b.city}` : ""}
                  </option>
                ))}
              </select>
              {branch?.address && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {branch.address}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date
              </label>
              <input
                required
                type="date"
                className="input"
                min={day(new Date())}
                max={maxDate}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {slotsMsg && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-300">
                {slotsMsg}
              </div>
            )}

            {loadingSlots && (
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Loading times…
              </p>
            )}

            {slots.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Time
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {slots.map((s) => {
                    const disabled = s.past || s.remaining <= 0;
                    return (
                      <button
                        key={s.time}
                        type="button"
                        disabled={disabled}
                        onClick={() => setTime(s.time)}
                        className={`rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${
                          time === s.time
                            ? "bg-primary text-white border-primary"
                            : disabled
                              ? "border-gray-200 dark:border-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed"
                              : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-primary"
                        }`}
                      >
                        {to12h(s.time)}
                        <span className="block text-[10px] font-normal">
                          {disabled
                            ? s.past
                              ? "passed"
                              : "full"
                            : `${s.remaining} left`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Your name
                </label>
                <input
                  required
                  minLength={2}
                  maxLength={60}
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone number
                </label>
                <input
                  required
                  className={`input ${phoneInvalid ? "border-red-400 focus:ring-red-400" : ""}`}
                  placeholder="03XX XXXXXXX"
                  inputMode="tel"
                  maxLength={16}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                {phoneInvalid && (
                  <p className="text-xs text-red-500 mt-1">{PHONE_ERROR}</p>
                )}
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={booking || !time || !branchId || phoneInvalid}
              className="btn-primary w-full"
            >
              {booking ? "Booking…" : "Book Appointment"}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
          <Link href="/track" className="text-primary hover:underline">
            📦 Track your order
          </Link>
          {" · "}
          <Link href="/login" className="hover:underline">
            Staff login
          </Link>
        </p>
      </div>
    </div>
  );
}
