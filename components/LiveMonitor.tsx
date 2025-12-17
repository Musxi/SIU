import React, { useRef, useState, useEffect } from 'react';
import { loadModels, detectFacesReal } from '../services/visionService';
import { PersonProfile, RecognitionLog, FaceDetection } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { translations, Language } from '../utils/i18n';

interface LiveMonitorProps {
  profiles: PersonProfile[];
  onLogEntry: (log: RecognitionLog) => void;
  lang: Language;
}

const LiveMonitor: React.FC<LiveMonitorProps> = ({ profiles, onLogEntry, lang }) => {
  const t = translations[lang];
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // State
  const [detections, setDetections] = useState<FaceDetection[]>([]);
  const [recentLogs, setRecentLogs] = useState<RecognitionLog[]>([]);
  const [fps, setFps] = useState(0);
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("Initializing Neural Networks...");

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
        setLoadingMsg("Error: Failed to download AI Models (Check Internet)");
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
        setLoadingMsg("Camera Access Denied");
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
          // REAL Detection call
          const results = await detectFacesReal(videoRef.current, profiles);
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
  }, [profiles, onLogEntry]);

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

  return (
    <div className="flex flex-col lg:flex-row h-full gap-0 lg:gap-6 bg-black text-white overflow-hidden relative">
      
      {/* MAIN VIEWPORT */}
      <div className="flex-1 relative bg-gray-900 overflow-hidden flex flex-col items-center justify-center border-b lg:border-r border-gray-800">
        
        {/* Loading Overlay */}
        {!isModelsLoaded && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gray-900 text-cyan-400">
                <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <div className="font-mono animate-pulse">{loadingMsg}</div>
                <div className="text-xs text-gray-500 mt-2">Downloading Weights (~10MB)...</div>
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
                  <div className={`absolute -top-6 left-0 flex items-center px-2 py-0.5 whitespace-nowrap transform scale-x-[-1] origin-bottom-left ${det.identified ? 'bg-green-500 text-black' : 'bg-red-600 text-white'}`}>
                     <span className="font-bold text-xs">
                       {det.identified ? det.name : 'UNKNOWN'}
                     </span>
                     <span className="ml-2 text-[10px] bg-black/20 px-1 rounded">
                       {det.confidence}%
                     </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System Info HUD */}
          <div className="absolute top-4 left-4 font-mono text-xs text-cyan-500 bg-black/70 px-4 py-2 rounded border-l-2 border-cyan-500 backdrop-blur-sm">
            <div className="flex flex-col gap-1">
              <span className="text-white font-bold">ENGINE: SSD_MOBILENET_V1</span>
              <span>FPS: {fps}</span>
              <span>STATUS: {isModelsLoaded ? "RUNNING" : "INIT"}</span>
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
          {recentLogs.map(log => (
            <div key={log.id} className="flex flex-col gap-1 p-2 bg-gray-800/50 border-l-2 border-gray-600 animate-slide-in">
               <div className="flex justify-between items-center text-xs">
                 <span className={log.isUnknown ? "text-red-400" : "text-green-400 font-bold"}>
                   {log.isUnknown ? "UNKNOWN" : log.personName.toUpperCase()}
                 </span>
                 <span className="text-gray-500">{new Date(log.timestamp).toLocaleTimeString([], {hour12: false, second: '2-digit'})}</span>
               </div>
               <div className="flex items-center gap-2">
                 <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                   <div 
                     className={`h-full ${log.confidence > 80 ? 'bg-green-500' : 'bg-yellow-500'}`} 
                     style={{width: `${log.confidence}%`}}
                   ></div>
                 </div>
               </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LiveMonitor;