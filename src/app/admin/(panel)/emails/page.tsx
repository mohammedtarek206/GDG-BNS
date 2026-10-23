"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Send, Mail, CheckCircle, XCircle, AlertTriangle, Clock,
  RefreshCw, Download, Search, RotateCcw, MailCheck, MailX,
  Trash2, Layers, CheckSquare, Square
} from "lucide-react";
import toast from "react-hot-toast";

interface EmailStats {
  total: number;
  pending: number;
  sending: number;
  accepted: number;
  delivered: number;
  bounced: number;
  failed: number;
  permanentlyFailed: number;
}

interface EmailJob {
  _id: string;
  recipientEmail: string;
  recipientName: string;
  status: string;
  attempts: number;
  lastError?: string;
  providerMessageId?: string;
  updatedAt: string;
  campaignId: string;
}

interface CampaignInfo {
  campaignId: string;
  total: number;
  pending: number;
  sent: number;
  failed: number;
  firstCreated: string;
  lastUpdated: string;
}

interface DeleteTarget {
  type: "single" | "bulk" | "status" | "campaign";
  job?: EmailJob;
  ids?: string[];
  status?: string;
  statusLabel?: string;
  campaignId?: string;
  count: number;
}

const STATUS_BADGE: Record<string, string> = {
  pending: "badge-gray",
  claimed: "badge-blue",
  sending: "badge-blue",
  accepted: "badge-blue",
  delivered: "badge-green",
  bounced: "badge-yellow",
  failed: "badge-red",
  permanently_failed: "badge-red",
};

export default function EmailsPage() {
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [jobs, setJobs] = useState<EmailJob[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"jobs" | "campaigns">("jobs");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [confirmingQueue, setConfirmingQueue] = useState(false);
  const [confirmingRetry, setConfirmingRetry] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [testEmail, setTestEmail] = useState("mm1062686@gmail.com");
  const [sendingTest, setSendingTest] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);

  // Selection & Delete states
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
      });
      const [statsRes, jobsRes, campaignsRes] = await Promise.all([
        fetch("/api/admin/emails/stats"),
        fetch(`/api/admin/emails/jobs?${params}`),
        fetch("/api/admin/emails/campaigns"),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (jobsRes.ok) {
        const data = await jobsRes.json();
        setJobs(data.jobs ?? []);
      }
      if (campaignsRes.ok) {
        const cData = await campaignsRes.json();
        setCampaigns(cData.campaigns ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setSelectedJobIds([]);
  }, [search, statusFilter]);

  async function handleQueueEmails() {
    setConfirmingQueue(false);
    setProcessing(true);
    try {
      const res = await fetch("/api/admin/emails/queue", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(`تمت جدولة ${data.queued} إيميل بنجاح`);
        fetchData();
      } else {
        toast.error(data.error || "فشلت الجدولة");
      }
    } finally {
      setProcessing(false);
    }
  }

  async function handleProcessBatch() {
    setProcessing(true);
    try {
      const res = await fetch("/api/admin/emails/process", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(`تم إرسال ${data.sent} إيميل (${data.failed} فشل)`);
        fetchData();
      } else {
        toast.error(data.error || "فشل المعالجة");
      }
    } finally {
      setProcessing(false);
    }
  }

  async function handleRetryFailed() {
    setConfirmingRetry(false);
    setRetrying(true);
    try {
      const res = await fetch("/api/admin/emails/retry", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(`تمت جدولة ${data.retried} إيميل لإعادة المحاولة`);
        fetchData();
      } else {
        toast.error(data.error || "فشلت إعادة المحاولة");
      }
    } finally {
      setRetrying(false);
    }
  }

  async function handleRetryJob(jobId: string) {
    const res = await fetch(`/api/admin/emails/jobs/${jobId}/retry`, { method: "POST" });
    if (res.ok) {
      toast.success("تمت جدولة إعادة المحاولة");
      fetchData();
    } else {
      const e = await res.json();
      toast.error(e.error || "فشلت إعادة المحاولة");
    }
  }

  async function exportDeliveryReport() {
    const res = await fetch("/api/admin/emails/export");
    if (!res.ok) { toast.error("فشل التصدير"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `email-report-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSendTestEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!testEmail) return;
    setSendingTest(true);
    try {
      const res = await fetch("/api/admin/emails/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`تم إرسال الإيميل التجريبي إلى ${testEmail}!`);
        setShowTestModal(false);
      } else {
        toast.error(data.error || "فشل إرسال الإيميل التجريبي");
      }
    } catch {
      toast.error("فشل الاتصال بخدمة الإيميل التجريبي");
    } finally {
      setSendingTest(false);
    }
  }

  // Checkbox helpers
  const currentJobIds = jobs.map((j) => j._id);
  const isAllCurrentSelected =
    currentJobIds.length > 0 && currentJobIds.every((id) => selectedJobIds.includes(id));

  function toggleSelectAllCurrent() {
    if (isAllCurrentSelected) {
      setSelectedJobIds((prev) => prev.filter((id) => !currentJobIds.includes(id)));
    } else {
      setSelectedJobIds((prev) => Array.from(new Set([...prev, ...currentJobIds])));
    }
  }

  function toggleSelectRow(id: string) {
    setSelectedJobIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  // Delete initiation triggers
  function initiateDeleteJob(job: EmailJob) {
    setDeleteTarget({
      type: "single",
      job,
      ids: [job._id],
      count: 1,
    });
  }

  function initiateDeleteSelected() {
    if (selectedJobIds.length === 0) return;
    setDeleteTarget({
      type: "bulk",
      ids: selectedJobIds,
      count: selectedJobIds.length,
    });
  }

  function initiateDeleteByStatus(status: string, label: string, count: number) {
    setDeleteTarget({
      type: "status",
      status,
      statusLabel: label,
      count,
    });
  }

  function initiateDeleteCampaign(campaign: CampaignInfo) {
    setDeleteTarget({
      type: "campaign",
      campaignId: campaign.campaignId,
      count: campaign.total,
    });
  }

  // Execute deletion
  async function executeDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      if (deleteTarget.type === "single" && deleteTarget.job) {
        const res = await fetch(`/api/admin/emails/jobs/${deleteTarget.job._id}`, {
          method: "DELETE",
        });
        const resData = await res.json();
        if (res.ok) {
          toast.success("تم حذف سجل البريد بنجاح");
          setSelectedJobIds((prev) => prev.filter((id) => id !== deleteTarget.job?._id));
          setDeleteTarget(null);
          fetchData();
        } else {
          toast.error(resData.error || "فشل حذف سجل البريد");
        }
      } else if (deleteTarget.type === "campaign" && deleteTarget.campaignId) {
        const res = await fetch(`/api/admin/emails/campaigns/${deleteTarget.campaignId}`, {
          method: "DELETE",
        });
        const resData = await res.json();
        if (res.ok) {
          toast.success(`تم حذف الحملة (${resData.deletedJobsCount} إيميل) وإعادة تعيين حالة الحضور المتأثرين`);
          setDeleteTarget(null);
          fetchData();
        } else {
          toast.error(resData.error || "فشل حذف الحملة");
        }
      } else if (deleteTarget.type === "status" && deleteTarget.status) {
        const res = await fetch("/api/admin/emails/jobs/bulk-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: deleteTarget.status }),
        });
        const resData = await res.json();
        if (res.ok) {
          toast.success(`تم حذف ${resData.deletedCount} إيميل بنجاح`);
          setDeleteTarget(null);
          fetchData();
        } else {
          toast.error(resData.error || "فشل حذف الإيميلات");
        }
      } else if (deleteTarget.type === "bulk" && deleteTarget.ids) {
        const res = await fetch("/api/admin/emails/jobs/bulk-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobIds: deleteTarget.ids }),
        });
        const resData = await res.json();
        if (res.ok) {
          toast.success(`تم حذف ${resData.deletedCount} إيميل بنجاح`);
          setSelectedJobIds([]);
          setDeleteTarget(null);
          fetchData();
        } else {
          toast.error(resData.error || "فشل حذف الإيميلات المحددة");
        }
      }
    } catch {
      toast.error("حدث خطأ في الاتصال بالخادم");
    } finally {
      setIsDeleting(false);
    }
  }

  const totalFailed = (stats?.failed ?? 0) + (stats?.permanentlyFailed ?? 0);

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Email Manager</h1>
          <p className="text-sm text-gray-500 mt-1">Manage ticket email delivery to all attendees</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTestModal(true)}
            className="btn-secondary text-gdg-blue border-blue-200 hover:bg-blue-50"
          >
            <Send size={16} />
            Send Test Ticket
          </button>
          <button onClick={exportDeliveryReport} className="btn-secondary">
            <Download size={16} />
            Export Report
          </button>
          <button onClick={fetchData} className="btn-secondary">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Resend Free Tier Domain Advisory */}
      <div className="card p-4 mb-6 border-l-4 border-l-amber-500 bg-amber-50/60 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm">
            <h3 className="font-semibold text-amber-900 mb-1">
              تنبيه هام حول قيود حساب Resend التجريبي
            </h3>
            <p className="text-amber-800 leading-relaxed mb-2">
              مفتاح الـ API الخاص بـ Resend مفعل ويعمل بنجاح. حساب Resend بدون دومين مخصص يسمح فقط بالإرسال إلى البريد المسجل به وهو: <strong className="font-mono bg-amber-100 px-1 py-0.5 rounded">mm1062686@gmail.com</strong>.
            </p>
            <p className="text-amber-800 leading-relaxed">
              لإرسال التذاكر لجميع الحضور (Gmail, Yahoo, وغيرها): يرجى ربط وتأكيد الدومين في <a href="https://resend.com/domains" target="_blank" rel="noreferrer" className="underline font-bold text-amber-900 hover:text-amber-950">resend.com/domains</a>، ثم تحديث <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">EMAIL_FROM</code> في ملف <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">.env.local</code>.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Recipients", value: stats?.total ?? 0, icon: Mail, color: "text-gray-500 bg-gray-100" },
          { label: "Pending", value: stats?.pending ?? 0, icon: Clock, color: "text-yellow-600 bg-yellow-100" },
          { label: "Accepted", value: stats?.accepted ?? 0, icon: MailCheck, color: "text-blue-600 bg-blue-100" },
          { label: "Delivered", value: stats?.delivered ?? 0, icon: CheckCircle, color: "text-green-600 bg-green-100" },
          { label: "Bounced", value: stats?.bounced ?? 0, icon: AlertTriangle, color: "text-yellow-600 bg-yellow-100" },
          { label: "Failed", value: stats?.failed ?? 0, icon: XCircle, color: "text-red-600 bg-red-100" },
          { label: "Perm. Failed", value: stats?.permanentlyFailed ?? 0, icon: MailX, color: "text-red-700 bg-red-50" },
          {
            label: "Progress",
            value: stats?.total ? `${Math.round(((stats.accepted + stats.delivered) / stats.total) * 100)}%` : "0%",
            icon: Send,
            color: "text-gdg-blue bg-blue-50"
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${color.split(" ")[1]}`}>
              <Icon size={16} className={color.split(" ")[0]} />
            </div>
            <p className="text-xl font-bold text-gdg-navy">{loading ? "—" : value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Action Panel */}
      <div className="card p-6 mb-6">
        <h2 className="section-title">Send & Manage Tickets</h2>

        <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl mb-4 text-sm text-blue-700">
          <strong>📌 Note:</strong> &quot;Accepted&quot; means the email provider received the message.
          &quot;Delivered&quot; is confirmed via webhook after the provider delivers to the inbox.
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          {/* Queue Button */}
          {!confirmingQueue ? (
            <button
              onClick={() => setConfirmingQueue(true)}
              disabled={processing || loading}
              className="btn-primary"
            >
              <Mail size={16} />
              Queue Emails for All Attendees
            </button>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl animate-fade-in">
              <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-amber-800">
                  This will create email jobs for all attendees with tickets.
                </p>
                <div className="flex gap-2 mt-2">
                  <button onClick={handleQueueEmails} disabled={processing} className="btn-primary btn-sm">
                    {processing ? <RefreshCw size={12} className="animate-spin" /> : null}
                    Confirm Queue
                  </button>
                  <button onClick={() => setConfirmingQueue(false)} className="btn-secondary btn-sm">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Process Batch */}
          {(stats?.pending ?? 0) > 0 && (
            <button
              onClick={handleProcessBatch}
              disabled={processing}
              className="btn-success"
            >
              {processing ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
              Send Pending Batch ({stats?.pending})
            </button>
          )}

          {/* Retry Failed */}
          {totalFailed > 0 && !confirmingRetry && (
            <button
              onClick={() => setConfirmingRetry(true)}
              disabled={retrying}
              className="btn-secondary"
            >
              <RotateCcw size={16} className={retrying ? "animate-spin" : ""} />
              Retry Failed ({totalFailed})
            </button>
          )}

          {confirmingRetry && (
            <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-xl animate-fade-in text-xs text-amber-800">
              <span>إعادة محاولة جميع الإيميلات الفاشلة ({totalFailed})؟</span>
              <button onClick={handleRetryFailed} disabled={retrying} className="btn-primary btn-sm">
                تأكيد
              </button>
              <button onClick={() => setConfirmingRetry(false)} className="btn-secondary btn-sm">
                إلغاء
              </button>
            </div>
          )}

          {/* Quick Clear / Delete Actions */}
          <div className="h-6 w-px bg-gray-200 hidden sm:block mx-1" />

          {totalFailed > 0 && (
            <button
              onClick={() => initiateDeleteByStatus("failed", "جميع الإيميلات الفاشلة", totalFailed)}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1.5 transition-colors"
              title="Delete all failed email records"
            >
              <Trash2 size={14} />
              حذف الفاشلة ({totalFailed})
            </button>
          )}

          {(stats?.pending ?? 0) > 0 && (
            <button
              onClick={() => initiateDeleteByStatus("pending", "الإيميلات قيد الانتظار", stats?.pending ?? 0)}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-amber-200 text-amber-700 hover:bg-amber-50 flex items-center gap-1.5 transition-colors"
              title="Delete and cancel all pending email jobs"
            >
              <Trash2 size={14} />
              حذف قيد الانتظار ({stats?.pending})
            </button>
          )}

          {(stats?.total ?? 0) > 0 && (
            <button
              onClick={() => initiateDeleteByStatus("all", "جميع سجلات الإيميلات", stats?.total ?? 0)}
              className="px-3 py-2 text-xs font-medium rounded-xl border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 flex items-center gap-1.5 transition-colors ml-auto"
              title="Clear all email records"
            >
              <Trash2 size={14} />
              تفريغ كل السجلات
            </button>
          )}
        </div>
      </div>

      {/* Tabs: Jobs vs Campaigns */}
      <div className="flex border-b border-gray-200 mb-6 gap-6">
        <button
          onClick={() => setActiveTab("jobs")}
          className={`pb-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "jobs"
              ? "border-gdg-blue text-gdg-blue"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Mail size={16} />
          سجلات الإيميلات الفردية ({stats?.total ?? 0})
        </button>
        <button
          onClick={() => setActiveTab("campaigns")}
          className={`pb-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "campaigns"
              ? "border-gdg-blue text-gdg-blue"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Layers size={16} />
          حملات الإرسال ({campaigns.length})
        </button>
      </div>

      {activeTab === "campaigns" ? (
        /* Campaigns Table */
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gdg-navy text-sm">حملات الإرسال المنفذة</h3>
            <span className="text-xs text-gray-400">حذف الحملة يحذف سجلات البريد التابعة لها ويعيد تفعيل الحضور للمستقبل</span>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Campaign ID</th>
                  <th>Total Emails</th>
                  <th>Pending</th>
                  <th>Sent (Accepted/Delivered)</th>
                  <th>Failed</th>
                  <th>Last Updated</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-400">
                      <Layers size={32} className="mx-auto mb-2 opacity-30" />
                      لا توجد حملات مسجلة حالياً
                    </td>
                  </tr>
                ) : (
                  campaigns.map((camp) => (
                    <tr key={camp.campaignId}>
                      <td className="font-mono text-xs font-semibold text-gdg-navy">
                        {camp.campaignId}
                      </td>
                      <td className="text-sm font-semibold">{camp.total}</td>
                      <td>
                        <span className="badge-yellow text-xs">{camp.pending}</span>
                      </td>
                      <td>
                        <span className="badge-green text-xs">{camp.sent}</span>
                      </td>
                      <td>
                        <span className={camp.failed > 0 ? "badge-red text-xs" : "badge-gray text-xs"}>
                          {camp.failed}
                        </span>
                      </td>
                      <td className="text-xs text-gray-400">
                        {camp.lastUpdated ? new Date(camp.lastUpdated).toLocaleString() : "—"}
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => initiateDeleteCampaign(camp)}
                          className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg border border-red-200 flex items-center gap-1.5 ml-auto transition-colors"
                        >
                          <Trash2 size={13} />
                          حذف الحملة
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Email Jobs Table */
        <div>
          {/* Bulk Action Bar */}
          {selectedJobIds.length > 0 && (
            <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-3 animate-fade-in shadow-sm">
              <div className="flex items-center gap-2 text-sm text-red-900 font-medium">
                <span className="w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-bold">
                  {selectedJobIds.length}
                </span>
                <span>تم تحديد {selectedJobIds.length} من سجلات البريد</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedJobIds([])}
                  className="btn-secondary btn-sm"
                >
                  إلغاء التحديد
                </button>
                <button
                  onClick={initiateDeleteSelected}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Trash2 size={14} />
                  حذف المحدد ({selectedJobIds.length})
                </button>
              </div>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input pl-9"
                  placeholder="Search by name or email..."
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input w-40"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="delivered">Delivered</option>
                <option value="failed">Failed</option>
                <option value="bounced">Bounced</option>
                <option value="permanently_failed">Perm. Failed</option>
              </select>
            </div>

            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-10 text-center">
                      <input
                        type="checkbox"
                        checked={isAllCurrentSelected}
                        onChange={toggleSelectAllCurrent}
                        className="rounded border-gray-300 text-gdg-blue focus:ring-gdg-blue cursor-pointer"
                        title="Select all on this page"
                      />
                    </th>
                    <th>Recipient</th>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th>Message ID</th>
                    <th>Last Updated</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-400">Loading...</td>
                    </tr>
                  ) : jobs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-gray-400">
                        <Mail size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No email jobs found</p>
                        {stats?.total === 0 && (
                          <p className="text-xs mt-1">Queue emails to get started</p>
                        )}
                      </td>
                    </tr>
                  ) : (
                    jobs.map((job) => {
                      const isChecked = selectedJobIds.includes(job._id);
                      return (
                        <tr key={job._id} className={isChecked ? "bg-red-50/30" : ""}>
                          <td className="text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSelectRow(job._id)}
                              className="rounded border-gray-300 text-gdg-blue focus:ring-gdg-blue cursor-pointer"
                            />
                          </td>
                          <td>
                            <p className="font-medium text-gdg-navy" dir="auto">{job.recipientName}</p>
                            <p className="text-xs text-gray-400">{job.recipientEmail}</p>
                          </td>
                          <td>
                            <span className={STATUS_BADGE[job.status] ?? "badge-gray"}>{job.status}</span>
                            {job.lastError && (
                              <p className="text-xs text-red-500 mt-1 truncate max-w-[160px]" title={job.lastError}>
                                {job.lastError}
                              </p>
                            )}
                          </td>
                          <td className="text-sm text-gray-500">{job.attempts}</td>
                          <td className="font-mono text-xs text-gray-400 max-w-[100px] truncate">
                            {job.providerMessageId ?? "—"}
                          </td>
                          <td className="text-xs text-gray-400">
                            {new Date(job.updatedAt).toLocaleString()}
                          </td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {(job.status === "failed" || job.status === "bounced") && (
                                <button
                                  onClick={() => handleRetryJob(job._id)}
                                  className="btn-secondary btn-sm"
                                  title="Retry this email"
                                >
                                  <RotateCcw size={12} />
                                </button>
                              )}
                              <button
                                onClick={() => initiateDeleteJob(job)}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                                title="حذف هذا السجل"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
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
                ? "تأكيد حذف سجل البريد"
                : deleteTarget.type === "campaign"
                ? `تأكيد حذف الحملة (${deleteTarget.campaignId})`
                : deleteTarget.type === "status"
                ? `تأكيد حذف ${deleteTarget.statusLabel}`
                : `تأكيد حذف ${deleteTarget.count} من سجلات البريد`}
            </h3>

            {deleteTarget.type === "single" && deleteTarget.job && (
              <div className="bg-gray-50 p-3 rounded-xl mb-4 text-center">
                <p className="font-semibold text-gdg-navy" dir="auto">{deleteTarget.job.recipientName}</p>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{deleteTarget.job.recipientEmail}</p>
                <span className={`text-xs mt-1 inline-block ${STATUS_BADGE[deleteTarget.job.status] || "badge-gray"}`}>
                  {deleteTarget.job.status}
                </span>
              </div>
            )}

            <div className="text-sm text-gray-600 text-center mb-6 leading-relaxed">
              {deleteTarget.type === "campaign" ? (
                <p>
                  سيتم حذف جميع سجلات الإرسال في هذه الحملة ({deleteTarget.count} سجل) بالإضافة لجميع سجلات الأحداث المرتبطة بها.
                  <br />
                  <span className="text-blue-700 block mt-1 font-medium">
                    سيتم إعادة تعيين حالة الحضور إلى (غير مرسل) ليتمكن الأدمن من إرسال التذاكر لهم في حملة جديدة.
                  </span>
                </p>
              ) : (
                <p>
                  سيتم حذف سجلات الإرسال المحددة ({deleteTarget.count} سجل). إذا كانت هناك مهام قيد الانتظار سيتم إلغاؤها فوراً لمنع إرسالها.
                </p>
              )}
              <strong className="text-red-600 block mt-2">هذا الإجراء نهائي ولا يمكن التراجع عنه.</strong>
            </div>

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

      {/* Test Email Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-up border border-gray-100">
            <h3 className="text-lg font-bold text-gdg-navy mb-2 flex items-center gap-2">
              <Send size={18} className="text-gdg-blue" />
              Send Test Ticket Email
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Send a real sample ticket email to verify your Resend integration and view the ticket design in your inbox.
            </p>
            <form onSubmit={handleSendTestEmail} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Recipient Email
                </label>
                <input
                  type="email"
                  required
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="input w-full"
                  placeholder="e.g. mm1062686@gmail.com"
                />
                <p className="text-xs text-amber-700 mt-1">
                  ⚠️ Note: On the Resend free tier without a domain, you must use <strong>mm1062686@gmail.com</strong>.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={sendingTest}
                  onClick={() => setShowTestModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingTest}
                  className="btn-primary"
                >
                  {sendingTest ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                  Send Test Email
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
