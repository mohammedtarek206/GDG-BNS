"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  QrCode,
  Mail,
  BarChart2,
  Settings,
  ScanLine,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Shield,
  FileSpreadsheet,
  UserCheck,
} from "lucide-react";
import toast from "react-hot-toast";

const ALL_NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard", labelAr: "لوحة التحكم", icon: LayoutDashboard, adminOnly: true },
  { href: "/admin/checkin", label: "Check-in Scanner", labelAr: "الفحص", icon: ScanLine, adminOnly: false },
  { href: "/admin/attendees", label: "Attendees", labelAr: "المشاركون", icon: Users, adminOnly: false },
  { href: "/admin/tickets", label: "QR Tickets", labelAr: "التذاكر", icon: QrCode, adminOnly: false },
  { href: "/admin/import", label: "Import Attendees", labelAr: "استيراد الحضور", icon: FileSpreadsheet, adminOnly: true },
  { href: "/admin/emails", label: "Email Manager", labelAr: "إدارة البريد", icon: Mail, adminOnly: true },
  { href: "/admin/reports", label: "Reports", labelAr: "التقارير", icon: BarChart2, adminOnly: true },
  { href: "/admin/staff", label: "Staff", labelAr: "الفريق", icon: Shield, adminOnly: true },
  { href: "/admin/settings", label: "Event Settings", labelAr: "إعدادات الحدث", icon: Settings, adminOnly: true },
];

interface SidebarProps {
  locale?: "en" | "ar";
  role?: "admin" | "staff";
  userName?: string;
}

export function AdminSidebar({ locale = "en", role = "admin", userName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const navItems = ALL_NAV_ITEMS.filter((item) => {
    if (role === "staff") {
      return !item.adminOnly;
    }
    return true;
  });

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/admin/login");
      router.refresh();
    } catch {
      toast.error("Logout failed");
    } finally {
      setIsLoggingOut(false);
    }
  }

  const isRtl = locale === "ar";

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-white shadow-md border border-gray-100 lg:hidden"
      >
        <Menu size={20} className="text-gdg-navy" />
      </button>

      {/* Sidebar */}
      <aside
        dir={isRtl ? "rtl" : "ltr"}
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col bg-gdg-navy text-white
          transition-all duration-300 ease-in-out
          ${collapsed ? "w-[72px]" : "w-64"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Logo Area */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden bg-white/10">
            <span className="text-sm font-bold text-gdg-blue">GDG</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">GDG Event</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${role === "admin" ? "bg-blue-400" : "bg-emerald-400"}`} />
                <p className="text-xs text-white/70 capitalize truncate">
                  {role === "staff" ? "Staff Portal" : "Admin Panel"}
                </p>
              </div>
            </div>
          )}
          <button
            onClick={() => { setCollapsed(!collapsed); setMobileOpen(false); }}
            className="ml-auto p-1.5 rounded-lg hover:bg-white/10 transition-colors hidden lg:block flex-shrink-0"
          >
            <ChevronRight
              size={16}
              className={`text-white/60 transition-transform duration-300 ${collapsed ? "" : "rotate-180"}`}
            />
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto p-1.5 rounded-lg hover:bg-white/10 transition-colors lg:hidden flex-shrink-0"
          >
            <X size={16} className="text-white/60" />
          </button>
        </div>

        {/* User Badge if available */}
        {!collapsed && userName && (
          <div className="px-4 py-3 mx-3 my-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gdg-blue/20 text-gdg-blue flex items-center justify-center font-bold text-xs flex-shrink-0">
              <UserCheck size={14} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{userName}</p>
              <p className="text-[10px] text-white/50 uppercase tracking-wider">{role}</p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          <ul className="space-y-1">
            {navItems.map(({ href, label, labelAr, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + "/");
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    title={collapsed ? (isRtl ? labelAr : label) : undefined}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group
                      ${isActive
                        ? "bg-gdg-blue text-white shadow-lg shadow-blue-500/20"
                        : "text-white/60 hover:text-white hover:bg-white/10"
                      }
                    `}
                  >
                    <Icon size={18} className="flex-shrink-0" />
                    {!collapsed && (
                      <span className="text-sm font-medium truncate">
                        {isRtl ? labelAr : label}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            title={collapsed ? "Logout" : undefined}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
              text-white/60 hover:text-white hover:bg-red-500/20 transition-all duration-150
              disabled:opacity-50
            `}
          >
            <LogOut size={18} className="flex-shrink-0" />
            {!collapsed && (
              <span className="text-sm font-medium">
                {isRtl ? "تسجيل الخروج" : "Logout"}
              </span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
