import React, { useRef, useState, useEffect } from 'react';
import { loadModels, detectFacesReal } from '../services/visionService';
import { PersonProfile, RecognitionLog, FaceDetection } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { translations, Language } from '../utils/i18n';

interface LiveMonitorProps {
  profiles: PersonProfile[];
  onLogEntry: (log: RecognitionLog) => void;
  lang: Language;
  threshold: number; // New Prop for Accuracy Tuning
}

type LoadingError = 'NETWORK' | 'CAMERA' | null;

const LiveMonitor: React.FC<LiveMonitorProps> = ({ profiles, onLogEntry, lang, threshold }) => {
  const t = translations[lang];
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // State
  const [detections, setDetections] = useState<FaceDetection[]>([]);
  const [recentLogs, setRecentLogs] = useState<RecognitionLog[]>([]);
  const [fps, setFps] = useState(0);
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [loadingError, setLoadingError] = useState<LoadingError>(null);

  // Animation Frame Loop
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();
    let frameCount = 0;
    let lastFpsTime = lastTime;
    let isProcessing = false;

    const startSystem = async () => {
      // 1. Load Models
      const loaded = await loadModels();
      if (!loaded) {
        setLoadingError('NETWORK');
        return;
      }
      setIsModelsLoaded(true);

      // 2. Start Camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Wait for video to be ready
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            loop();
          };
        }
      } catch (e) {
        console.error("Camera error", e);
        setLoadingError('CAMERA');
      }
    };

    const loop = async () => {
      if (!videoRef.current) return;

      const now = performance.now();
      frameCount++;

      // FPS Calc
      if (now - lastFpsTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastFpsTime = now;
      }

      // Detection Loop (Throttled slightly to prevent UI freeze)
      if (!isProcessing) {
        isProcessing = true;
        try {
          // REAL Detection call with dynamic threshold
          const results = await detectFacesReal(videoRef.current, profiles, threshold);
          setDetections(results);

          // Logging
          if (results.length > 0) { 
            results.forEach(det => {
              // Only log if we have a solid ID or it's a clear face
              if (det.identified || det.confidence > 50) {
                  const newLog: RecognitionLog = {
                    id: uuidv4(),
                    timestamp: Date.now(),
                    personName: det.name,
                    confidence: det.confidence,
                    isUnknown: !det.identified
                  };
                  onLogEntry(newLog);
                  setRecentLogs(prev => [newLog, ...prev].slice(0, 15));
              }
            });
          }
        } catch (err) {
            console.warn("Detection frame dropped", err);
        }
        isProcessing = false;
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    startSystem();

    return () => {
      cancelAnimationFrame(animationFrameId);
      const stream = videoRef.current?.srcObject as MediaStream;
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [profiles, onLogEntry, threshold]);

  // Style helper
  const getBoxStyle = (box: number[]) => {
    const [ymin, xmin, ymax, xmax] = box;
    return {
      top: `${ymin / 10}%`,
      left: `${xmin / 10}%`,
      height: `${(ymax - ymin) / 10}%`,
      width: `${(xmax - xmin) / 10}%`,
    };
  };

  const getLoadingMessage = () => {
    if (loadingError === 'NETWORK') return t.modelLoadError;
    if (loadingError === 'CAMERA') return t.cameraAccessDenied;
    return t.initializing;
  };

  // Helper to translate Gender
  const getGenderLabel = (gender: string) => {
      // @ts-ignore
      return t.genders[gender] || gender;
  };

  // Helper to translate Expression
  const getExpressionLabel = (expr: string) => {
      // @ts-ignore
      return t.expressions[expr] || expr;
  };

  return (
    <div className="flex flex-col lg:flex-row h-full gap-0 lg:gap-6 bg-black text-white overflow-hidden relative">
      
      {/* MAIN VIEWPORT */}
      <div className="flex-1 relative bg-gray-900 overflow-hidden flex flex-col items-center justify-center border-b lg:border-r border-gray-800">
        
        {/* Loading Overlay */}
        {!isModelsLoaded && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gray-900 text-cyan-400">
                <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <div className="font-mono animate-pulse">{getLoadingMessage()}</div>
                <div className="text-xs text-gray-500 mt-2">{t.downloadingWeights}</div>
            </div>
        )}

        <div className="relative w-full h-full max-w-[1920px] mx-auto">
          <video 
            ref={videoRef} 
            muted 
            playsInline
            className="w-full h-full object-cover transform scale-x-[-1]" 
          />
          
          {/* AR Overlay */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Center Reticle */}
            <div className="absolute top-1/2 left-1/2 w-12 h-12 -ml-6 -mt-6 border border-cyan-500/20 rounded-full"></div>

            {/* Bounding Boxes */}
            <div className="absolute inset-0 transform scale-x-[-1]"> 
              {detections.map((det, idx) => (
                <div 
                  key={idx}
                  className={`absolute flex flex-col transition-all duration-75 ease-linear ${
                    det.identified 
                      ? 'border-2 border-green-400 shadow-[0_0_20px_rgba(74,222,128,0.3)]' 
                      : 'border-2 border-red-500/50 border-dashed'
                  }`}
                  style={getBoxStyle(det.box_2d)}
                >
                  {/* Name Tag */}
                  <div className={`absolute -top-6 left-0 flex items-center px-2 py-0.5 whitespace-nowrap transform scale-x-[-1] origin-bottom-left ${det.identified ? 'bg-green-500 text-black' : 'bg-red-600 text-white'}`}>
                     <span className="font-bold text-xs">
                       {/* Localized UNKNOWN */}
                       {det.identified ? det.name : t.unknown}
                     </span>
                     <span className="ml-2 text-[10px] bg-black/20 px-1 rounded">
                       {det.confidence}%
                     </span>
                  </div>

                  {/* Demographics Card (Bottom) - Combined & Standardized */}
                  {(det.age !== undefined || det.gender || (det.expressions && det.expressions[0])) && (
                    <div className="absolute top-full left-0 mt-2 bg-gray-900/90 backdrop-blur border border-gray-600 rounded p-2 shadow-xl transform scale-x-[-1] origin-top-left min-w-[110px] z-20">
                      <div className="flex flex-col gap-1 text-[10px] leading-relaxed">
                        
                        {/* Age */}
                        {det.age !== undefined && (
                           <div className="flex justify-between items-center gap-3 border-b border-gray-700/50 pb-0.5 mb-0.5">
                              <span className="text-gray-400">{t.ageLabel}</span>
                              <span className="text-cyan-300 font-mono font-bold">{Math.round(det.age)} <span className="text-[9px] text-gray-500">{t.ageUnit}</span></span>
                           </div>
                        )}
                        
                        {/* Gender */}
                        {det.gender && (
                           <div className="flex justify-between items-center gap-3 border-b border-gray-700/50 pb-0.5 mb-0.5">
                              <span className="text-gray-400">{t.genderLabel}</span>
                              <span className={det.gender === 'male' ? 'text-blue-400 font-bold' : 'text-pink-400 font-bold'}>
                                {getGenderLabel(det.gender)}
                              </span>
                           </div>
                        )}

                        {/* Expression */}
                        {det.expressions && det.expressions[0] && (
                           <div className="flex justify-between items-center gap-3">
                              <span className="text-gray-400">{t.expressionLabel}</span>
                              <span className="text-yellow-400 font-bold uppercase tracking-wide">
                                {getExpressionLabel(det.expressions[0].expression)}
                              </span>
                           </div>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              ))}
            </div>
          </div>

          {/* System Info HUD */}
          <div className="absolute top-4 left-4 font-mono text-xs text-cyan-500 bg-black/70 px-4 py-2 rounded border-l-2 border-cyan-500 backdrop-blur-sm">
            <div className="flex flex-col gap-1">
              {/* Localized HUD Labels */}
              <span className="text-white font-bold">{t.engine}: TFJS_MOBILENET</span>
              <span>{t.fps}: {fps}</span>
              <span>{t.thresholdLabel}: {threshold}</span>
              <span>{t.faces}: {detections.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR (IMPROVED CLARITY) */}
      <div className="w-full lg:w-80 bg-gray-900 border-l border-gray-800 flex flex-col z-10 shrink-0 h-[30vh] lg:h-auto">
        <div className="p-4 bg-gray-800 border-b border-gray-700">
           <h3 className="text-cyan-400 font-mono text-xs font-bold tracking-widest uppercase mb-1">
             {t.confidenceStream}
           </h3>
           <div className="h-0.5 w-10 bg-cyan-500"></div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono">
          {recentLogs.map(log => (
            <div key={log.id} className="flex flex-col gap-2 p-3 bg-gray-800/50 border-l-2 border-gray-600 animate-slide-in rounded-r-md">
               <div className="flex justify-between items-center text-xs border-b border-gray-700/50 pb-2">
                 <span className={log.isUnknown ? "text-red-400" : "text-green-400 font-bold"}>
                   {log.isUnknown ? t.unknown : log.personName.toUpperCase()}
                 </span>
                 <span className="text-gray-500">{new Date(log.timestamp).toLocaleTimeString([], {hour12: false, second: '2-digit'})}</span>
               </div>
               
               {/* Explicit Data Label */}
               <div className="flex justify-between items-center text-[10px] text-gray-400">
                   <span>{t.matchScore}</span>
                   <span className={log.confidence > 80 ? 'text-green-400 font-bold' : 'text-yellow-400'}>{log.confidence}%</span>
               </div>

               <div className="flex items-center gap-2">
                 <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden relative">
                    {/* Grid lines for clarity */}
                    <div className="absolute inset-0 flex justify-between px-1">
                        <div className="w-[1px] h-full bg-black/20"></div>
                        <div className="w-[1px] h-full bg-black/20"></div>
                        <div className="w-[1px] h-full bg-black/20"></div>
                        <div className="w-[1px] h-full bg-black/20"></div>
                    </div>
                   <div 
                     className={`h-full transition-all duration-500 ease-out ${log.confidence > 80 ? 'bg-gradient-to-r from-green-600 to-green-400' : 'bg-gradient-to-r from-yellow-600 to-yellow-400'}`} 
                     style={{width: `${log.confidence}%`}}
                   ></div>
                 </div>
               </div>
            </div>
          ))}
          {recentLogs.length === 0 && (
              <div className="text-center py-10 text-gray-600 text-xs italic">
                  {t.waitingData}
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveMonitor;