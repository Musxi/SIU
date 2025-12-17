import React, { useRef, useState, useEffect } from 'react';
import { loadModels, detectFacesReal } from '../services/visionService';
import { PersonProfile, RecognitionLog, FaceDetection } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { translations, Language } from '../utils/i18n';

interface LiveMonitorProps {
  profiles: PersonProfile[];
  onLogEntry: (log: RecognitionLog) => void;
  lang: Language;
  threshold: number;
  logs: RecognitionLog[]; // Persistent logs passed from parent
}

type LoadingError = 'NETWORK' | 'CAMERA' | null;

const Icons = {
  User: () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Age: () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Gender: () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
  Expression: () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
}

const LiveMonitor: React.FC<LiveMonitorProps> = ({ profiles, onLogEntry, lang, threshold, logs }) => {
  const t = translations[lang];
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Use a ref to track mounted state (safest for async loops)
  const isMountedRef = useRef(true);
  
  const [detections, setDetections] = useState<FaceDetection[]>([]);
  // Removed local recentLogs state to fix persistence issue
  const [fps, setFps] = useState(0);
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [loadingError, setLoadingError] = useState<LoadingError>(null);

  useEffect(() => {
    isMountedRef.current = true;
    let animationFrameId: number;
    let isProcessing = false;
    let lastTime = performance.now();
    let frameCount = 0;
    let lastFpsTime = lastTime;

    const startSystem = async () => {
      // 1. Load Models
      try {
        const loaded = await loadModels();
        if (!isMountedRef.current) return;
        
        if (!loaded) {
          setLoadingError('NETWORK');
          return;
        }
        setIsModelsLoaded(true);

        // 2. Start Camera
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } 
        });

        if (!isMountedRef.current) {
            stream.getTracks().forEach(t => t.stop());
            return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Wait for data before looping
          videoRef.current.onloadeddata = () => {
            if (isMountedRef.current && videoRef.current) {
                videoRef.current.play().catch(e => console.error("Play error", e));
                loop();
            }
          };
        }
      } catch (e) {
        console.error("System start error", e);
        if (isMountedRef.current) setLoadingError('CAMERA');
      }
    };

    const loop = async () => {
      if (!isMountedRef.current || !videoRef.current) return;

      const now = performance.now();
      frameCount++;
      if (now - lastFpsTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastFpsTime = now;
      }

      if (!isProcessing) {
        isProcessing = true;
        try {
          const results = await detectFacesReal(videoRef.current, profiles, threshold);
          
          if (isMountedRef.current) {
             setDetections(results);
             
             // Process logs
             if (results.length > 0) { 
               results.forEach(det => {
                 // LOGIC UPDATE: We now log everything regardless of confidence to show "Unknowns" in the stream
                 // The useFaceSystem hook handles debouncing to prevent spam.
                 const newLog: RecognitionLog = {
                   id: uuidv4(),
                   timestamp: Date.now(),
                   personName: det.name,
                   confidence: det.confidence,
                   isUnknown: !det.identified,
                   age: det.age,
                   gender: det.gender,
                   expression: det.expressions?.[0]?.expression
                 };
                 onLogEntry(newLog);
               });
             }
          }
        } catch (e) {
          // Ignore errors during detection
        } finally {
          isProcessing = false;
        }
      }

      if (isMountedRef.current) {
        animationFrameId = requestAnimationFrame(loop);
      }
    };

    startSystem();

    return () => {
      isMountedRef.current = false;
      cancelAnimationFrame(animationFrameId);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [profiles, onLogEntry, threshold]);

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

  const getGenderLabel = (gender: string) => {
      // @ts-ignore
      return t.genders[gender] || gender;
  };

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
          
          {/* AR Overlay - Only render if detections exist to save resources */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Center Reticle */}
            <div className="absolute top-1/2 left-1/2 w-12 h-12 -ml-6 -mt-6 border border-cyan-500/20 rounded-full"></div>

            <div className="absolute inset-0 transform scale-x-[-1]"> 
              {detections.map((det, idx) => {
                const isIdentified = det.identified;
                const borderColor = isIdentified ? 'border-green-400' : 'border-red-500/50';
                const shadow = isIdentified ? 'shadow-[0_0_20px_rgba(74,222,128,0.3)]' : '';
                
                return (
                  <div 
                    key={idx} // Using index is okay here as they are transient
                    className={`absolute flex flex-col transition-all duration-75 ease-linear border-2 ${borderColor} ${shadow}`}
                    style={getBoxStyle(det.box_2d)}
                  >
                    <div className="absolute top-full left-0 mt-1 min-w-[140px] transform scale-x-[-1] origin-top-left z-20">
                       <div className="bg-gray-900/90 backdrop-blur border border-gray-600 rounded-lg shadow-2xl overflow-hidden flex flex-col">
                          <div className={`px-3 py-1.5 flex justify-between items-center border-b border-gray-700 ${isIdentified ? 'bg-green-900/40' : 'bg-red-900/40'}`}>
                              <div className="flex items-center gap-2">
                                  <span className={`font-bold text-sm ${isIdentified ? 'text-green-400' : 'text-red-400'}`}>
                                      {isIdentified ? det.name : t.unknown}
                                  </span>
                              </div>
                              <span className="text-[10px] font-mono text-gray-400 bg-black/40 px-1 rounded">
                                  {det.confidence}%
                              </span>
                          </div>
                          <div className="p-2 flex flex-col gap-1.5">
                              {det.age !== undefined && (
                                  <div className="flex items-center justify-between text-[11px] gap-3">
                                      <div className="flex items-center gap-1.5 text-gray-400">
                                          <Icons.Age />
                                          <span>{t.ageLabel}:</span>
                                      </div>
                                      <span className="text-cyan-300 font-mono font-bold tracking-wide">
                                          {Math.round(det.age)} <span className="text-[9px] text-gray-500 font-normal">{t.ageUnit}</span>
                                      </span>
                                  </div>
                              )}
                              {det.gender && (
                                  <div className="flex items-center justify-between text-[11px] gap-3">
                                      <div className="flex items-center gap-1.5 text-gray-400">
                                          <Icons.Gender />
                                          <span>{t.genderLabel}:</span>
                                      </div>
                                      <span className={det.gender === 'male' ? 'text-blue-400 font-bold' : 'text-pink-400 font-bold'}>
                                          {getGenderLabel(det.gender)}
                                      </span>
                                  </div>
                              )}
                              {det.expressions && det.expressions[0] && (
                                  <div className="flex items-center justify-between text-[11px] gap-3">
                                      <div className="flex items-center gap-1.5 text-gray-400">
                                          <Icons.Expression />
                                          <span>{t.expressionLabel}:</span>
                                      </div>
                                      <span className="text-yellow-400 font-bold uppercase text-[10px]">
                                          {getExpressionLabel(det.expressions[0].expression)}
                                      </span>
                                  </div>
                              )}
                          </div>
                       </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* System Info HUD */}
          <div className="absolute top-4 left-4 font-mono text-xs text-cyan-500 bg-black/70 px-4 py-2 rounded border-l-2 border-cyan-500 backdrop-blur-sm">
            <div className="flex flex-col gap-1">
              <span className="text-white font-bold">{t.engine}: TFJS_MOBILENET</span>
              <span>{t.fps}: {fps}</span>
              <span>{t.thresholdLabel}: {threshold}</span>
              <span>{t.faces}: {detections.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR */}
      <div className="w-full lg:w-80 bg-gray-900 border-l border-gray-800 flex flex-col z-10 shrink-0 h-[30vh] lg:h-auto">
        <div className="p-4 bg-gray-800 border-b border-gray-700">
           <h3 className="text-cyan-400 font-mono text-xs font-bold tracking-widest uppercase mb-1">
             {t.confidenceStream}
           </h3>
           <div className="h-0.5 w-10 bg-cyan-500"></div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono">
          {logs.slice(0, 50).map(log => (
            <div key={log.id} className="flex flex-col gap-2 p-3 bg-gray-800/50 border-l-2 border-gray-600 animate-slide-in rounded-r-md">
               <div className="flex justify-between items-center text-xs border-b border-gray-700/50 pb-2">
                 <span className={log.isUnknown ? "text-red-400" : "text-green-400 font-bold"}>
                   {log.isUnknown ? t.unknown : log.personName.toUpperCase()}
                 </span>
                 <span className="text-gray-500">{new Date(log.timestamp).toLocaleTimeString([], {hour12: false, second: '2-digit'})}</span>
               </div>
               <div className="flex justify-between items-center text-[10px] text-gray-400">
                   <span>{t.matchScore}</span>
                   <span className={log.confidence > 80 ? 'text-green-400 font-bold' : 'text-yellow-400'}>{log.confidence}%</span>
               </div>
               <div className="flex items-center gap-2">
                 <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden relative">
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
          {logs.length === 0 && (
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