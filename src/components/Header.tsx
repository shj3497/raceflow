import Link from 'next/link';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 h-16 bg-white border-b border-gray-200 flex items-center px-6">
      <Link href="/" className="text-xl font-bold text-gray-900">
        RaceFlow
      </Link>
    </header>
  );
}
