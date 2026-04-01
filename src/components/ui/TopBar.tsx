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
  className = '',
}: TopBarProps) {
  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
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

      {/* Title row */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {onSearch && (
            <SearchInput
              placeholder={searchPlaceholder}
              onSearch={onSearch}
              className="w-64"
            />
          )}
          {actions}
          {notifications !== undefined && (
            <button
              className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Notifications"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              {notifications > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-4.5 h-4.5 px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
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
