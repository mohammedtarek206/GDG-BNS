"use client";
import { useState, useEffect } from "react";
import { Settings, Save, RefreshCw, Calendar, MapPin, Mail, Globe, Share2, Info } from "lucide-react";
import toast from "react-hot-toast";

interface EventSettingsData {
  eventName: string;
  eventNameAr: string;
  description: string;
  descriptionAr: string;
  date?: string;
  endDate?: string;
  venue: string;
  venueAr: string;
  logoUrl?: string;
  bannerUrl?: string;
  supportEmail: string;
  supportPhone?: string;
  websiteUrl?: string;
  timezone: string;
  language: "en" | "ar" | "both";
  socialLinks?: {
    twitter?: string;
    linkedin?: string;
    instagram?: string;
    youtube?: string;
  };
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EventSettingsData>({
    eventName: "",
    eventNameAr: "",
    description: "",
    descriptionAr: "",
    date: "",
    endDate: "",
    venue: "",
    venueAr: "",
    logoUrl: "",
    bannerUrl: "",
    supportEmail: "",
    supportPhone: "",
    websiteUrl: "",
    timezone: "Africa/Cairo",
    language: "both",
    socialLinks: { twitter: "", linkedin: "", instagram: "", youtube: "" },
  });

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          const s = data.settings;
          setForm({
            eventName: s.eventName ?? "",
            eventNameAr: s.eventNameAr ?? "",
            description: s.description ?? "",
            descriptionAr: s.descriptionAr ?? "",
            date: s.date ? new Date(s.date).toISOString().slice(0, 16) : "",
            endDate: s.endDate ? new Date(s.endDate).toISOString().slice(0, 16) : "",
            venue: s.venue ?? "",
            venueAr: s.venueAr ?? "",
            logoUrl: s.logoUrl ?? "",
            bannerUrl: s.bannerUrl ?? "",
            supportEmail: s.supportEmail ?? "",
            supportPhone: s.supportPhone ?? "",
            websiteUrl: s.websiteUrl ?? "",
            timezone: s.timezone ?? "Africa/Cairo",
            language: s.language ?? "both",
            socialLinks: {
              twitter: s.socialLinks?.twitter ?? "",
              linkedin: s.socialLinks?.linkedin ?? "",
              instagram: s.socialLinks?.instagram ?? "",
              youtube: s.socialLinks?.youtube ?? "",
            },
          });
        }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSettings();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        toast.success("Settings saved successfully!");
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save settings");
      }
    } catch {
      toast.error("Network error saving settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw size={32} className="animate-spin text-gdg-blue opacity-50" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Settings size={24} className="text-gdg-blue" />
            Event Settings
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure event identity, dates, venue, and communication details
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="card p-6">
          <h2 className="section-title flex items-center gap-2">
            <Info size={18} className="text-gdg-blue" />
            Event Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Event Name (English) *</label>
              <input
                className="input"
                value={form.eventName}
                onChange={(e) => setForm({ ...form, eventName: e.target.value })}
                placeholder="e.g. GDG DevFest 2024"
                required
              />
            </div>
            <div>
              <label className="label">Event Name (Arabic) *</label>
              <input
                className="input text-right"
                dir="rtl"
                value={form.eventNameAr}
                onChange={(e) => setForm({ ...form, eventNameAr: e.target.value })}
                placeholder="مثال: ديف فيست مجتمع مطوري جوجل 2024"
                required
              />
            </div>
            <div>
              <label className="label">Description (English)</label>
              <textarea
                className="input h-24 resize-none"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief summary of the event..."
              />
            </div>
            <div>
              <label className="label">Description (Arabic)</label>
              <textarea
                className="input h-24 resize-none text-right"
                dir="rtl"
                value={form.descriptionAr}
                onChange={(e) => setForm({ ...form, descriptionAr: e.target.value })}
                placeholder="نبذة عن الحدث..."
              />
            </div>
          </div>
        </div>

        {/* Date & Location */}
        <div className="card p-6">
          <h2 className="section-title flex items-center gap-2">
            <Calendar size={18} className="text-gdg-green" />
            Date & Venue
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Event Start Date & Time</label>
              <input
                type="datetime-local"
                className="input"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Event End Date & Time</label>
              <input
                type="datetime-local"
                className="input"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Venue Name (English) *</label>
              <input
                className="input"
                value={form.venue}
                onChange={(e) => setForm({ ...form, venue: e.target.value })}
                placeholder="e.g. Cairo International Convention Centre"
                required
              />
            </div>
            <div>
              <label className="label">Venue Name (Arabic) *</label>
              <input
                className="input text-right"
                dir="rtl"
                value={form.venueAr}
                onChange={(e) => setForm({ ...form, venueAr: e.target.value })}
                placeholder="مثال: مركز القاهرة الدولي للمؤتمرات"
                required
              />
            </div>
            <div>
              <label className="label">Timezone</label>
              <input
                className="input"
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                placeholder="e.g. Africa/Cairo"
              />
            </div>
            <div>
              <label className="label">Display Language</label>
              <select
                className="input"
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value as "en" | "ar" | "both" })}
              >
                <option value="both">Both (Arabic & English)</option>
                <option value="en">English Only</option>
                <option value="ar">Arabic Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Contact & Branding */}
        <div className="card p-6">
          <h2 className="section-title flex items-center gap-2">
            <Mail size={18} className="text-gdg-red" />
            Contact & Branding
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Support Email *</label>
              <input
                type="email"
                className="input"
                value={form.supportEmail}
                onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
                placeholder="support@gdg.community"
                required
              />
            </div>
            <div>
              <label className="label">Support Phone</label>
              <input
                className="input"
                value={form.supportPhone}
                onChange={(e) => setForm({ ...form, supportPhone: e.target.value })}
                placeholder="+20 123 456 7890"
              />
            </div>
            <div>
              <label className="label">Website URL</label>
              <input
                type="url"
                className="input"
                value={form.websiteUrl}
                onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
                placeholder="https://gdg.community.dev"
              />
            </div>
            <div>
              <label className="label">Logo Image URL</label>
              <input
                type="url"
                className="input"
                value={form.logoUrl}
                onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                placeholder="https://example.com/logo.png"
              />
            </div>
          </div>
        </div>

        {/* Social Links */}
        <div className="card p-6">
          <h2 className="section-title flex items-center gap-2">
            <Share2 size={18} className="text-purple-600" />
            Social Media Links
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Twitter / X</label>
              <input
                className="input"
                value={form.socialLinks?.twitter}
                onChange={(e) =>
                  setForm({ ...form, socialLinks: { ...form.socialLinks, twitter: e.target.value } })
                }
                placeholder="https://x.com/GDG..."
              />
            </div>
            <div>
              <label className="label">LinkedIn</label>
              <input
                className="input"
                value={form.socialLinks?.linkedin}
                onChange={(e) =>
                  setForm({ ...form, socialLinks: { ...form.socialLinks, linkedin: e.target.value } })
                }
                placeholder="https://linkedin.com/company/..."
              />
            </div>
            <div>
              <label className="label">Instagram</label>
              <input
                className="input"
                value={form.socialLinks?.instagram}
                onChange={(e) =>
                  setForm({ ...form, socialLinks: { ...form.socialLinks, instagram: e.target.value } })
                }
                placeholder="https://instagram.com/..."
              />
            </div>
            <div>
              <label className="label">YouTube</label>
              <input
                className="input"
                value={form.socialLinks?.youtube}
                onChange={(e) =>
                  setForm({ ...form, socialLinks: { ...form.socialLinks, youtube: e.target.value } })
                }
                placeholder="https://youtube.com/@..."
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={fetchSettings} disabled={saving} className="btn-secondary">
            Discard Changes
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}
