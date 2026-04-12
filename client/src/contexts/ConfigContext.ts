import { createContext, useContext } from 'react';

export interface ConfigContextType {
  saasEnabled: boolean;
  isLoading: boolean;
}

export const ConfigContext = createContext<ConfigContextType>({
  saasEnabled: false,
  isLoading: true,
});

export const useConfig = () => useContext(ConfigContext);
