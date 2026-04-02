import React, { useState, useEffect, type ReactNode } from 'react';
import { ConfigContext } from './ConfigContext';
import { getServerConfig, type ServerConfig } from '../api/system';

interface ConfigProviderProps {
  children: ReactNode;
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({ children }) => {
  const [config, setConfig] = useState<ServerConfig>({ saasEnabled: false });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getServerConfig()
      .then(setConfig)
      .catch(() => {
        // On error, fall back to standalone mode (safe default)
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <ConfigContext.Provider value={{ config, isLoading }}>
      {children}
    </ConfigContext.Provider>
  );
};
