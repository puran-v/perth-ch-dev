import Link from "next/link";
import Image from "next/image";
import logo from "@/assets/logo.png";

// dev (jay): landing splash — only entry point, redirects admin to /login
export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="flex flex-col items-center gap-8 text-center">
        {/* dev (jay): priority=true — LCP image, preloaded to avoid score penalty */}
        <Image
          src={logo}
          alt="The Fun Depot"
          width={240}
          height={100}
          className="object-contain"
          priority
        />
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-3xl font-bold text-gray-900">Welcome to The Fun Depot</h1>
          <p className="text-gray-500 text-base">Admin portal — please log in to continue.</p>
        </div>
        {/* dev (jay): Link styled as button — avoids client-side JS for a simple nav action */}
        <Link
          href="/login"
          className="inline-flex items-center justify-center h-13 px-10 rounded-full bg-[#1a2f6e] text-white text-base font-medium hover:bg-[#15255a] active:bg-[#111e4a] transition-colors"
        >
          Log In
        </Link>
      </div>
    </div>
  );
}
