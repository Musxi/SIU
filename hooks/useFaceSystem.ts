import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PersonProfile, RecognitionLog } from '../types';

// Initial Data / 初始数据
const INITIAL_PROFILES: PersonProfile[] = [];

/**
 * Custom Hook for Managing Face System State
 * 管理人脸系统状态的自定义 Hook
 * 
 * Handles:
 * 1. Profiles (Registered Users & Vectors) / 档案（注册用户和向量）
 * 2. Logs (Recognition History) / 日志（识别历史）
 */
export const useFaceSystem = () => {
  const [profiles, setProfiles] = useState<PersonProfile[]>(INITIAL_PROFILES);
  const [logs, setLogs] = useState<RecognitionLog[]>([]);

  /**
   * Register New Person / 注册新用户
   * Creates a new profile with the initial image and feature vector.
   * 创建包含初始照片和特征向量的新档案。
   */
  const addProfile = useCallback((name: string, image: string, descriptor?: number[]) => {
    const newProfile: PersonProfile = {
      id: uuidv4(),
      name,
      images: [image],
      createdAt: Date.now(),
      // Store array of arrays to support Active Learning (multiple angles)
      // 存储向量数组以支持主动学习（多角度样本）
      descriptors: descriptor ? [descriptor] : [] 
    };
    setProfiles(prev => [...prev, newProfile]);
    return newProfile;
  }, []);

  /**
   * Delete Profile / 删除档案
   */
  const deleteProfile = useCallback((id: string) => {
    setProfiles(prev => prev.filter(p => p.id !== id));
  }, []);

  /**
   * Active Learning: Add Sample / 主动学习：添加样本
   * 
   * Instead of overwriting, we append new vectors to the existing person.
   * This allows the AI to recognize the person from different angles or lighting.
   * 我们不是覆盖数据，而是将新的特征向量追加到现有人员档案中。
   * 这使得 AI 能够在不同角度或光线下识别该人员。
   */
  const addSampleToProfile = useCallback((id: string, image: string, descriptor: number[]) => {
    setProfiles(prev => prev.map(p => {
      if (p.id === id) {
        return { 
          ...p, 
          images: [...p.images, image], // Append Image for UI / 追加UI显示的图片
          descriptors: [...p.descriptors, descriptor] // Append Vector for AI / 追加AI使用的向量
        };
      }
      return p;
    }));
  }, []);

  /**
   * Remove specific sample / 移除特定样本
   * Used to clean up bad training data (blurry images, etc.)
   * 用于清理糟糕的训练数据（如模糊的照片）。
   */
  const removeSampleFromProfile = useCallback((profileId: string, index: number) => {
    setProfiles(prev => prev.map(p => {
      if (p.id === profileId) {
        // Create copies of arrays to avoid mutation
        // 创建数组副本以避免直接修改状态
        const newImages = [...p.images];
        const newDescriptors = [...p.descriptors];
        
        // Remove item at specific index
        // 删除指定索引的项
        newImages.splice(index, 1);
        newDescriptors.splice(index, 1);

        return {
          ...p,
          images: newImages,
          descriptors: newDescriptors
        };
      }
      return p;
    }));
  }, []);

  /**
   * Log Recognition Event / 记录识别事件
   */
  const addLog = useCallback((log: RecognitionLog) => {
    setLogs(prev => {
      // Simple debounce: Don't log same person within 1 second
      // 简单防抖：1秒内不重复记录同一人的识别结果
      if (prev.length > 0) {
        const last = prev[0];
        if (last.personName === log.personName && (log.timestamp - last.timestamp) < 1000) {
           return prev;
        }
      }
      const newLogs = [log, ...prev];
      // Keep memory usage low by limiting logs
      // 限制日志数量以保持低内存占用
      return newLogs.slice(0, 200); 
    });
  }, []);

  return {
    profiles,
    logs,
    addProfile,
    deleteProfile,
    addSampleToProfile,
    removeSampleFromProfile,
    addLog
  };
};