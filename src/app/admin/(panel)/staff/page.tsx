"use client";
import { useState, useEffect, useCallback } from "react";
import { Shield, UserPlus, RefreshCw, Trash2, CheckCircle2, XCircle, KeyRound, User, Mail, Lock } from "lucide-react";
import toast from "react-hot-toast";

interface StaffMember {
  _id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/staff");
      if (res.ok) {
        const data = await res.json();
        setStaff(data.staff ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  async function handleCreateStaff(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        toast.success("Staff member created successfully!");
        setShowAddModal(false);
        setForm({ name: "", email: "", password: "" });
        fetchStaff();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to create staff member");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStatus(id: string, currentStatus: boolean) {
    try {
      const res = await fetch(`/api/admin/staff/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (res.ok) {
        toast.success(`Staff account ${!currentStatus ? "activated" : "deactivated"}`);
        fetchStaff();
      } else {
        toast.error("Failed to update status");
      }
    } catch {
      toast.error("Network error");
    }
  }

  async function deleteStaff(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete staff member "${name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/staff/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Staff member deleted");
        fetchStaff();
      } else {
        toast.error("Failed to delete staff member");
      }
    } catch {
      toast.error("Network error");
    }
  }

  return (
    <div className="animate-fade-in max-w-5xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Shield size={24} className="text-gdg-blue" />
            Event Staff Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage check-in agents and event assistants with scanner access
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            <UserPlus size={16} />
            Add Staff Member
          </button>
          <button onClick={fetchStaff} className="btn-secondary">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Staff List Table */}
      <div className="card overflow-hidden">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Staff Member</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Created</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400">
                    Loading staff accounts...
                  </td>
                </tr>
              ) : staff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    <Shield size={36} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No staff accounts found</p>
                    <p className="text-xs mt-1">Click &quot;Add Staff Member&quot; to authorize check-in scanners</p>
                  </td>
                </tr>
              ) : (
                staff.map((s) => (
                  <tr key={s._id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-gdg-blue flex items-center justify-center font-bold text-xs">
                          {s.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gdg-navy">{s.name}</p>
                          <p className="text-xs text-gray-400">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge-blue uppercase text-[10px] tracking-wider">
                        {s.role}
                      </span>
                    </td>
                    <td>
                      <span className={s.isActive ? "badge-green" : "badge-gray"}>
                        {s.isActive ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="text-xs text-gray-500">
                      {s.lastLogin ? new Date(s.lastLogin).toLocaleString() : "Never"}
                    </td>
                    <td className="text-xs text-gray-400">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => toggleStatus(s._id, s.isActive)}
                          className="btn-secondary btn-sm"
                          title={s.isActive ? "Deactivate" : "Activate"}
                        >
                          {s.isActive ? (
                            <XCircle size={14} className="text-red-500" />
                          ) : (
                            <CheckCircle2 size={14} className="text-green-600" />
                          )}
                          {s.isActive ? "Disable" : "Enable"}
                        </button>
                        <button
                          onClick={() => deleteStaff(s._id, s.name)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up overflow-hidden">
            <div className="bg-gradient-to-r from-gdg-blue to-blue-600 p-6 text-white">
              <h2 className="text-lg font-bold">Add Staff Member</h2>
              <p className="text-blue-100 text-xs mt-1">
                Authorized staff can log in to scan and validate attendee tickets.
              </p>
            </div>
            <form onSubmit={handleCreateStaff} className="p-6 space-y-4">
              <div>
                <label className="label">Full Name *</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    className="input pl-10"
                    placeholder="e.g. Sarah Ahmed"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="label">Email Address *</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    className="input pl-10"
                    placeholder="sarah@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="label">Initial Password *</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    className="input pl-10"
                    placeholder="At least 6 characters"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary flex-1 justify-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary flex-1 justify-center"
                >
                  {submitting ? <RefreshCw size={16} className="animate-spin" /> : "Create Staff"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
