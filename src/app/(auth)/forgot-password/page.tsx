import Image from "next/image";
const logo = "/assets/logo.png";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export const metadata = {
  title: "Forgot Password — The Fun Depot",
};

// dev (jay): page shell for reset flow step 1 — same layout as login/signup for visual continuity
export default function ForgotPasswordPage() {
  return (
    <main className="main-container min-h-screen py-5 flex flex-col md:flex-row">
      {/* Left panel */}
      <div className="hidden rounded-4xl md:flex md:w-[46%] bg-[#1a2f6e] flex-col items-center justify-center gap-6 p-10">
        <Image
          src={logo}
          alt="The Fun Depot"
          width={325}
          height={136}
          className="object-contain"
          style={{ height: 'auto' }}
          priority
        />
        <p className="text-white text-lg font-semibold tracking-wide">
          All Dashboard Access
        </p>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 flex-col min-h-screen md:min-h-0">
        {/* Mobile-only logo header */}
        <div className="flex md:hidden items-center justify-center bg-[#1a2f6e] py-8 px-6">
          <Image
            src={logo}
            alt="The Fun Depot"
            width={160}
            height={72}
            className="object-contain"
            style={{ height: 'auto' }}
            priority
          />
        </div>

        {/* Form area */}
        <div className="flex flex-1 items-center justify-center p-6 sm:p-10 bg-white">
          <div className="w-full">
            <ForgotPasswordForm />
          </div>
        </div>
      </div>
    </main>
  );
}
