// Enum for Application Tabs/Modes
// 应用选项卡枚举
export enum AppMode {
  MONITOR = 'MONITOR', 
  ADMIN = 'ADMIN'      
}

// Global Configuration Interface
// 全局配置接口
export interface AppConfig {
  appName: string;
  appVersion: string;
  logoText: string;
  logoColor: 'cyan' | 'purple' | 'green' | 'blue' | 'red';
  defaultLang: 'en' | 'zh';
  copyrightText?: string; // New configurable copyright field
  features?: {
    showKpis?: boolean;
    [key: string]: any; // Allow for comment fields in features
  };
  // Index signature to allow for metadata/instruction fields starting with underscore
  // 索引签名，允许以下划线开头的元数据/说明字段
  [key: string]: any;
}

// Structure for a registered person
// 注册用户档案结构体
export interface PersonProfile {
  id: string;
  name: string;
  images: string[];
  createdAt: number;
  // Critical for REAL recognition: Store MULTIPLE vectors for better accuracy (ML)
  // 关键：存储多个特征向量，通过多样本学习提高准确率
  descriptors: number[][]; 
}

// Structure for a recognition log entry
// 识别日志条目结构体
export interface RecognitionLog {
  id: string;
  timestamp: number;
  personName: string; 
  confidence: number;
  isUnknown: boolean;
  // Extended Metadata for Analytics
  // 用于分析的扩展元数据
  age?: number;
  gender?: string;
  expression?: string;
}

// Structure for a single detection output
// 单次人脸检测结果结构体
export interface FaceDetection {
  identified: boolean;
  name: string;
  confidence: number;
  box_2d: number[]; // [ymin, xmin, ymax, xmax]
  // Demographics (Optional, in case model fails to load)
  // 人口统计学特征（可选，防止模型加载失败）
  age?: number;
  gender?: string;
  expressions?: { expression: string; probability: number }[];
}

// Legacy support
// 遗留接口支持
export interface IdentifyResponse {
  detections: FaceDetection[];
  reasoning: string;
}