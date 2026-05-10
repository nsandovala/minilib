'use client';

import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <p
        style={{
          fontSize: '12px',
          color: 'var(--text-muted)',
          marginBottom: '24px',
          fontWeight: 400,
        }}
      >
        Una libreta tranquila para lo cotidiano
      </p>
      <SignUp
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'bg-[var(--card-bg)] border border-[var(--glass-border)] shadow-lg',
            headerTitle: 'text-[var(--text-primary)]',
            headerSubtitle: 'text-[var(--text-muted)]',
            socialButtonsBlockButton:
              'border border-[var(--glass-border)] text-[var(--text-primary)] hover:bg-[var(--glass-border)]',
            formFieldLabel: 'text-[var(--text-muted)]',
            formFieldInput:
              'bg-[var(--input-bg)] border border-[var(--glass-border)] text-[var(--text-primary)]',
            formButtonPrimary: 'bg-[var(--accent-human)] hover:opacity-90',
            footerActionLink: 'text-[var(--accent-human)]',
            dividerLine: 'bg-[var(--glass-border)]',
            dividerText: 'text-[var(--text-muted)]',
          },
        }}
        routing="path"
        path="/sign-up"
        forceRedirectUrl="/"
      />
    </div>
  );
}
