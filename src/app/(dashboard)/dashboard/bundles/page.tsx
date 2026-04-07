// Author: Puran
// Impact: wrapped in ModuleGuard (Module A gate)
// Reason: only users whose org-role has moduleA should reach this page

import { ModuleGuard } from "@/components/auth/ModuleGuard";

export default function BundlesPage() {
  return (
    <ModuleGuard module="A">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bundles &amp; Packages</h1>
        <p className="mt-2 text-gray-600">Create and manage product bundles.</p>
      </div>
    </ModuleGuard>
  );
}
