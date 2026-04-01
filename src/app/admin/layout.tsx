import AdminSidebar, {
  defaultNavSections,
  defaultComingSoon,
  defaultTenant,
  defaultUser,
} from "@/components/admin/AdminSidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar
        tenant={defaultTenant}
        user={defaultUser}
        navSections={defaultNavSections}
        comingSoon={defaultComingSoon}
      />
      <main className="flex-1 overflow-y-auto content-scrollbar bg-[#F8FAFC]">
        <div className="max-w-[1512px] mx-auto px-8 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
