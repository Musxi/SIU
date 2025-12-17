import { PersonProfile, FaceDetection } from "../types";

/**
 * REAL AI VISION ENGINE (Powered by face-api.js)
 * 真实 AI 视觉引擎 (基于 face-api.js / TensorFlow.js)
 */

declare const faceapi: any; // Global from CDN (in index.html)

// SINGLETON STATE
let isCriticalModelsLoaded = false;
let isDemographicsLoaded = false; 
let faceMatcher: any = null;
let lastDescriptorCount = -1;

// PROMISE CACHE
let loadingPromise: Promise<boolean> | null = null;

// Configuration
const CONFIG = {
  // Priority list of Model URLs to try. 
  // If one fails, the system will automatically try the next.
  // 模型源优先级列表，如果第一个失败，会自动尝试下一个。
  MODEL_URLS: [
    // Source 1: jsDelivr (Pinned version - usually fastest)
    'https://cdn.jsdelivr.net/gh/cgarciagl/face-api.js@0.22.2/weights',
    // Source 2: Official GitHub Pages (Stable fallback)
    'https://justadudewhohacks.github.io/face-api.js/models',
    // Source 3: jsDelivr (Master branch - fallback)
    'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights'
  ],
  TIMEOUT_MS: 60000 // Increased to 60 seconds to accommodate slower networks
};

// Helper: Timeout Wrapper for Promises
const withTimeout = (ms: number, promise: Promise<any>) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout after ${ms}ms`));
    }, ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((reason) => {
        clearTimeout(timer);
        reject(reason);
      });
  });
};

/**
 * Load AI Models (Robust Multi-Source Strategy)
 * 加载 AI 模型（稳健的多源策略）
 */
export const loadModels = (): Promise<boolean> => {
  // 0. Safety Check
  if (typeof faceapi === 'undefined') {
    console.error("Face-api.js not loaded. Check index.html.");
    return Promise.resolve(false);
  }

  // 1. If already loaded, return immediately
  if (isCriticalModelsLoaded) return Promise.resolve(true);

  // 2. If currently loading, return the existing promise
  if (loadingPromise) return loadingPromise;

  // 3. Start loading process
  loadingPromise = (async () => {
    for (const url of CONFIG.MODEL_URLS) {
      try {
        console.log(`Attempting to load models from: ${url} ...`);
        
        // Load Critical Models with Timeout
        await withTimeout(CONFIG.TIMEOUT_MS, Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(url),
          faceapi.nets.faceLandmark68Net.loadFromUri(url),
          faceapi.nets.faceRecognitionNet.loadFromUri(url)
        ]));
        
        console.log(`✅ Success: Critical models loaded from ${url}`);
        isCriticalModelsLoaded = true;

        // Try to load Demographics (Background, Non-blocking for success)
        // Note: We use the same URL that worked for critical models
        loadDemographicsBackground(url);

        return true;
      } catch (error) {
        console.warn(`❌ Failed to load from ${url}:`, error);
        // Continue to next URL in the loop
      }
    }

    console.error("CRITICAL: All model sources failed.");
    loadingPromise = null; 
    return false;
  })();

  return loadingPromise;
};

// Helper to load extra models without blocking the main app flow
const loadDemographicsBackground = async (url: string) => {
  try {
    await Promise.all([
        faceapi.nets.faceExpressionNet.loadFromUri(url),
        faceapi.nets.ageGenderNet.loadFromUri(url)
    ]);
    isDemographicsLoaded = true;
    console.log("✅ Demographics models loaded.");
  } catch (e) {
    console.warn("Demographics skipped (Non-fatal).");
    isDemographicsLoaded = false;
  }
};

/**
 * Extract Feature Vector from an Image
 */
export const extractFaceDescriptor = async (imageElement: HTMLImageElement | HTMLVideoElement): Promise<Float32Array | null> => {
  if (!isCriticalModelsLoaded) {
      const success = await loadModels();
      if (!success) return null;
  }

  try {
      if (imageElement instanceof HTMLVideoElement && (imageElement.paused || imageElement.ended || !imageElement.videoWidth)) {
        return null;
      }

      const detection = await faceapi.detectSingleFace(imageElement)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) return null;
      return detection.descriptor;
  } catch (e) {
      console.error("Extraction error:", e);
      return null;
  }
};

/**
 * Build/Update the Face Matcher
 */
const updateFaceMatcher = (profiles: PersonProfile[], threshold: number) => {
  if (!faceapi || !isCriticalModelsLoaded) return;

  const currentDescriptorCount = profiles.reduce((acc, p) => acc + p.descriptors.length, 0);
  
  if (currentDescriptorCount === lastDescriptorCount && faceMatcher) {
    return;
  }

  const labeledDescriptors: any[] = [];
  profiles.forEach(p => {
    if (p.descriptors && p.descriptors.length > 0) {
        const vectors = p.descriptors.map(d => new Float32Array(d));
        labeledDescriptors.push(
            new faceapi.LabeledFaceDescriptors(p.name, vectors)
        );
    }
  });

  if (labeledDescriptors.length > 0) {
    faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, threshold);
  } else {
    faceMatcher = null;
  }
  
  lastDescriptorCount = currentDescriptorCount;
};

/**
 * Real-time Face Detection & Recognition
 */
export const detectFacesReal = async (
  video: HTMLVideoElement,
  profiles: PersonProfile[],
  threshold: number = 0.55
): Promise<FaceDetection[]> => {
  
  if (!isCriticalModelsLoaded || !video || video.paused || video.ended || !faceapi) return [];

  try {
    // 1. Detection
    // Using default SSD MobileNet V1 options
    let task = faceapi.detectAllFaces(video).withFaceLandmarks().withFaceDescriptors();
    
    if (isDemographicsLoaded) {
        task = task.withFaceExpressions().withAgeAndGender();
    }

    const detections = await task;
    if (!detections.length) return [];

    // 2. Update Matcher (Sync)
    updateFaceMatcher(profiles, threshold);

    // 3. Match
    const results: FaceDetection[] = detections.map((d: any) => {
      let name = "Unknown";
      let confidence = 0;
      let identified = false;

      if (faceMatcher) {
        const bestMatch = faceMatcher.findBestMatch(d.descriptor);
        if (bestMatch.distance < threshold) {
          name = bestMatch.label;
          identified = true;
          const score = Math.max(0, 1 - (bestMatch.distance / threshold));
          confidence = Math.floor(score * 100); 
        } else {
           confidence = Math.floor((1 - Math.min(1, bestMatch.distance)) * 100); 
        }
      }

      // 4. Normalize Box
      const box = d.detection.box; 
      const vW = video.videoWidth || 640;
      const vH = video.videoHeight || 480;
      const scaleX = vW > 0 ? 1000 / vW : 1;
      const scaleY = vH > 0 ? 1000 / vH : 1;

      let age, gender, expressions;
      if (isDemographicsLoaded && d.age) {
          age = Math.round(d.age);
          gender = d.gender;
          expressions = d.expressions.asSortedArray();
      }

      return {
        identified,
        name,
        confidence,
        box_2d: [
          box.y * scaleY,
          box.x * scaleX,
          (box.y + box.height) * scaleY,
          (box.x + box.width) * scaleX
        ],
        age,
        gender,
        expressions
      };
    });

    return results;
  } catch (err) {
    // console.warn("Face detection pipeline skipped frame:", err);
    return [];
  }
};