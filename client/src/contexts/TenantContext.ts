import { createContext } from 'react';

export interface TenantOrg {
  id: number;
  slug: string;
  name: string;
  status: string;
}

export interface TenantContextType {
  org: TenantOrg | null;
  isLoading: boolean;
  notFound: boolean;
}

export const TenantContext = createContext<TenantContextType>({
  org: null,
  isLoading: true,
  notFound: false,
});
