import { AdminSidebar } from "@/components/AdminSidebar";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== "admin") {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <AdminSidebar />
      {/* Main content – offset by sidebar width */}
      <main className="flex-1 min-w-0 lg:ml-64 transition-all duration-300">
        <div className="p-4 sm:p-6 lg:p-8 min-h-screen">{children}</div>
      </main>
    </div>
  );
}
