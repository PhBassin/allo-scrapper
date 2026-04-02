import { createContext } from 'react';
import type { ServerConfig } from '../api/system';

export interface ConfigContextType {
  config: ServerConfig;
  isLoading: boolean;
}

// Safe defaults — standalone mode until the server responds
export const ConfigContext = createContext<ConfigContextType>({
  config: { saasEnabled: false },
  isLoading: true,
});
