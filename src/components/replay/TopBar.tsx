'use client';

import Link from 'next/link';

export default function TopBar({ raceName }: { raceName: string }) {
  return (
    <div className="absolute top-0 left-0 right-0 z-40 h-14 flex items-center px-4 bg-gray-900/85 backdrop-blur-lg border-b border-white/[0.06]">
      <Link
        href="/"
        className="flex items-center justify-center w-9 h-9 rounded-full text-white hover:bg-white/10 transition-colors"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 4L7 10L13 16" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>

      <h1 className="flex-1 text-center text-base font-semibold text-white truncate px-4">
        {raceName}
      </h1>

      <div className="w-9 h-9" />
    </div>
  );
}
