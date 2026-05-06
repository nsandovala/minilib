'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/notes', label: 'Notas', icon: '📝' },
  { href: '/todos', label: 'Tareas', icon: '✅' },
  { href: '/meds', label: 'Medicamentos', icon: '💊' },
  { href: '/appointments', label: 'Citas', icon: '📅' },
  { href: '/drawings', label: 'Dibujos', icon: '✏️' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-700 bg-slate-900">
      <ul className="flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`tap-target flex flex-col items-center justify-center py-3 text-xs ${
                  isActive
                    ? 'text-sky-400 font-semibold'
                    : 'text-slate-400'
                }`}
              >
                <span className="text-xl mb-1">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
