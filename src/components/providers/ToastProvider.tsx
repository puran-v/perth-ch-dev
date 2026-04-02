"use client";

/**
 * Global toast notification provider using react-toastify.
 *
 * Mounted once in the root layout. All components can trigger toasts
 * via `import { toast } from "react-toastify"` without additional setup.
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Toast Notifications
 */

// Author: samir
// Impact: new global toast provider for success/error/info notifications
// Reason: PROJECT_RULES.md §8.3 requires success/error toast notifications after every action

import { ToastContainer } from "react-toastify";

/**
 * Renders the ToastContainer with project-standard positioning and timing.
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Toast Notifications
 */
export function ToastProvider() {
  return (
    <ToastContainer
      position="top-right"
      autoClose={4000}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="light"
    />
  );
}
