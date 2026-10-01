import React, { useState, useEffect, useRef } from 'react';
import { AuthGate } from './components/AuthGate.tsx';
import { SearchScreen } from './components/SearchScreen.tsx';
import { Flipbook } from './components/Flipbook.tsx';
import { ShareModal } from './components/ShareModal.tsx';
import { AuthSession, CompetitorSearchResult } from './types.ts';

export default function App() {
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [isVerifyingAuth, setIsVerifyingAuth] = useState(true);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<CompetitorSearchResult | null>(null);

  // In-flight abort controller for duplicate request protection
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize auth from URL param (?access_key=...) or localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessKey = params.get('access_key');

    const checkInitialAuth = async () => {
      // 1. If access key in URL
      if (accessKey) {
        try {
          const res = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessPass: accessKey }),
          });
          const data = await res.json();
          if (res.ok && data.authorized) {
            const session: AuthSession = {
              isAuthenticated: true,
              email: data.user.email,
              accessPass: accessKey,
              role: data.user.role || 'guest',
              authenticatedAt: new Date().toISOString(),
            };
            localStorage.setItem('competitor_intel_auth', JSON.stringify(session));
            setAuthSession(session);
            setIsVerifyingAuth(false);
            return;
          }
        } catch (e) {
          console.warn('URL auth verification error:', e);
        }
      }

      // 2. Check localStorage
      try {
        const stored = localStorage.getItem('competitor_intel_auth');
        if (stored) {
          const parsed: AuthSession = JSON.parse(stored);
          if (parsed && parsed.isAuthenticated) {
            setAuthSession(parsed);
            setIsVerifyingAuth(false);
            return;
          }
        }
      } catch (e) {
        console.warn('Local auth parse error:', e);
      }

      setIsVerifyingAuth(false);
    };

    checkInitialAuth();
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('competitor_intel_auth');
    setAuthSession(null);
    setSearchResult(null);
    setSearchError(null);
    // remove query param without reload
    const url = new URL(window.location.href);
    url.searchParams.delete('access_key');
    window.history.replaceState({}, '', url.toString());
  };

  const handleSearch = async (industry: string, location: string, radiusMiles: number) => {
    // Duplicate-request protection: abort previous in-flight request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setSearchError(null);

    // Prepare auth headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authSession?.email) {
      headers['Authorization'] = `Bearer ${authSession.email}`;
    }
    if (authSession?.accessPass) {
      headers['x-access-key'] = authSession.accessPass;
    }

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers,
        body: JSON.stringify({ industry, location, radiusMiles }),
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to search competitors.');
      }

      setSearchResult(data);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return; // Request was aborted by user or duplicate search
      }
      console.warn('Search request failed:', err);
      setSearchError(
        err.message || 'An error occurred while researching competitors. Please verify your inputs and try again.',
      );
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  if (isVerifyingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs">Verifying Access...</span>
        </div>
      </div>
    );
  }

  // If not authenticated, require sign-in
  if (!authSession || !authSession.isAuthenticated) {
    return <AuthGate onAuthenticated={(session) => setAuthSession(session)} />;
  }

  return (
    <>
      {/* Show results in interactive flipbook only after searching */}
      {searchResult ? (
        <Flipbook
          searchResult={searchResult}
          onBackToSearch={() => setSearchResult(null)}
          onOpenShare={() => setIsShareModalOpen(true)}
        />
      ) : (
        /* Simple, centered opening screen */
        <SearchScreen
          onSearch={handleSearch}
          isLoading={isLoading}
          error={searchError}
          authSession={authSession}
          onOpenShare={() => setIsShareModalOpen(true)}
          onSignOut={handleSignOut}
        />
      )}

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        currentUserEmail={authSession.email}
      />
    </>
  );
}
