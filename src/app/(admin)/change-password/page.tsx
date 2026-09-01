"use client";
import { useState, type FormEvent } from "react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { errorMessage } from "@/lib/errorMessage";

// Change-password screen (feature flag `changePassword`) — the backend
// endpoint (PUT /api/auth/change-password) existed all along; this is the
// missing UI for it. The session stays valid after a change.
export default function ChangePasswordPage() {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirm: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (form.newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (form.newPassword !== form.confirm) {
      toast.error("New passwords do not match");
      return;
    }
    setSaving(true);
    try {
      await api.put("/auth/change-password", {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
      toast.success("Password updated!");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to change password"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
        Change Password
      </h1>
      <form onSubmit={submit} className="card space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Current Password
          </label>
          <input
            type="password"
            required
            className="input"
            value={form.currentPassword}
            onChange={(e) =>
              setForm((f) => ({ ...f, currentPassword: e.target.value }))
            }
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            New Password
          </label>
          <input
            type="password"
            required
            minLength={6}
            className="input"
            value={form.newPassword}
            onChange={(e) =>
              setForm((f) => ({ ...f, newPassword: e.target.value }))
            }
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            At least 6 characters.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Confirm New Password
          </label>
          <input
            type="password"
            required
            className="input"
            value={form.confirm}
            onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
          />
        </div>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Saving…" : "Update Password"}
        </button>
      </form>
    </div>
  );
}
