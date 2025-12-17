// Enum for Application Tabs/Modes
export enum AppMode {
  MONITOR = 'MONITOR', 
  ADMIN = 'ADMIN'      
}

// Structure for a registered person
export interface PersonProfile {
  id: string;
  name: string;
  images: string[];
  createdAt: number;
  // Critical for REAL recognition: Store MULTIPLE vectors for better accuracy (ML)
  // 关键：存储多个特征向量，实现多样本学习
  descriptors: number[][]; 
}

// Structure for a recognition log entry
export interface RecognitionLog {
  id: string;
  timestamp: number;
  personName: string; 
  confidence: number;
  isUnknown: boolean;
}

// Structure for a single detection output
export interface FaceDetection {
  identified: boolean;
  name: string;
  confidence: number;
  box_2d: number[]; // [ymin, xmin, ymax, xmax]
}

// Legacy support
export interface IdentifyResponse {
  detections: FaceDetection[];
  reasoning: string;
}