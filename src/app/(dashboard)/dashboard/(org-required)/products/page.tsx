// Author: Puran
// Impact: wrapped page body in ModuleGuard so non-module-A users see a
//         friendly "no access" screen instead of the stub content
// Reason: frontend gate that mirrors the backend requireModule check

import { ModuleGuard } from "@/components/auth/ModuleGuard";

export default function ProductsPage() {
  return (
    <ModuleGuard module="A">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <p className="mt-2 text-gray-600">Manage your product catalog.</p>
      </div>
    </ModuleGuard>
  );
}
