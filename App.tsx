import React, { useState } from 'react';
import { AppMode } from './types';
import { useFaceSystem } from './hooks/useFaceSystem';
import { translations, Language } from './utils/i18n';
import LiveMonitor from './components/LiveMonitor';
import AdminDashboard from './components/AdminDashboard';

const App: React.FC = () => {
  // UI State
  const [activeTab, setActiveTab] = useState<AppMode>(AppMode.MONITOR);
  const [lang, setLang] = useState<Language>('zh'); // Default Chinese

  const { 
    profiles, 
    logs, 
    addProfile, 
    deleteProfile, 
    addSampleToProfile, 
    removeSampleFromProfile, // NEW: Delete specific samples
    addLog 
  } = useFaceSystem();

  const t = translations[lang];

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col font-sans overflow-hidden">
      
      {/* Top Navigation Bar / 顶部导航栏 */}
      <header className="bg-black border-b border-gray-800 h-14 flex items-center justify-between px-4 shrink-0 z-50">
        
        {/* Branding / 品牌标识 (Updated Name) */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-cyan-500 rounded-sm flex items-center justify-center font-bold text-black text-xs shadow-[0_0_10px_rgba(6,182,212,0.6)]">68</div>
          <h1 className="text-xl font-bold font-mono tracking-tighter text-gray-100">
            68344042<span className="text-cyan-500">-4</span>
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
      <main className="flex-1 relative overflow-hidden">
        {activeTab === AppMode.MONITOR ? (
          <LiveMonitor 
            profiles={profiles}
            onLogEntry={addLog}
            lang={lang}
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
          />
        )}
      </main>

    </div>
  );
};

export default App;