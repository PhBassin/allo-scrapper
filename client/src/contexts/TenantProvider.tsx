import { useState, useEffect, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { TenantContext, type OrgInfo } from './TenantContext';
import { getOrgInfo } from '../api/saas';

interface TenantProviderProps {
  children: ReactNode;
}

export function TenantProvider({ children }: TenantProviderProps) {
  const { slug = '' } = useParams<{ slug: string }>();
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setIsLoading(true);
    setError(null);
    getOrgInfo(slug)
      .then(setOrg)
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [slug]);

  return (
    <TenantContext.Provider value={{ org, slug, isLoading, error }}>
      {children}
    </TenantContext.Provider>
  );
}
