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
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNotFound(true);
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

  return (
    <TenantContext.Provider value={{ org, isLoading, notFound }}>
      {children}
    </TenantContext.Provider>
  );
};
