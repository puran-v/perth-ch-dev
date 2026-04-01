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
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
