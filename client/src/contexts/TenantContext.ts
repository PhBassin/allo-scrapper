export interface OrgInfo {
  id: string;
  slug: string;
  name: string;
  status: string;
}

export interface TenantContextType {
  org: OrgInfo | null;
  slug: string;
  isLoading: boolean;
  error: string | null;
}

import { createContext } from 'react';

export const TenantContext = createContext<TenantContextType>({
  org: null,
  slug: '',
  isLoading: false,
  error: null,
});
