"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Search, Filter, Download, RefreshCw, Eye, Trash2,
  CheckCircle, XCircle, Mail, QrCode, ChevronLeft, ChevronRight,
  User, Phone, Building2, AlertTriangle, CheckSquare, Square
} from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";

interface Attendee {
  _id: string;
  fullName: string;
  email: string;
  phone?: string;
  organization?: string;
  registrationId?: string;
  ticketStatus: "none" | "generated" | "revoked";
  emailStatus: string;
  checkInStatus: "not_checked_in" | "checked_in";
  checkedInAt?: string;
  isValid: boolean;
  createdAt: string;
}

interface PaginatedResult {
  attendees: Attendee[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface DeleteTarget {
  type: "single" | "bulk" | "allMatching";
  attendee?: Attendee;
  ids?: string[];
  count: number;
  checkedInCount: number;
}

const EMAIL_STATUS_BADGE: Record<string, string> = {
  none: "badge-gray",
  queued: "badge-yellow",
  sending: "badge-blue",
  accepted: "badge-blue",
  delivered: "badge-green",
  bounced: "badge-yellow",
  failed: "badge-red",
  permanently_failed: "badge-red",
};

export default function AttendeesPage() {
  const [data, setData] = useState<PaginatedResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [checkInFilter, setCheckInFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Attendee | null>(null);

  // Selection & Deletion state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchAttendees = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "25",
        ...(search && { search }),
        ...(checkInFilter && { checkIn: checkInFilter }),
        ...(emailFilter && { email: emailFilter }),
      });
      const res = await fetch(`/api/admin/attendees?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, checkInFilter, emailFilter]);

  useEffect(() => {
    fetchAttendees();
  }, [fetchAttendees]);

  // Clear selections on page/filter change
  useEffect(() => {
    setSelectedIds([]);
    setSelectAllMatching(false);
  }, [page, search, checkInFilter, emailFilter]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  async function exportCSV() {
    const params = new URLSearchParams({ export: "csv", ...(search && { search }) });
    const res = await fetch(`/api/admin/attendees/export?${params}`);
    if (!res.ok) { toast.error("Export failed"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendees-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Checkbox helpers
  const currentPageIds = data?.attendees.map((a) => a._id) || [];
  const isAllCurrentPageSelected =
    currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.includes(id));

  function toggleSelectAllCurrentPage() {
    if (isAllCurrentPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !currentPageIds.includes(id)));
      setSelectAllMatching(false);
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...currentPageIds])));
    }
  }

  function toggleSelectRow(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
    setSelectAllMatching(false);
  }

  // Trigger individual delete modal
  function initiateDeleteSingle(attendee: Attendee) {
    setDeleteTarget({
      type: "single",
      attendee,
      ids: [attendee._id],
      count: 1,
      checkedInCount: attendee.checkInStatus === "checked_in" ? 1 : 0,
    });
  }

  // Trigger bulk delete modal for selected
  function initiateDeleteBulk() {
    if (selectedIds.length === 0) return;
    const selectedAttendees = (data?.attendees || []).filter((a) => selectedIds.includes(a._id));
    const checkedInCount = selectedAttendees.filter((a) => a.checkInStatus === "checked_in").length;

    setDeleteTarget({
      type: selectAllMatching ? "allMatching" : "bulk",
      ids: selectedIds,
      count: selectAllMatching ? (data?.total || selectedIds.length) : selectedIds.length,
      checkedInCount,
    });
  }

  // Execute deletion
  async function executeDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      if (deleteTarget.type === "single" && deleteTarget.attendee) {
        const res = await fetch(`/api/admin/attendees/${deleteTarget.attendee._id}`, {
          method: "DELETE",
        });
        const resData = await res.json();
        if (res.ok) {
          toast.success("تم حذف الحاضر وجميع السجلات المرتبطة به بنجاح");
          if (selected?._id === deleteTarget.attendee._id) {
            setSelected(null);
          }
          setSelectedIds((prev) => prev.filter((id) => id !== deleteTarget.attendee?._id));
          setDeleteTarget(null);
          fetchAttendees();
        } else {
          toast.error(resData.error || "فشل حذف الحاضر");
        }
      } else {
        // Bulk delete
        const body: Record<string, unknown> = {};
        if (deleteTarget.type === "allMatching") {
          body.allMatching = true;
          body.filter = {
            search,
            checkIn: checkInFilter || undefined,
            email: emailFilter || undefined,
          };
        } else {
          body.ids = deleteTarget.ids;
        }

        const res = await fetch("/api/admin/attendees/bulk-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const resData = await res.json();
        if (res.ok) {
          toast.success(`تم حذف ${resData.deletedCount} من الحضور بنجاح`);
          setSelectedIds([]);
          setSelectAllMatching(false);
          setDeleteTarget(null);
          fetchAttendees();
        } else {
          toast.error(resData.error || "فشل الحذف الجماعي");
        }
      }
    } catch {
      toast.error("حدث خطأ في الاتصال بالخادم");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendees</h1>
          <p className="text-sm text-gray-500 mt-1">
            {data ? `${data.total.toLocaleString()} registered attendees` : "Loading..."}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="btn-secondary">
            <Download size={16} />
            Export CSV
          </button>
          <button onClick={fetchAttendees} className="btn-secondary">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6 flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="input pl-9"
              placeholder="Search name, email, or registration ID..."
            />
          </div>
          <button type="submit" className="btn-primary">Search</button>
        </form>
        <div className="flex gap-2">
          <select
            value={checkInFilter}
            onChange={(e) => { setCheckInFilter(e.target.value); setPage(1); }}
            className="input w-36"
          >
            <option value="">All Check-ins</option>
            <option value="checked_in">Checked In</option>
            <option value="not_checked_in">Not Checked In</option>
          </select>
          <select
            value={emailFilter}
            onChange={(e) => { setEmailFilter(e.target.value); setPage(1); }}
            className="input w-36"
          >
            <option value="">All Emails</option>
            <option value="none">Not Sent</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
            <option value="bounced">Bounced</option>
          </select>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in shadow-sm">
          <div className="flex items-center gap-2 text-sm text-red-900 font-medium">
            <span className="w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-bold">
              {selectAllMatching ? data?.total : selectedIds.length}
            </span>
            <span>
              {selectAllMatching
                ? `تم تحديد جميع الحضور المطابقين (${data?.total})`
                : `تم تحديد ${selectedIds.length} من الحضور`}
            </span>
            {!selectAllMatching && data && data.total > selectedIds.length && (
              <button
                onClick={() => setSelectAllMatching(true)}
                className="underline text-red-700 hover:text-red-900 text-xs ml-2 font-semibold"
              >
                تحديد جميع الـ {data.total} حضور المطابقين للبحث
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedIds([]);
                setSelectAllMatching(false);
              }}
              className="btn-secondary btn-sm"
            >
              إلغاء التحديد
            </button>
            <button
              onClick={initiateDeleteBulk}
              className="bg-red-600 hover:bg-red-700 text-white font-medium px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Trash2 size={14} />
              حذف المحدد ({selectAllMatching ? data?.total : selectedIds.length})
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8">
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="skeleton h-8 w-8 rounded-full" />
                  <div className="skeleton h-8 flex-1 rounded" />
                  <div className="skeleton h-8 w-32 rounded" />
                  <div className="skeleton h-8 w-24 rounded" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllCurrentPageSelected}
                      onChange={toggleSelectAllCurrentPage}
                      className="rounded border-gray-300 text-gdg-blue focus:ring-gdg-blue cursor-pointer"
                      title="Select all on this page"
                    />
                  </th>
                  <th>Attendee</th>
                  <th>Email</th>
                  <th>Reg. ID</th>
                  <th>Ticket</th>
                  <th>Email Status</th>
                  <th>Check-in</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.attendees.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-400">
                      <Filter size={32} className="mx-auto mb-2 opacity-30" />
                      No attendees found
                    </td>
                  </tr>
                )}
                {data?.attendees.map((a) => {
                  const isChecked = selectedIds.includes(a._id);
                  return (
                    <tr key={a._id} className={isChecked ? "bg-red-50/30" : ""}>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectRow(a._id)}
                          className="rounded border-gray-300 text-gdg-blue focus:ring-gdg-blue cursor-pointer"
                        />
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gdg-blue/10 flex items-center justify-center flex-shrink-0">
                            <User size={14} className="text-gdg-blue" />
                          </div>
                          <div>
                            <p className="font-medium text-gdg-navy" dir="auto">{a.fullName}</p>
                            {a.organization && (
                              <p className="text-xs text-gray-400 flex items-center gap-1" dir="auto">
                                <Building2 size={10} />{a.organization}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="text-xs text-gray-500">{a.email}</td>
                      <td className="font-mono text-xs text-gray-400">{a.registrationId ?? "—"}</td>
                      <td>
                        <span className={
                          a.ticketStatus === "generated" ? "badge-green" :
                          a.ticketStatus === "revoked" ? "badge-red" : "badge-gray"
                        }>
                          {a.ticketStatus === "generated" ? <><QrCode size={10} /> Generated</> :
                           a.ticketStatus === "revoked" ? "Revoked" : "None"}
                        </span>
                      </td>
                      <td>
                        <span className={EMAIL_STATUS_BADGE[a.emailStatus] ?? "badge-gray"}>
                          {a.emailStatus}
                        </span>
                      </td>
                      <td>
                        {a.checkInStatus === "checked_in" ? (
                          <div>
                            <span className="badge-green">
                              <CheckCircle size={10} /> Checked In
                            </span>
                            {a.checkedInAt && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                {format(new Date(a.checkedInAt), "HH:mm")}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="badge-gray">
                            <XCircle size={10} /> Not yet
                          </span>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelected(a)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                            title="عرض التفاصيل"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => initiateDeleteSingle(a)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                            title="حذف الحاضر"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Showing {((data.page - 1) * data.pageSize) + 1}–{Math.min(data.page * data.pageSize, data.total)} of {data.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary btn-sm"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="flex items-center px-3 text-sm text-gray-600">
                Page {data.page} of {data.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
                className="btn-secondary btn-sm"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Attendee Detail Modal */}
      {selected && (
        <AttendeeModal
          attendee={selected}
          onClose={() => setSelected(null)}
          onRefresh={fetchAttendees}
          onDelete={() => {
            initiateDeleteSingle(selected);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-up border border-red-100">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={24} />
            </div>

            <h3 className="text-lg font-bold text-center text-gdg-navy mb-2">
              {deleteTarget.type === "single"
                ? "تأكيد حذف الحاضر"
                : `تأكيد حذف ${deleteTarget.count} من الحضور`}
            </h3>

            {deleteTarget.type === "single" && deleteTarget.attendee && (
              <div className="bg-gray-50 p-3 rounded-xl mb-4 text-center">
                <p className="font-semibold text-gdg-navy" dir="auto">{deleteTarget.attendee.fullName}</p>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{deleteTarget.attendee.email}</p>
              </div>
            )}

            {/* Checked-In Warning */}
            {deleteTarget.checkedInCount > 0 && (
              <div className="p-3 mb-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs leading-relaxed">
                <div className="flex items-center gap-1.5 font-bold mb-1 text-amber-800">
                  <AlertTriangle size={14} />
                  <span>تحذير: تسجيل حضور مسبق</span>
                </div>
                {deleteTarget.type === "single" ? (
                  <p>هذا الحاضر قام بتسجيل الحضور في الفعالية بالفعل! حذفه سيؤدي لإلغاء صلاحية التذكرة ورمز الدخول نهائياً.</p>
                ) : (
                  <p>يوجد ({deleteTarget.checkedInCount}) من الحضور المحددين قاموا بتسجيل الحضور في الفعالية بالفعل.</p>
                )}
              </div>
            )}

            <p className="text-sm text-gray-600 text-center mb-6 leading-relaxed">
              سيتم حذف سجل الحضور وإلغاء صلاحية أي تذاكر أو رموز QR صادرة لهم، مع إلغاء وحذف أي مهام بريد إلكتروني معلقة.
              <br />
              <strong className="text-red-600 block mt-1">هذا الإجراء نهائي ولا يمكن التراجع عنه.</strong>
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="btn-secondary flex-1 justify-center"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={executeDelete}
                className="bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-xl flex-1 justify-center flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
              >
                {isDeleting ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AttendeeModal({
  attendee, onClose, onRefresh, onDelete
}: {
  attendee: Attendee;
  onClose: () => void;
  onRefresh: () => void;
  onDelete: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function resendTicket() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/attendees/${attendee._id}/resend-ticket`, { method: "POST" });
      if (res.ok) { toast.success("Ticket resent!"); onRefresh(); }
      else { const e = await res.json(); toast.error(e.error || "Failed"); }
    } finally { setLoading(false); }
  }

  async function manualCheckIn() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/attendees/${attendee._id}/manual-checkin`, { method: "POST" });
      if (res.ok) { toast.success("Checked in!"); onRefresh(); onClose(); }
      else { const e = await res.json(); toast.error(e.error || "Failed"); }
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scale-up overflow-hidden">
        <div className="bg-gradient-to-r from-gdg-blue to-blue-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Attendee Details</h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/20">
              <XCircle size={20} />
            </button>
          </div>
          <p className="text-blue-100 text-sm mt-1">{attendee.registrationId ?? "No Reg. ID"}</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gdg-blue/10 flex items-center justify-center">
              <User size={22} className="text-gdg-blue" />
            </div>
            <div>
              <p className="font-bold text-gdg-navy text-lg" dir="auto">{attendee.fullName}</p>
              <p className="text-sm text-gray-500">{attendee.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {attendee.phone && (
              <div className="flex items-center gap-2 text-gray-600">
                <Phone size={14} className="text-gray-400" />
                {attendee.phone}
              </div>
            )}
            {attendee.organization && (
              <div className="flex items-center gap-2 text-gray-600">
                <Building2 size={14} className="text-gray-400" />
                <span dir="auto">{attendee.organization}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2">
            <div className="text-center p-3 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-400">Ticket</p>
              <span className={`text-xs font-medium mt-1 block ${attendee.ticketStatus === "generated" ? "text-green-600" : "text-gray-400"}`}>
                {attendee.ticketStatus}
              </span>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-400">Email</p>
              <span className="text-xs font-medium mt-1 block text-blue-600">{attendee.emailStatus}</span>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-400">Check-in</p>
              <span className={`text-xs font-medium mt-1 block ${attendee.checkInStatus === "checked_in" ? "text-green-600" : "text-gray-400"}`}>
                {attendee.checkInStatus === "checked_in" ? "✓ In" : "Pending"}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <div className="flex gap-2">
              {attendee.ticketStatus === "generated" && (
                <button onClick={resendTicket} disabled={loading} className="btn-secondary flex-1 justify-center text-sm">
                  <Mail size={14} />
                  Resend Ticket
                </button>
              )}
              {attendee.checkInStatus !== "checked_in" && (
                <button onClick={manualCheckIn} disabled={loading} className="btn-success flex-1 justify-center text-sm">
                  <CheckCircle size={14} />
                  Manual Check-in
                </button>
              )}
            </div>

            <button
              onClick={() => {
                onClose();
                onDelete();
              }}
              className="w-full py-2 px-3 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <Trash2 size={14} />
              حذف هذا الحاضر (Delete Attendee)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
