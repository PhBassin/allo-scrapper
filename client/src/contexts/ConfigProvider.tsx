import React, { useState, useEffect, type ReactNode } from 'react';
import { ConfigContext } from './ConfigContext';
import { getConfig } from '../api/saas';

interface ConfigProviderProps {
  children: ReactNode;
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({ children }) => {
  const [saasEnabled, setSaasEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getConfig()
      .then((cfg) => {
        setSaasEnabled(cfg.saasEnabled);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load config:', err);
        setError('Failed to load application configuration');
        setIsLoading(false);
      });
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Configuration Error</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <ConfigContext.Provider value={{ saasEnabled, isLoading }}>
      {children}
    </ConfigContext.Provider>
  );
};
