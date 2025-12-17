import { useState, useEffect } from 'react';
import { AppConfig } from '../types';

const DEFAULT_CONFIG: AppConfig = {
  appName: "Facial recognition test",
  appVersion: "v2.3",
  logoText: "SIU",
  logoColor: "cyan",
  defaultLang: "zh",
  copyrightText: "© 2025 68344042-4. All Rights Reserved."
};

export const useConfig = () => {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/config.json')
      .then(res => {
        if (!res.ok) throw new Error("Failed to load config");
        return res.json();
      })
      .then(data => {
        setConfig(prev => ({ ...prev, ...data }));
        setLoaded(true);
        // Update document title dynamically
        document.title = data.appName || document.title;
      })
      .catch(err => {
        console.warn("Config load failed, using defaults", err);
        setLoaded(true);
      });
  }, []);

  return { config, loaded };
};