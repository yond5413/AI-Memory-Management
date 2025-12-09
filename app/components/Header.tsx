'use client';

import { useAuth } from './AuthProvider';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function Header() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/auth/login');
    router.refresh();
  };

  return (
    <header className="bg-background border-b border-border sticky top-0 z-50 backdrop-blur-sm bg-background/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-foreground rounded-lg flex items-center justify-center">
              <span className="text-background font-bold text-lg">M</span>
            </div>
            <Link href="/" className="text-lg font-bold text-foreground tracking-tight">
              AI Memory
            </Link>
          </div>

          <nav className="flex items-center gap-6">
            {loading ? (
              <div className="text-sm text-muted animate-pulse">Loading...</div>
            ) : user ? (
              <>
                <Link
                  href="/chat"
                  className="text-sm font-medium text-muted hover:text-foreground transition-colors"
                >
                  Chat
                </Link>
                <Link
                  href="/settings"
                  className="text-sm font-medium text-muted hover:text-foreground transition-colors"
                >
                  Settings
                </Link>
                <button
                  onClick={handleSignOut}
                  className="text-sm font-medium text-foreground hover:text-muted transition-colors"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="text-sm font-medium text-muted hover:text-foreground transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/signup"
                  className="text-sm font-medium text-background bg-foreground hover:opacity-90 px-4 py-2 rounded-lg transition-opacity"
                >
                  Sign Up
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}

