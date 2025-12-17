import { PersonProfile, FaceDetection } from "../types";

/**
 * REAL AI VISION ENGINE (Powered by face-api.js)
 * 真实AI视觉引擎 (基于 face-api.js / TensorFlow.js)
 */

declare const faceapi: any; // Global from CDN (in index.html)

let isCriticalModelsLoaded = false;
let isDemographicsLoaded = false; // Flag for optional models
let faceMatcher: any = null;

// Cache state to prevent rebuilding Matcher every frame
let lastDescriptorCount = -1;

// Configuration / 配置项
const CONFIG = {
  // Use jsDelivr CDN for GitHub Master branch to ensure all models (including age/gender) are available.
  // The previous URL (GitHub Pages) was missing the age_gender_model weights.
  // 使用 jsDelivr CDN 获取 GitHub Master 分支的权重，确保包含年龄/性别模型。
  MODEL_URL: 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights',
};

/**
 * Load AI Models / 加载 AI 模型
 * Uses a "Safety-First" approach: Critical models must load, extras are optional.
 * 采用“安全优先”策略：核心模型必须加载，增强模型可选。
 */
export const loadModels = async (): Promise<boolean> => {
  if (isCriticalModelsLoaded) return true;

  try {
    console.log("Loading Critical Face Models... / 正在加载核心人脸模型...");
    
    // 1. CRITICAL: Detection, Landmarks, Recognition
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(CONFIG.MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(CONFIG.MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(CONFIG.MODEL_URL)
    ]);
    
    isCriticalModelsLoaded = true;
    console.log("Critical Models Loaded. / 核心模型加载完毕。");

    // 2. OPTIONAL: Demographics (Age, Gender, Expressions)
    // We try to load these, but if they fail, we don't crash the app.
    try {
        console.log("Loading Demographic Models... / 正在加载人口统计学模型...");
        await Promise.all([
            faceapi.nets.faceExpressionNet.loadFromUri(CONFIG.MODEL_URL),
            faceapi.nets.ageGenderNet.loadFromUri(CONFIG.MODEL_URL)
        ]);
        isDemographicsLoaded = true;
        console.log("Demographics Loaded. / 人口统计学模型加载完毕。");
    } catch (demoError) {
        console.warn("Demographics failed to load (Non-fatal). / 人口统计学模型加载失败 (非致命错误)", demoError);
        // Do not set isDemographicsLoaded to true
        isDemographicsLoaded = false;
    }

    return true;
  } catch (error) {
    console.error("CRITICAL: Failed to load core models / 致命错误: 核心模型加载失败:", error);
    return false;
  }
};

/**
 * Extract Feature Vector from an Image / 从图像提取特征向量
 */
export const extractFaceDescriptor = async (imageElement: HTMLImageElement | HTMLVideoElement): Promise<Float32Array | null> => {
  if (!isCriticalModelsLoaded) await loadModels();

  const detection = await faceapi.detectSingleFace(imageElement)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) return null;
  return detection.descriptor;
};

/**
 * Build/Update the Face Matcher from Profiles
 */
const updateFaceMatcher = (profiles: PersonProfile[], threshold: number) => {
  const currentDescriptorCount = profiles.reduce((acc, p) => acc + p.descriptors.length, 0);
  
  if (currentDescriptorCount === lastDescriptorCount && faceMatcher) {
    return;
  }

  console.log(`Updating AI Matcher with ${currentDescriptorCount} vectors...`);

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
  
  if (!isCriticalModelsLoaded || !video || video.paused || video.ended) return [];

  // 1. Chain detection tasks based on available models
  // Only use models that successfully loaded
  let task = faceapi.detectAllFaces(video).withFaceLandmarks().withFaceDescriptors();
  
  if (isDemographicsLoaded) {
      task = task.withFaceExpressions().withAgeAndGender();
  }

  const detections = await task;

  if (!detections.length) return [];

  // 2. Update Matcher (passing current threshold)
  updateFaceMatcher(profiles, threshold);

  // 3. Match
  const results: FaceDetection[] = detections.map((d: any) => {
    let name = "Unknown";
    let confidence = 0;
    let identified = false;

    if (faceMatcher) {
      // Find match
      const bestMatch = faceMatcher.findBestMatch(d.descriptor);
      
      // Manual Threshold Check
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
    const scaleX = 1000 / vW;
    const scaleY = 1000 / vH;

    // 5. Extract Demographics if available
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
};