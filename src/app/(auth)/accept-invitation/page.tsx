import Image from "next/image";
import { Suspense } from "react";
import AcceptInvitationForm from "@/components/auth/AcceptInvitationForm";

const logo = "/assets/logo.png";

export const metadata = {
  title: "Accept Invitation — The Fun Depot",
};

// Author: Puran
// Impact: new page for the invitation acceptance flow
// Reason: closes the invite → mail → accept loop for Team & Users V1

/**
 * Accept invitation page — user lands here from the email link.
 * Uses the same split-panel auth layout as login/signup/reset-password
 * for visual continuity across the whole auth flow.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Auth - Accept Invitation
 */
export default function AcceptInvitationPage() {
  return (
    <main className="main-container min-h-screen py-5 flex flex-col md:flex-row">
      {/* Left panel — brand */}
      <div className="hidden rounded-4xl md:flex md:w-[46%] bg-[#1a2f6e] flex-col items-center justify-center gap-6 p-10">
        <Image
          src={logo}
          alt="The Fun Depot"
          width={325}
          height={136}
          className="object-contain"
          priority
        />
        <p className="text-white text-lg font-semibold tracking-wide">
          Join your team
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col min-h-screen md:min-h-0">
        {/* Mobile-only logo header */}
        <div className="flex md:hidden items-center justify-center bg-[#1a2f6e] py-8 px-6">
          <Image
            src={logo}
            alt="The Fun Depot"
            width={160}
            height={72}
            className="object-contain"
            priority
          />
        </div>

        <div className="flex flex-1 items-center justify-center p-6 sm:p-10 bg-white">
          <div className="w-full">
            {/* Suspense required — AcceptInvitationForm uses useSearchParams */}
            <Suspense>
              <AcceptInvitationForm />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  );
}
