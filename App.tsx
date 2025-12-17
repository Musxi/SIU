import React, { useState, useEffect } from 'react';
import { AppMode } from './types';
import { useFaceSystem } from './hooks/useFaceSystem';
import { useConfig } from './hooks/useConfig';
import { translations, Language } from './utils/i18n';
import LiveMonitor from './components/LiveMonitor';
import AdminDashboard from './components/AdminDashboard';

const App: React.FC = () => {
  // Load Global Config
  const { config, loaded } = useConfig();
  
  // UI State
  const [activeTab, setActiveTab] = useState<AppMode>(AppMode.MONITOR);
  const [lang, setLang] = useState<Language>('zh'); 

  // Apply default language from config once loaded
  useEffect(() => {
    if (loaded && config.defaultLang) {
      setLang(config.defaultLang);
    }
  }, [loaded, config.defaultLang]);

  const { 
    profiles, 
    logs, 
    threshold, // From Hook
    setThreshold, // From Hook
    addProfile, 
    deleteProfile, 
    addSampleToProfile, 
    removeSampleFromProfile, 
    addLog 
  } = useFaceSystem();

  const t = translations[lang];

  // Helper for dynamic colors
  const getLogoColorClass = (color: string) => {
    switch(color) {
      case 'purple': return 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.6)]';
      case 'green': return 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]';
      case 'blue': return 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)]';
      case 'red': return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]';
      default: return 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.6)]';
    }
  };
  
  const getTextColorClass = (color: string) => {
     switch(color) {
      case 'purple': return 'text-purple-500';
      case 'green': return 'text-green-500';
      case 'blue': return 'text-blue-500';
      case 'red': return 'text-red-500';
      default: return 'text-cyan-500';
    }
  };

  if (!loaded) return <div className="h-screen bg-gray-900 flex items-center justify-center text-gray-500">Loading Configuration...</div>;

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col font-sans overflow-hidden">
      
      {/* Top Navigation Bar / 顶部导航栏 */}
      <header className="bg-black border-b border-gray-800 h-14 flex items-center justify-between px-4 shrink-0 z-50">
        
        {/* Branding / 品牌标识 (Dynamic from Config) */}
        <div className="flex items-center gap-2">
          <div className={`w-8 h-6 rounded-sm flex items-center justify-center font-bold text-black text-[10px] ${getLogoColorClass(config.logoColor)}`}>
            {config.logoText}
          </div>
          <h1 className="text-xl font-bold font-mono tracking-tighter text-gray-100">
            {config.appName} <span className={`text-xs ml-1 ${getTextColorClass(config.logoColor)}`}>{config.appVersion}</span>
          </h1>
        </div>
        
        {/* Center Tabs / 中间选项卡 */}
        <nav className="flex bg-gray-900 rounded p-1 border border-gray-800">
          <button 
            onClick={() => setActiveTab(AppMode.MONITOR)}
            className={`px-6 py-1 text-xs font-bold rounded transition tracking-wider ${activeTab === AppMode.MONITOR ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/50' : 'text-gray-500 hover:text-gray-300'}`}
          >
            {t.navMonitor}
          </button>
          <button 
            onClick={() => setActiveTab(AppMode.ADMIN)}
            className={`px-6 py-1 text-xs font-bold rounded transition tracking-wider ${activeTab === AppMode.ADMIN ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50' : 'text-gray-500 hover:text-gray-300'}`}
          >
            {t.navAdmin}
          </button>
        </nav>

        {/* Right side placeholder - Lang switch moved to Config tab per request */}
        <div className="w-10"></div>
      </header>

      {/* Main Content Area / 主内容区 */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
        {activeTab === AppMode.MONITOR ? (
          <LiveMonitor 
            profiles={profiles}
            onLogEntry={addLog}
            lang={lang}
            threshold={threshold}
            logs={logs}
          />
        ) : (
          <AdminDashboard 
            profiles={profiles}
            logs={logs}
            onAddProfile={addProfile}
            onDeleteProfile={deleteProfile}
            onAddSample={addSampleToProfile}
            onRemoveSample={removeSampleFromProfile}
            lang={lang}
            setLang={setLang}
            threshold={threshold}
            setThreshold={setThreshold}
          />
        )}
      </main>

      {/* Footer / 底部版权信息 */}
      {config.copyrightText && (
        <footer className="bg-black border-t border-gray-800 py-1 text-center shrink-0 z-50">
          <p className="text-[10px] text-gray-600 font-mono">
            {config.copyrightText}
          </p>
        </footer>
      )}

    </div>
  );
};

export default App;