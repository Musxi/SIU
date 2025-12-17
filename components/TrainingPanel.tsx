import React, { useState, useRef, useCallback, useEffect } from 'react';
import { PersonProfile } from '../types';
import { translations, Language } from '../utils/i18n';
import { loadModels, extractFaceDescriptor } from '../services/visionService';

interface TrainingPanelProps {
  profiles: PersonProfile[];
  onAddProfile: (name: string, image: string, descriptor?: number[]) => void;
  onDeleteProfile: (id: string) => void;
  onAddImageToProfile: (id: string, image: string) => void;
  lang: Language;
}

const TrainingPanel: React.FC<TrainingPanelProps> = ({ 
  profiles, onAddProfile, onDeleteProfile, onAddImageToProfile, lang
}) => {
  const t = translations[lang];
  const [newName, setNewName] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [modelStatus, setModelStatus] = useState("Loading AI Models...");
  const [modelsReady, setModelsReady] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  // Init models on mount
  useEffect(() => {
    const init = async () => {
      const loaded = await loadModels();
      if (loaded) {
        setModelsReady(true);
        setModelStatus("");
      } else {
        setModelStatus("Failed to load AI models.");
      }
    };
    init();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      console.error("Camera error", err);
      alert("Cannot access camera.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsCameraActive(false);
    }
  };

  const handleAddNewPerson = async () => {
    if (!newName.trim()) return alert(t.alertEnterName);
    if (!videoRef.current) return;

    setIsProcessing(true);
    
    // 1. Capture Image for UI
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    if (ctx) {
       ctx.drawImage(videoRef.current, 0, 0, 320, 240);
       const imgDataUrl = canvas.toDataURL('image/jpeg', 0.8);

       // 2. Extract Real Feature Vector
       try {
         const result = await extractFaceDescriptor(videoRef.current);
         if (result) {
            // Convert Float32Array to number array for storage
            const descriptorArray = Array.from(result.descriptor);
            onAddProfile(newName, imgDataUrl, descriptorArray);
            setNewName('');
            alert(`${t.alertAdded} (${newName})`);
         } else {
            alert("No face detected! Please look clearly at the camera.");
         }
       } catch (e) {
         console.error(e);
         alert("Error analyzing face.");
       }
    }
    setIsProcessing(false);
  };

  return (
    <div className="flex flex-col h-full gap-6 animate-fade-in">
      <div className="flex flex-col md:flex-row gap-6">
        
        {/* Camera Section */}
        <div className="flex-1 bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-700 relative flex flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-[400px] aspect-video bg-black rounded-lg overflow-hidden ring-2 ring-gray-700">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted
              className="w-full h-full object-cover transform scale-x-[-1]" 
            />
             {!isCameraActive && (
               <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-gray-900/80 backdrop-blur-sm">
                 {modelsReady ? t.cameraOff : modelStatus}
               </div>
             )}
             {isProcessing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
                   <div className="w-8 h-8 border-2 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
             )}
          </div>
          
          <div className="mt-4 flex gap-4">
            {!isCameraActive ? (
              <button 
                onClick={startCamera} 
                disabled={!modelsReady}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white px-6 py-2 rounded-full font-medium transition shadow-lg shadow-blue-900/30"
              >
                {modelsReady ? t.cameraStart : "Loading Models..."}
              </button>
            ) : (
              <button onClick={stopCamera} className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-full font-medium transition shadow-lg shadow-red-900/30">
                {t.cameraStop}
              </button>
            )}
          </div>
        </div>

        {/* New User Form */}
        <div className="flex-1 bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg flex flex-col justify-center">
          <h2 className="text-xl font-bold mb-6 text-blue-400 border-b border-gray-700 pb-2">{t.registerTitle}</h2>
          <div className="flex flex-col gap-5">
            <div className="text-sm text-gray-400 space-y-1 bg-gray-900 p-3 rounded-lg border border-gray-700">
              <p>{t.registerStep1}</p>
              <p>{t.registerStep2}</p>
              <p>{t.registerStep3}</p>
            </div>
            <input 
              type="text" 
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t.placeholderName}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            />
            <button 
              onClick={handleAddNewPerson}
              disabled={!isCameraActive || !newName || isProcessing}
              className={`w-full py-3 rounded-lg font-bold transition shadow-md ${
                (!isCameraActive || !newName || isProcessing) 
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                : 'bg-green-600 hover:bg-green-500 text-white shadow-green-900/20'
              }`}
            >
              {isProcessing ? "Processing..." : t.btnRegister}
            </button>
          </div>
        </div>
      </div>

      {/* Existing Profiles List */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 flex-1 overflow-auto">
        <h2 className="text-xl font-bold mb-4 text-purple-400">{t.datasetTitle}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map(profile => (
            <div key={profile.id} className="bg-gray-900 rounded-lg p-4 border border-gray-700 relative group hover:border-gray-500 transition">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg text-gray-100">{profile.name}</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded border ${profile.descriptors.length > 0 ? 'bg-green-900/50 border-green-700 text-green-400' : 'bg-red-900/50 border-red-700 text-red-400'}`}>
                  {profile.descriptors.length > 0 ? "VECTOR READY" : "NO VECTOR"}
                </span>
              </div>
              
              <div className="flex gap-2 overflow-x-auto pb-2 mb-3 snap-x scrollbar-hide">
                {profile.images.slice(-3).map((img, idx) => (
                  <img key={idx} src={img} alt="sample" className="w-16 h-16 object-cover rounded border border-gray-600 snap-center shrink-0" />
                ))}
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => onDeleteProfile(profile.id)}
                  className="w-full bg-red-600/20 hover:bg-red-600/40 text-red-300 px-3 py-2 rounded border border-red-600/30 transition text-xs"
                >
                  {t.btnDelete}
                </button>
              </div>
            </div>
          ))}
          
          {profiles.length === 0 && (
            <div className="col-span-full text-center py-10 text-gray-500 italic border-2 border-dashed border-gray-700 rounded-xl">
              {t.noProfiles}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrainingPanel;