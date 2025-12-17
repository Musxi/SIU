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

// Cache Control
let lastProfileFingerprint = ""; 

// PROMISE CACHE
let loadingPromise: Promise<boolean> | null = null;

// Configuration
const CONFIG = {
  // Priority list of Model URLs to try. 
  MODEL_URLS: [
    'https://cdn.jsdelivr.net/gh/cgarciagl/face-api.js@0.22.2/weights',
    'https://justadudewhohacks.github.io/face-api.js/models',
    'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights'
  ],
  TIMEOUT_MS: 60000 
};

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
 */
export const loadModels = (): Promise<boolean> => {
  if (typeof faceapi === 'undefined') {
    console.error("Face-api.js not loaded. Check index.html.");
    return Promise.resolve(false);
  }

  if (isCriticalModelsLoaded) return Promise.resolve(true);
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    for (const url of CONFIG.MODEL_URLS) {
      try {
        console.log(`Attempting to load models from: ${url} ...`);
        
        await withTimeout(CONFIG.TIMEOUT_MS, Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(url),
          faceapi.nets.faceLandmark68Net.loadFromUri(url),
          faceapi.nets.faceRecognitionNet.loadFromUri(url)
        ]));
        
        console.log(`✅ Success: Critical models loaded from ${url}`);
        isCriticalModelsLoaded = true;

        loadDemographicsBackground(url);
        return true;
      } catch (error) {
        console.warn(`❌ Failed to load from ${url}:`, error);
      }
    }

    console.error("CRITICAL: All model sources failed.");
    loadingPromise = null; 
    return false;
  })();

  return loadingPromise;
};

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
 * @param imageElement Video or Image element
 * @param strictMode If true, requires higher confidence (0.85) to accept the face. Used for registration.
 */
export const extractFaceDescriptor = async (
    imageElement: HTMLImageElement | HTMLVideoElement,
    strictMode: boolean = false
): Promise<{ descriptor: Float32Array; detection: any } | null> => {
  
  if (!isCriticalModelsLoaded) {
      const success = await loadModels();
      if (!success) return null;
  }

  try {
      if (imageElement instanceof HTMLVideoElement && (imageElement.paused || imageElement.ended || !imageElement.videoWidth)) {
        return null;
      }

      // Config: High confidence for registration to prevent blurry/bad samples
      const options = strictMode 
        ? new faceapi.SsdMobilenetv1Options({ minConfidence: 0.85 }) 
        : new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });

      // Use detectSingleFace for registration to ensure we get the MAIN face
      const detection = await faceapi.detectSingleFace(imageElement, options)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) return null;
      
      return { 
          descriptor: detection.descriptor,
          detection: detection.detection
      };
  } catch (e) {
      console.error("Extraction error:", e);
      return null;
  }
};

/**
 * Validate Similarity
 * Checks if a new vector matches the "centroid" of existing vectors for a person.
 * Prevents adding "dirty" data (wrong person or extreme outlier).
 */
export const isVectorValidForPerson = (
    newVector: number[], 
    existingVectors: number[][],
    tolerance: number = 0.65 // Distance threshold (Lower = Stricter)
): boolean => {
    if (!existingVectors || existingVectors.length === 0) return true;

    // Compare against all existing samples and find the best match (Nearest Neighbor)
    // If the new sample is far from ALL existing samples, it's likely bad data.
    let minDistance = 1.0;
    
    // We assume newVector and existingVectors are standard 128d arrays
    // faceapi.euclideanDistance expects Float32Array or array
    for (const v of existingVectors) {
        const dist = faceapi.euclideanDistance(newVector, v);
        if (dist < minDistance) minDistance = dist;
    }

    console.log(`🔍 Sample Consistency Check: Min Distance = ${minDistance.toFixed(3)} (Limit: ${tolerance})`);
    
    return minDistance < tolerance;
};

/**
 * Build/Update the Face Matcher
 * Now uses a stricter fingerprint check to ensure updates are applied immediately.
 */
const updateFaceMatcher = (profiles: PersonProfile[], threshold: number) => {
  if (!faceapi || !isCriticalModelsLoaded) return;

  // Create a fingerprint string based on IDs and number of descriptors
  // This ensures if a sample is added (descriptors.length changes) or a person deleted (id changes), we update.
  const currentFingerprint = profiles.map(p => `${p.id}:${p.descriptors.length}`).join('|') + `_T${threshold}`;
  
  if (currentFingerprint === lastProfileFingerprint && faceMatcher) {
    return; // Cache hit, no changes
  }

  console.log("♻️ Rebuilding Face Matcher Index...");
  
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
  
  lastProfileFingerprint = currentFingerprint;
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
    // Use slightly looser options for real-time monitoring to catch faces in motion
    const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
    
    let task = faceapi.detectAllFaces(video, options).withFaceLandmarks().withFaceDescriptors();
    
    if (isDemographicsLoaded) {
        task = task.withFaceExpressions().withAgeAndGender();
    }

    const detections = await task;
    if (!detections.length) return [];

    // 2. Update Matcher (Sync check)
    updateFaceMatcher(profiles, threshold);

    // 3. Match
    const results: FaceDetection[] = detections.map((d: any) => {
      let name = "Unknown";
      let confidence = 0;
      let identified = false;

      if (faceMatcher) {
        // Find best match in DB
        const bestMatch = faceMatcher.findBestMatch(d.descriptor);
        
        // FaceAPI distance: 0.0 (Exact) -> 1.0 (Far)
        if (bestMatch.label !== 'unknown') {
          name = bestMatch.label;
          identified = true;
          confidence = Math.round(Math.max(0, (1 - bestMatch.distance) * 100));
        } else {
           confidence = Math.round(Math.max(0, (1 - bestMatch.distance) * 100));
        }
      }

      // 4. Normalize Box for UI
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
    return [];
  }
};