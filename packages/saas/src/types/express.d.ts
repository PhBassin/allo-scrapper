import { Organization, PoolClient } from '../db/types.js';
import type { PermissionName } from 'allo-scrapper-server/dist/types/role.js';

declare global {
  namespace Express {
    interface Request {
      org?: Organization;
      dbClient?: PoolClient;
      user?: {
        id: number;
        username: string;
        role_name: string;
        is_system_role: boolean;
        permissions: PermissionName[];
        org_id?: number;
        org_slug?: string;
      };
    }
  }
}

declare module 'allo-scrapper-server/dist/middleware/auth.js' {
  export interface AuthRequest extends Express.Request {
    org?: Organization;
    dbClient?: PoolClient;
  }
}
