import React, { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { TenantContext } from './TenantContext';
import { pingOrg } from '../api/saas';

interface TenantProviderProps {
  children: ReactNode;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

function NotFoundScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">404</h1>
        <p className="text-gray-600">Organization not found.</p>
      </div>
    </div>
  );
}

function ForbiddenScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-red-800 mb-4">403</h1>
        <p className="text-red-600" data-testid="403-error-message">{message}</p>
      </div>
    </div>
  );
}

/**
 * TenantProvider
 *
 * Wraps routes that live under /org/:slug/*.
 * On mount, pings the backend to confirm the org exists, then stores the
 * org metadata in TenantContext for child components to consume via useTenant().
 */
export const TenantProvider: React.FC<TenantProviderProps> = ({ children }) => {
  const { slug } = useParams<{ slug: string }>();
  const [org, setOrg] = useState<{ id: number; slug: string; name: string; status: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [forbiddenMessage, setForbiddenMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    pingOrg(slug)
      .then((result) => {
        if (!cancelled) {
          setOrg(result.org);
          setNotFound(false);
          setForbiddenMessage(null);
          setIsLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const responseStatus = typeof error === 'object' && error !== null && 'response' in error
            ? (error as { response?: { status?: number; data?: { error?: string } } }).response?.status
            : undefined;
          const responseMessage = typeof error === 'object' && error !== null && 'response' in error
            ? (error as { response?: { status?: number; data?: { error?: string } } }).response?.data?.error
            : undefined;
          const message = error instanceof Error ? error.message : 'Organization not found';

          if (responseStatus === 403 || /organization mismatch|cross-tenant access denied/i.test(responseMessage ?? message)) {
            setForbiddenMessage(responseMessage ?? message);
            setNotFound(false);
          } else {
            setNotFound(true);
            setForbiddenMessage(null);
          }

          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (notFound) {
    return <NotFoundScreen />;
  }

  if (forbiddenMessage) {
    return <ForbiddenScreen message={forbiddenMessage} />;
  }

  return (
    <TenantContext.Provider value={{ org, isLoading, notFound }}>
      {children}
    </TenantContext.Provider>
  );
};
