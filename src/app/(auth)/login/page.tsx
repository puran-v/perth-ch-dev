import Image from "next/image";
import { Suspense } from "react";
const logo = "/assets/logo.png";
import LoginForm from "@/components/auth/LoginForm";

export const metadata = {
  title: "Log In — The Fun Depot",
};

// dev (jay): two-column layout — branded left panel on md+, stacked logo+form on mobile
export default function LoginPage() {
  return (
    <main className=" min-h-screen py-5 flex flex-col md:flex-row">
      {/* Left panel — hidden on mobile, shown md+ */}
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
          All Dashboard Access
        </p>
      </div>

      {/* Right panel — full screen on mobile, right half on md+ */}
      <div className="flex flex-1 flex-col min-h-screen md:min-h-0">
        {/* Mobile-only logo header — replaces left panel on small screens */}
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

        {/* Form area — fills remaining height */}
        <div className="flex flex-1 items-center justify-center p-6 sm:p-10 bg-white">
          {/* dev (jay): w-full lets LoginForm control its own max-width */}
          <div className="w-full">
            {/* Suspense required — LoginForm uses useSearchParams for OAuth error params */}
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  );
}
