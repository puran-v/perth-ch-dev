// Author: Puran
// Impact: wrapped in ModuleGuard (Module A gate)
// Reason: only users whose org-role has moduleA should reach this page

import { ModuleGuard } from "@/components/auth/ModuleGuard";

export default function PricingPage() {
  return (
    <ModuleGuard module="A">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pricing &amp; Rules</h1>
        <p className="mt-2 text-gray-600">Configure pricing rules and strategies.</p>
      </div>
    </ModuleGuard>
  );
}
