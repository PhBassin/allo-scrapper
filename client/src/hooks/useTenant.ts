import { useContext } from 'react';
import { TenantContext, type TenantContextType } from '../contexts/TenantContext';

/**
 * Returns the current tenant (org) from TenantContext.
 * Must be used inside a TenantProvider.
 */
export function useTenant(): TenantContextType {
  return useContext(TenantContext);
}
