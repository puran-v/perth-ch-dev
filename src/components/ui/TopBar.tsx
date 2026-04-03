'use client';

import React from 'react';
import { SearchInput } from './SearchInput';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface TopBarProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  actions?: React.ReactNode;
  notifications?: number;
  showDateBar?: boolean;
  className?: string;
}



export function TopBar({
  title,
  subtitle,
  breadcrumbs,
  onSearch,
  searchPlaceholder = 'Search...',
  actions,
  notifications,
  showDateBar = false,
  className = '',
}: TopBarProps) {
  return (
    <div className={`flex flex-col ${className}`}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-sm mb-4" aria-label="Breadcrumb">
          {breadcrumbs.map((item, index) => (
            <React.Fragment key={index}>
              {index > 0 && (
                <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
              {item.href ? (
                <a
                  href={item.href}
                  className="text-slate-500 hover:text-[#042E93] transition-colors"
                >
                  {item.label}
                </a>
              ) : (
                <span className="text-slate-900 font-medium">{item.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Author: samir */}
      {/* Impact: title row wraps on mobile; search field is full-width on small screens */}
      {/* Reason: fixed layout broke on 320px with search and action buttons */}
      {/* Title row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-semibold text-slate-900">{title}</h1>
          {subtitle && (
            <p className="mt-0.5 text-xs sm:text-sm text-slate-500">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {onSearch && (
            <SearchInput
              placeholder={searchPlaceholder}
              onSearch={onSearch}
              className="w-full sm:w-64"
            />
          )}
          {actions}
          {/* Only show bell here if date bar is NOT shown (avoid duplicate) */}
          {!showDateBar && notifications !== undefined && (
            <button
              className="relative flex items-center justify-center w-9 h-9 rounded-full border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-colors shrink-0"
              aria-label="Notifications"
            >
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              {notifications > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-4.5 h-4.5 px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
                  {notifications}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
