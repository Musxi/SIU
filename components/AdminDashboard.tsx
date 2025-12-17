import React, { useState, useRef, useEffect } from 'react';
import { PersonProfile, RecognitionLog } from '../types';
import { translations, Language } from '../utils/i18n';
import { loadModels, extractFaceDescriptor, isVectorValidForPerson } from '../services/visionService';
import DataVisualization from './DataVisualization';

interface AdminDashboardProps {
  profiles: PersonProfile[];
  logs: RecognitionLog[];
  onAddProfile: (name: string, image: string, descriptor?: number[]) => void;
  onDeleteProfile: (id: string) => void;
  onAddSample?: (id: string, image: string, descriptor: number[]) => void; 
  onRemoveSample: (id: string, index: number) => void;
  lang: Language;
  setLang: (lang: Language) => void;
  threshold: number;
  setThreshold: (val: number) => void;
}

interface DeleteState {
  type: 'PROFILE' | 'SAMPLE';
  id: string; 
  sampleIndex?: number; 
  name?: string; 
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  profiles, logs, onAddProfile, onDeleteProfile, onAddSample, onRemoveSample, 
  lang, setLang, threshold, setThreshold 
}) => {
  const t = translations[lang] || translations['en'];
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'analytics'>('users');
  
  // -- TRAINING STATE --
  const [newName, setNewName] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [loadingError, setLoadingError] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  
  const [trainingMode, setTrainingMode] = useState<'NEW' | 'TRAIN'>('NEW');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  // -- MODAL STATE --
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteState | null>(null);

  // Derived state
  const editingProfile = profiles.find(p => p.id === editingProfileId) || null;
  const selectedProfile = profiles.find(p => p.id === selectedProfileId);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);

  // Initialize AI Models
  useEffect(() => {
    isMountedRef.current = true;
    loadModels().then((success) => {
        if (isMountedRef.current) {
            setModelsReady(success);
            if (!success) setLoadingError(true);
        }
    });

    return () => {
        isMountedRef.current = false;
        stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
        if (isMountedRef.current) setCameraActive(false);
    }
  };

  const startCamera = async () => {
    if (cameraActive && videoRef.current?.srcObject) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (!isMountedRef.current) {
          stream.getTracks().forEach(t => t.stop());
          return;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
        setFeedbackMsg(null);
      }
    } catch(e) { 
        console.error("Camera access failed:", e);
        if (isMountedRef.current) setFeedbackMsg(t.cameraAccessDenied || "Camera Error"); 
    }
  };

  // Effect to react to Training Mode changes
  useEffect(() => {
     if (trainingMode === 'TRAIN' && selectedProfileId) {
         if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
         }
         startCamera();
     }
  }, [trainingMode, selectedProfileId]);

  const handleCapture = async () => {
    if (trainingMode === 'NEW' && !newName) return alert(t.alertEnterName);
    if (!videoRef.current) return;
    
    if (!modelsReady) {
        setLoadingError(false);
        const ready = await loadModels();
        if (isMountedRef.current) setModelsReady(ready);
        if (!ready) {
             if (isMountedRef.current) setLoadingError(true);
             return alert(t.modelLoadError);
        }
    }

    if (isMountedRef.current) {
        setIsProcessing(true);
        setFeedbackMsg(null);
    }

    try {
        // USE STRICT MODE (true) for training
        // This ensures minConfidence is high (0.85) so we only get clear faces
        const result = await extractFaceDescriptor(videoRef.current, true);
        
        if (!result) {
            if (isMountedRef.current) {
                setFeedbackMsg(t.alertNoFace + " (Quality too low)");
                setIsProcessing(false);
            }
            return;
        }

        const { descriptor, detection } = result;
        const vector = Array.from(descriptor);

        // DATA CONSISTENCY CHECK
        // If adding to existing profile, check if it actually looks like them
        if (trainingMode === 'TRAIN' && selectedProfile) {
            const isValid = isVectorValidForPerson(vector, selectedProfile.descriptors);
            if (!isValid) {
                 if (isMountedRef.current) {
                     setFeedbackMsg("⚠️ Sample Rejected: Face does not match this profile significantly. Please check lighting or angle.");
                     setIsProcessing(false);
                 }
                 return;
            }
        }

        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                // Draw image
                ctx.drawImage(videoRef.current, 0, 0, 320, 240);
                
                // Draw visual confirmation box so user knows what was captured
                const box = detection.box;
                // Since we draw at 320x240, we need to scale detection box (which is relative to video element size)
                // Video element might be different, but face-api returns coords relative to input media
                // We just rely on the fact that we passed videoRef.current to detectSingleFace
                // The safest way is to draw the video frame as is.
                
                // Optional: Draw green box on the canvas image to burn it in? 
                // Better to just save clean image, but show success.

                const img = canvasRef.current.toDataURL('image/jpeg', 0.8);

                if (trainingMode === 'NEW') {
                   onAddProfile(newName, img, vector);
                   if (isMountedRef.current) {
                       setNewName('');
                       setFeedbackMsg("✅ " + t.alertAdded);
                   }
                } else if (trainingMode === 'TRAIN' && selectedProfileId && onAddSample) {
                   onAddSample(selectedProfileId, img, vector);
                   if (isMountedRef.current) {
                       setFeedbackMsg("✅ " + t.alertSampleAdded);
                       // Optional: Stay in training mode to add more angles
                   }
                }
            }
        }
    } catch (e) {
        console.error(e);
        if (isMountedRef.current) setFeedbackMsg(t.alertProcessingError);
    } finally {
        if (isMountedRef.current) setIsProcessing(false);
    }
  };

  const startTrainingExisting = (id: string) => {
     setSelectedProfileId(id);
     setTrainingMode('TRAIN');
     setFeedbackMsg(null);
  };

  const openEditModal = (profile: PersonProfile) => {
      setEditingProfileId(profile.id);
  };

  const executeDelete = () => {
    if (!deleteConfirm) return;

    if (deleteConfirm.type === 'PROFILE') {
        onDeleteProfile(deleteConfirm.id);
        if (selectedProfileId === deleteConfirm.id) {
            setTrainingMode('NEW');
            setSelectedProfileId(null);
        }
        if (editingProfileId === deleteConfirm.id) {
            setEditingProfileId(null);
        }
    } else if (deleteConfirm.type === 'SAMPLE' && deleteConfirm.sampleIndex !== undefined) {
        onRemoveSample(deleteConfirm.id, deleteConfirm.sampleIndex);
    }
    setDeleteConfirm(null);
  };

  return (
    <div className="h-full flex flex-col animate-fade-in bg-gray-900 relative">
      
      {deleteConfirm && (
        <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
             <div className="bg-gray-800 rounded-xl border border-gray-600 shadow-2xl w-full max-w-sm overflow-hidden transform transition-all scale-100 animate-fade-in">
                 <div className="p-6 text-center">
                    <div className="w-16 h-16 bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">
                        {deleteConfirm.type === 'PROFILE' ? t.confirmDeleteProfile : t.confirmDeleteSample}
                    </h3>
                    <p className="text-gray-400 text-sm mb-6">
                        {deleteConfirm.type === 'PROFILE' && <span className="text-white font-bold block text-lg my-1">"{deleteConfirm.name}"</span>}
                        {t.actionUndone}
                    </p>
                    <div className="flex gap-3 justify-center">
                        <button 
                            onClick={() => setDeleteConfirm(null)}
                            className="px-5 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition font-medium"
                        >
                            {t.btnCancel}
                        </button>
                        <button 
                            onClick={executeDelete}
                            className="px-5 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 transition font-bold shadow-lg shadow-red-900/50"
                        >
                            {t.btnConfirm}
                        </button>
                    </div>
                 </div>
             </div>
        </div>
      )}

      {editingProfile && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-xl border border-gray-600 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800 rounded-t-xl">
                    <div>
                        <h3 className="text-xl font-bold text-white">{t.samplesTitle}: <span className="text-cyan-400">{editingProfile.name}</span></h3>
                        <p className="text-sm text-gray-400">{t.samplesDesc}</p>
                    </div>
                    <button onClick={() => setEditingProfileId(null)} className="text-gray-400 hover:text-white text-2xl px-2">
                        &times;
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {editingProfile.images.map((img, idx) => (
                            <div key={idx} className="relative group bg-black rounded border border-gray-700 overflow-hidden">
                                <img src={img} className="w-full h-32 object-cover opacity-80 group-hover:opacity-100 transition" alt="sample" />
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                    <button 
                                        onClick={() => {
                                            setDeleteConfirm({
                                                type: 'SAMPLE',
                                                id: editingProfile.id,
                                                sampleIndex: idx
                                            });
                                        }}
                                        className="bg-red-600 text-white text-xs px-3 py-1 rounded hover:bg-red-500 font-bold shadow"
                                    >
                                        {t.deleteSample}
                                    </button>
                                </div>
                                <span className="absolute top-1 left-1 bg-gray-900/80 text-white text-[10px] px-1 rounded">#{idx + 1}</span>
                            </div>
                        ))}
                    </div>
                    {editingProfile.images.length === 0 && (
                        <div className="text-center text-gray-500 py-10">
                            No samples remaining.
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-gray-700 bg-gray-800 rounded-b-xl flex justify-end">
                    <button onClick={() => setEditingProfileId(null)} className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded">
                        {t.closeModal}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Sub Navigation & Header */}
      <div className="bg-gray-800 p-4 border-b border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
        <div className="flex gap-4">
            <button 
            onClick={() => setActiveSubTab('users')}
            className={`px-4 py-2 rounded-md font-bold text-sm transition ${activeSubTab === 'users' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
            >
            {t.tabTrain}
            </button>
            <button 
            onClick={() => setActiveSubTab('analytics')}
            className={`px-4 py-2 rounded-md font-bold text-sm transition ${activeSubTab === 'analytics' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
            >
            {t.tabStats}
            </button>
        </div>

        {/* SETTINGS AREA (Threshold + Lang) */}
        <div className="flex items-center gap-4 flex-wrap justify-end">
            
            {/* Threshold Slider */}
            <div className="flex items-center gap-2 bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-700">
                <div className="flex flex-col items-end">
                   <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{t.thresholdLabel}</span>
                   <span className="text-xs text-cyan-400 font-mono font-bold">{threshold}</span>
                </div>
                <input 
                  type="range" 
                  min="0.3" 
                  max="0.8" 
                  step="0.01"
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  className="w-24 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
            </div>

            {/* Language */}
            <div className="flex items-center gap-2 bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-700">
                <span className="text-xs text-gray-500 font-mono uppercase">{t.langSelect}:</span>
                <div className="flex gap-1">
                    <button 
                        onClick={() => setLang('zh')}
                        className={`text-xs px-2 py-1 rounded transition ${lang === 'zh' ? 'bg-gray-700 text-white font-bold' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        中文
                    </button>
                    <div className="w-[1px] bg-gray-700 h-4 self-center"></div>
                    <button 
                        onClick={() => setLang('en')}
                        className={`text-xs px-2 py-1 rounded transition ${lang === 'en' ? 'bg-gray-700 text-white font-bold' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        EN
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* Main Content Scroll Container */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6 scrollbar-hide">
        
        {/* ============ USER MANAGEMENT TAB ============ */}
        {activeSubTab === 'users' && (
          <div className="max-w-6xl mx-auto space-y-8 pb-20">
            {/* 1. Camera / Training Station */}
            <div className={`bg-gray-800 rounded-xl p-6 border transition-colors shadow-lg ${trainingMode === 'TRAIN' ? 'border-green-500 ring-1 ring-green-500' : 'border-gray-700'}`}>
              <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                 <h2 className="text-xl font-bold text-white">
                    {trainingMode === 'NEW' 
                        ? t.registerTitle 
                        : `${t.trainingTitle}: ${selectedProfile?.name || 'Unknown'}` 
                    }
                 </h2>
                 {trainingMode === 'TRAIN' && (
                    <button 
                        onClick={() => { 
                            setTrainingMode('NEW'); 
                            setSelectedProfileId(null); 
                            setNewName('');
                            setFeedbackMsg(null);
                        }} 
                        className="text-xs text-red-400 hover:text-red-300"
                    >
                       {t.btnCancelTrain}
                    </button>
                 )}
              </div>

              <div className="flex flex-col md:flex-row gap-6">
                
                {/* Camera View */}
                <div className="w-full md:w-1/2 bg-black rounded-lg overflow-hidden relative aspect-video border border-gray-600 ring-1 ring-gray-700">
                   <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
                   
                   {!modelsReady && !loadingError && (
                       <div className="absolute top-2 left-2 right-2 bg-yellow-900/80 text-yellow-200 text-xs px-2 py-1 rounded text-center animate-pulse">
                           {t.loadingModels}
                       </div>
                   )}
                   
                   {loadingError && (
                       <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90 text-red-400 text-sm text-center px-4">
                           {t.modelLoadError}
                       </div>
                   )}
                   
                   {/* Feedback Overlay */}
                   {feedbackMsg && (
                       <div className="absolute top-2 left-2 right-2 z-20 bg-black/70 backdrop-blur text-white text-xs px-3 py-2 rounded text-center border border-gray-500 shadow-xl animate-fade-in">
                           {feedbackMsg}
                       </div>
                   )}

                   {!cameraActive && (
                     <div className="absolute inset-0 flex items-center justify-center">
                       <button onClick={startCamera} className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2 rounded-full font-bold shadow-lg shadow-cyan-900/50">
                         {t.cameraStart}
                       </button>
                     </div>
                   )}
                   
                   {isProcessing && (
                       <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-10">
                           <div className="w-10 h-10 border-4 border-t-green-500 border-gray-600 rounded-full animate-spin mb-2"></div>
                           <span className="text-green-400 font-mono text-sm">{t.extracting}</span>
                       </div>
                   )}
                   <canvas ref={canvasRef} width="320" height="240" className="hidden" />
                </div>

                {/* Form */}
                <div className="w-full md:w-1/2 flex flex-col justify-center space-y-4">
                  <div className="bg-gray-700/30 p-4 rounded-lg text-sm text-gray-300 border border-gray-600">
                     {trainingMode === 'NEW' ? (
                        <p className="leading-relaxed">
                            {t.activeLearningDesc} <br/>
                            1. {t.cameraStart} <br/>
                            2. {t.placeholderName} <br/>
                            3. {t.btnRegister}
                        </p>
                     ) : (
                        <>
                           <p className="text-green-400 font-bold mb-2">
                               {t.optimizing}: {selectedProfile?.name || 'Unknown'}
                           </p>
                           <p className="text-gray-400 text-xs">{t.trainTips}</p>
                           <div className="text-xs text-yellow-500 mt-2 p-2 bg-yellow-900/20 border border-yellow-800 rounded">
                               {t.trainTipsHelper}
                           </div>
                        </>
                     )}
                  </div>
                  
                  {trainingMode === 'NEW' && (
                    <input 
                        type="text" 
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder={t.placeholderName}
                        className="bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none transition"
                    />
                  )}

                  <button 
                    onClick={handleCapture}
                    disabled={!cameraActive || isProcessing || (trainingMode === 'NEW' && !newName)}
                    className={`py-3 rounded-lg font-bold shadow-lg transition flex items-center justify-center gap-2 ${
                        (!cameraActive || isProcessing || (trainingMode === 'NEW' && !newName))
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : trainingMode === 'NEW' 
                            ? 'bg-cyan-600 hover:bg-cyan-500 text-white' 
                            : 'bg-green-600 hover:bg-green-500 text-white'
                    }`}
                  >
                    {isProcessing ? t.processing : (trainingMode === 'NEW' ? t.btnRegister : t.btnAddSample)}
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Existing Users List */}
            <div>
              <div className="flex justify-between items-end mb-4">
                  <h3 className="text-lg font-bold text-gray-300">{t.datasetTitle} <span className="text-cyan-500">({profiles.length})</span></h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {profiles.map(p => (
                  <div key={p.id} className={`bg-gray-800 p-4 rounded-xl border hover:border-cyan-500 transition relative group shadow-md ${selectedProfileId === p.id ? 'border-green-500 ring-1 ring-green-500' : 'border-gray-700'}`}>
                    
                    <div className="absolute top-2 right-2 z-10 flex gap-1">
                       <button 
                         onClick={(e) => { 
                             e.stopPropagation(); 
                             setDeleteConfirm({
                                 type: 'PROFILE',
                                 id: p.id,
                                 name: p.name
                             });
                         }} 
                         className="text-white bg-red-600/80 hover:bg-red-500 rounded-full w-7 h-7 flex items-center justify-center transition shadow cursor-pointer z-20"
                         title="Delete ID"
                       >
                         ×
                       </button>
                    </div>
                    
                    <div 
                        onClick={() => openEditModal(p)}
                        className="w-full h-36 bg-black rounded-lg mb-3 overflow-hidden relative cursor-pointer"
                        title={t.manageSamples}
                    >
                      <img src={p.images[p.images.length-1]} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition duration-500" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                          <span className="text-white text-xs border border-white px-2 py-1 rounded bg-black/50">{t.manageSamples}</span>
                      </div>
                      <div className="absolute bottom-2 left-2 flex gap-0.5">
                         {Array.from({length: Math.min(5, p.descriptors?.length || 0)}).map((_, i) => (
                             <div key={i} className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-sm"></div>
                         ))}
                      </div>
                    </div>

                    <h4 className="font-bold text-white text-lg truncate">{p.name}</h4>
                    <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-gray-400 font-mono">
                           N={p.descriptors?.length || 0}
                        </span>
                        <button 
                           onClick={() => startTrainingExisting(p.id)}
                           className="text-[10px] bg-cyan-900/50 text-cyan-300 border border-cyan-700 px-2 py-1 rounded hover:bg-cyan-800 transition uppercase font-bold"
                        >
                           + {t.btnAddSample}
                        </button>
                    </div>
                  </div>
                ))}
                {profiles.length === 0 && (
                    <div className="col-span-full py-12 text-center border-2 border-dashed border-gray-700 rounded-xl">
                        <p className="text-gray-500 text-lg mb-2">{t.dbEmpty}</p>
                    </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============ ANALYTICS TAB ============ */}
        {activeSubTab === 'analytics' && (
          <div className="max-w-6xl mx-auto h-full">
             <DataVisualization profiles={profiles} logs={logs} lang={lang} />
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;