'use client';

import { UserButton, useAuth } from '@clerk/nextjs';
import Link from 'next/link';

export default function AuthButton() {
  const { isSignedIn } = useAuth();

  if (isSignedIn) {
    return (
      <UserButton
        afterSignOutUrl="/"
        appearance={{
          elements: {
            userButtonAvatarBox: 'size-8',
          },
        }}
      />
    );
  }

  return (
    <Link
      href="/sign-in"
      style={{
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--accent-human)',
        textDecoration: 'none',
        padding: '6px 12px',
        borderRadius: '8px',
        border: '1px solid var(--glass-border)',
      }}
    >
      Entrar
    </Link>
  );
}
