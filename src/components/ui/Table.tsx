'use client';

import React from 'react';

// Types
export interface TableColumn<T> {
  key: string;
  header: string;
  render?: (row: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  sortable?: boolean;
  width?: string;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string;
  emptyMessage?: string;
  className?: string;
  onRowClick?: (row: T, index: number) => void;
  isLoading?: boolean;
  striped?: boolean;
  hoverable?: boolean;
}

// Skeleton row for loading state
function SkeletonRow({ colCount }: { colCount: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: colCount }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <div className="h-4 bg-slate-200 rounded w-3/4" />
        </td>
      ))}
    </tr>
  );
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'No data available',
  className = '',
  onRowClick,
  isLoading = false,
  striped = false,
  hoverable = true,
}: TableProps<T>) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-slate-200 font-medium">
            {columns.map((col) => (
              <th
                key={col.key}
                className={[
                  'px-6 py-3 text-xs font-medium text-black uppercase tracking-wider whitespace-nowrap',
                  col.headerClassName || '',
                  col.width || '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} colCount={columns.length} />
            ))
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-6 py-12 text-center text-slate-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr
                key={keyExtractor(row, index)}
                className={[
                  'font-normal',
                  striped && index % 2 === 1 ? 'bg-slate-50' : '',
                  hoverable ? 'hover:bg-slate-50 transition-colors' : '',
                  onRowClick ? 'cursor-pointer' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onRowClick?.(row, index)}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={[
                      'px-6 py-4 text-sm text-slate-600',
                      col.className || '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {col.render
                      ? col.render(row, index)
                      : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
