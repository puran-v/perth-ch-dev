"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";

const logo = "/assets/logo.png";

// Old Author: jay
// New Author: samir
// Impact: added logout button when user is authenticated
// Reason: user should be able to log out from the home page
export default function Home() {
  const { isAuthenticated, isLoading, logout } = useAuth();

  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="flex flex-col items-center gap-8 text-center">
        <Image
          src={logo}
          alt="The Fun Depot"
          width={240}
          height={100}
          className="object-contain"
          style={{ height: 'auto' }}
          priority
        />
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-3xl font-bold text-gray-900">Welcome to The Fun Depot</h1>
          <p className="text-gray-500 text-base">
            {isAuthenticated
              ? "You are logged in."
              : "Dashboard portal — please log in to continue."}
          </p>
        </div>
        {!isLoading && (
          isAuthenticated ? (
            <button
              onClick={logout}
              className="inline-flex items-center justify-center h-13 px-10 rounded-full bg-[#1a2f6e] text-white text-base font-medium hover:bg-[#15255a] active:bg-[#111e4a] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a2f6e]/40"
              aria-label="Log Out"
            >
              Log Out
            </button>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center justify-center h-13 px-10 rounded-full bg-[#1a2f6e] text-white text-base font-medium hover:bg-[#15255a] active:bg-[#111e4a] transition-colors"
            >
              Log In
            </Link>
          )
        )}
      </div>
    </div>
  );
}
