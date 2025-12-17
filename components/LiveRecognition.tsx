import React, { useRef, useState, useEffect } from 'react';
import { loadModels, detectFacesReal } from '../services/visionService';
import { PersonProfile, IdentifyResponse, RecognitionLog, FaceDetection } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { translations, Language } from '../utils/i18n';

interface LiveRecognitionProps {
  profiles: PersonProfile[];
  onLogEntry: (log: RecognitionLog) => void;
  onCorrectLog: (personId: string, image: string) => void; 
  lang: Language;
}

const LiveRecognition: React.FC<LiveRecognitionProps> = ({ profiles, onLogEntry, onCorrectLog, lang }) => {
  const t = translations[lang];
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResponse, setLastResponse] = useState<IdentifyResponse | null>(null);
  const [currentFrame, setCurrentFrame] = useState<string | null>(null);
  const [autoMode, setAutoMode] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const startCam = async () => {
      // Ensure models are loaded
      await loadModels();
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (e) {
        console.error("Cam error", e);
      }
    };
    startCam();

    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const getFrame = (): string | null => {
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        // Draw standard resolution for processing
        ctx.drawImage(videoRef.current, 0, 0, 320, 240);
        return canvasRef.current.toDataURL('image/jpeg', 0.85);
      }
    }
    return null;
  };

  const performRecognition = async () => {
    if (isProcessing) return;
    const frame = getFrame();
    if (!frame) return;

    setIsProcessing(true);
    setCurrentFrame(frame);
    
    // Simulate async processing delay for UX
    await new Promise(resolve => setTimeout(resolve, 200));

    let detections: FaceDetection[] = [];

    if (videoRef.current) {
      try {
        detections = await detectFacesReal(videoRef.current, profiles);
      } catch (err) {
        console.error("Recognition error", err);
      }
    }
    
    const result: IdentifyResponse = {
        detections: detections,
        reasoning: detections.length > 0 
            ? `Detected ${detections.length} face(s) using local vision engine.` 
            : "No faces detected in the current frame."
    };
    
    setLastResponse(result);

    // Create logs for each detected person
    if (result.detections.length > 0) {
      result.detections.forEach(det => {
        const log: RecognitionLog = {
          id: uuidv4(),
          timestamp: Date.now(),
          personName: det.identified ? det.name : 'Unknown',
          confidence: det.confidence,
          isUnknown: !det.identified
        };
        onLogEntry(log);
      });
    }

    setIsProcessing(false);
  };

  const toggleAuto = () => {
    if (autoMode) {
      if (timerRef.current) clearInterval(timerRef.current);
      setAutoMode(false);
    } else {
      setAutoMode(true);
      performRecognition(); 
      // Speed up to 3 seconds for better "real-time" feel
      timerRef.current = window.setInterval(performRecognition, 3000);
    }
  };

  const handleCorrection = (correctName: string) => {
    if (!currentFrame) return;
    const profile = profiles.find(p => p.name === correctName);
    if (profile) {
      onCorrectLog(profile.id, currentFrame);
      alert(`${t.confirmUpdate} ${correctName}.`);
      setLastResponse(null); 
    }
  };

  // Helper to calculate box styles
  const getBoxStyle = (box: number[]) => {
    // box is [ymin, xmin, ymax, xmax] in 0-1000 scale
    const [ymin, xmin, ymax, xmax] = box;
    return {
      top: `${ymin / 10}%`,
      left: `${xmin / 10}%`,
      height: `${(ymax - ymin) / 10}%`,
      width: `${(xmax - xmin) / 10}%`,
    };
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full animate-fade-in">
      {/* Video Feed Area */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Container for Video + Overlay */}
        {/* We flip the container so video AND boxes flip together correctly */}
        <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl border border-gray-700 aspect-video ring-1 ring-gray-600 transform scale-x-[-1]">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover" 
          />
          <canvas ref={canvasRef} width="320" height="240" className="hidden" />

          {/* Bounding Box Overlay Layer */}
          <div className="absolute inset-0 pointer-events-none">
             {lastResponse?.detections.map((det, idx) => (
               <div 
                 key={idx}
                 className={`absolute border-2 flex flex-col items-start ${det.identified ? 'border-green-500' : 'border-red-500'}`}
                 style={getBoxStyle(det.box_2d)}
               >
                 {/* Label Tag */}
                 <div className={`text-[10px] md:text-xs font-bold text-white px-1 py-0.5 -mt-6 whitespace-nowrap transform scale-x-[-1] self-end origin-bottom-right ${det.identified ? 'bg-green-600' : 'bg-red-600'}`}>
                   {det.identified ? det.name : 'Unknown'} ({det.confidence}%)
                 </div>
               </div>
             ))}
          </div>

          {/* Status Overlay (Unflipped for readability, so we apply another flip inside or place outside) */}
          {/* Since parent is flipped, we need child text to be flipped back to read normally */}
          <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/60 backdrop-blur px-3 py-1 rounded-full border border-gray-700 z-10 transform scale-x-[-1]">
            <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-yellow-400 animate-pulse' : 'bg-green-500'}`}></div>
            <span className="text-xs font-mono text-gray-200">
              {isProcessing ? t.statusAnalyzing : t.statusReady}
            </span>
          </div>

          {/* Controls Overlay (Flipped back) */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent flex justify-start items-center gap-3 transform scale-x-[-1]">
             <button 
                onClick={toggleAuto}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition shadow-lg ${
                  autoMode 
                    ? 'bg-purple-600 text-white shadow-purple-900/50' 
                    : 'bg-gray-800 text-gray-300 border border-gray-600 hover:bg-gray-700'
                }`}
             >
               {autoMode ? t.btnAutoOn : t.btnAutoOff}
             </button>
             <button 
                onClick={performRecognition}
                disabled={isProcessing}
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg text-sm font-bold transition shadow-lg shadow-blue-900/50 disabled:opacity-50"
             >
               {t.btnScan}
             </button>
          </div>
        </div>

        {/* Global Reasoning / Text Output */}
        <div className="bg-gray-800/80 p-4 rounded-xl border border-gray-700 min-h-[80px]">
           {lastResponse ? (
             <div>
               <div className="flex flex-wrap gap-2 mb-2">
                 {lastResponse.detections.length === 0 && <span className="text-gray-400 italic">{t.noDetections}</span>}
                 {lastResponse.detections.map((det, idx) => (
                   <span key={idx} className={`px-2 py-1 rounded text-xs border ${det.identified ? 'bg-green-900/30 border-green-600 text-green-300' : 'bg-red-900/30 border-red-600 text-red-300'}`}>
                     {det.identified ? det.name : 'Unknown'} ({det.confidence}%)
                   </span>
                 ))}
               </div>
               <p className="text-sm text-gray-300 italic">
                 "{lastResponse.reasoning}"
               </p>
             </div>
           ) : (
             <p className="text-gray-500 text-sm">{t.statusWaiting}</p>
           )}
        </div>
      </div>

      {/* Control / Feedback Panel */}
      <div className="w-full md:w-80 flex flex-col gap-4">
        <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 shadow-lg flex-1 flex flex-col">
          <h3 className="text-lg font-bold text-blue-400 mb-2 border-b border-gray-700 pb-2">{t.activeLearningTitle}</h3>
          <p className="text-xs text-gray-400 mb-4 leading-relaxed">
            {t.activeLearningDesc}
          </p>

          {currentFrame ? (
            <div className="mb-4 relative group">
              <p className="text-xs text-gray-500 mb-2 font-mono">{t.capturedFrame}</p>
              <img 
                src={currentFrame} 
                alt="Captured" 
                className="w-full h-32 object-cover rounded-lg border border-gray-600 opacity-80 group-hover:opacity-100 transition shadow-inner bg-black" 
              />
            </div>
          ) : (
             <div className="mb-4 h-32 bg-gray-900 rounded-lg border border-dashed border-gray-700 flex items-center justify-center text-gray-600 text-xs">
               {t.statusWaiting}
             </div>
          )}

          <div className="space-y-2 overflow-y-auto pr-1 flex-1 min-h-[150px]">
            {profiles.map(p => (
              <button
                key={p.id}
                onClick={() => handleCorrection(p.name)}
                disabled={!currentFrame}
                className="w-full flex items-center gap-3 p-2 rounded-lg bg-gray-900/50 hover:bg-gray-700 border border-gray-700 hover:border-blue-500 transition text-left group disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="w-8 h-8 rounded-full bg-gray-600 overflow-hidden ring-1 ring-gray-500">
                   {p.images[0] && <img src={p.images[0]} alt="" className="w-full h-full object-cover" />}
                </div>
                <span className="text-sm font-medium text-gray-300 group-hover:text-white">
                  {t.its} <span className="text-white font-bold">{p.name}</span>
                </span>
              </button>
            ))}
            {profiles.length === 0 && (
               <div className="text-center text-xs text-gray-500 py-4">No profiles to correct.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveRecognition;