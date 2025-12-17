# 68344042-4 Face Guard System Documentation / 人脸防护系统文档

## 1. Project Overview / 项目概述

**Face Guard** is a professional, browser-based real-time face recognition system. Unlike traditional solutions that rely on heavy Python backends, this project runs entirely on the client side using **TensorFlow.js**.

**Face Guard** 是一个专业的、基于浏览器的实时人脸识别系统。与依赖繁重 Python 后端的传统方案不同，本项目使用 **TensorFlow.js** 完全在客户端运行。

### Key Features / 核心特性

*   **🛡️ Privacy First / 隐私优先**
    *   All biometric data (images and feature vectors) is processed and stored locally in the browser's memory. No data is sent to any server.
    *   所有生物特征数据（图像和特征向量）均在浏览器内存中本地处理和存储。没有任何数据会被发送到服务器。

*   **🧠 Active Learning / 主动学习**
    *   Supports dynamic registration of multiple face angles for a single identity. The system learns and improves accuracy over time as you add more samples.
    *   支持为同一身份动态注册多个角度的人脸。随着样本的增加，系统会不断学习并提高识别准确率。

*   **📊 Real-time Visualization / 实时可视化**
    *   Features a responsive dashboard with live confidence streams, detection frequency charts, and recognition confidence trends.
    *   具备响应式仪表盘，提供实时置信度数据流、识别频率图表以及识别置信度趋势图。

---

## 2. Technical Principles / 技术原理

The system operates on a pipeline of three neural networks powered by `face-api.js`:
本系统基于 `face-api.js` 运行由三个神经网络组成的流水线：

### 2.1 The AI Pipeline / AI 流水线

1.  **Face Detection (SSD MobileNet V1)**
    *   **Function**: Locates the bounding box of faces in the video frame.
    *   **Mechanism**: A lightweight "Single Shot Multibox Detector" optimized for mobile and web performance.
    *   **功能**: 定位视频帧中人脸的边界框。
    *   **机制**: 针对移动端和网页性能优化的轻量级“单次多框检测器”。

2.  **Face Landmark 68 Net**
    *   **Function**: Aligns the face geometrically.
    *   **Mechanism**: Identifies 68 specific points (eyes, nose, mouth contour) to correct head rotation, ensuring the face is "looking forward" before recognition.
    *   **功能**: 对人脸进行几何对齐。
    *   **机制**: 识别68个特定关键点（眼睛、鼻子、嘴巴轮廓）以校正头部旋转，确保在识别前人脸是“朝前”的。

3.  **Face Recognition (ResNet-34)**
    *   **Function**: Extracts the unique "Fingerprint" of the face.
    *   **Mechanism**: Converts the aligned face image into a **128-dimensional floating-point vector** (e.g., `[0.12, -0.85, 0.44...]`).
    *   **功能**: 提取人脸的唯一“指纹”。
    *   **机制**: 将对齐后的人脸图像转换为一个 **128维的浮点特征向量**（例如 `[0.12, -0.85, 0.44...]`）。

### 2.2 Matching Logic / 匹配逻辑

The system identifies users by calculating the **Euclidean Distance** between the real-time vector and stored vectors.
系统通过计算实时向量与存储向量之间的 **欧氏距离** 来识别用户。

*   **Distance < 0.55**: ✅ **Match Confirmed** (System considers them the same person).
*   **Distance > 0.55**: ❌ **Unknown** (System considers them different people).
*   **Distance < 0.55**: ✅ **匹配成功**（系统认定为同一人）。
*   **Distance > 0.55**: ❌ **陌生人**（系统认定为不同人）。

**Active Learning Logic**: If a user has 5 registered samples, the system compares the live face against all 5 and picks the best match (shortest distance).
**主动学习逻辑**：如果一个用户注册了5个样本，系统会将实时人脸与这5个样本逐一比对，并选取最佳匹配（最短距离）。

---

## 3. Function Manual / 功能说明

### 3.1 Monitor Tab (Live Recognition) / 实时监控

*   **Main Viewport**: Displays the camera feed with Augmented Reality (AR) overlays.
    *   **Green Box**: Known person (Verification Success).
    *   **Red Box**: Unknown person.
*   **Right Sidebar**: A scrolling log of recent recognitions, showing the confidence level bar.
*   **主视窗**: 显示带有增强现实（AR）覆盖层的摄像头画面。
    *   **绿框**: 已知人员（验证成功）。
    *   **红框**: 陌生人。
*   **右侧边栏**: 滚动显示最近的识别记录及置信度条。

### 3.2 Config Tab (Management & Analytics) / 配置管理

This tab is divided into two sub-sections:
此标签页分为两个子部分：

#### A. Face Database / 人脸库管理
*   **Register Identity**: Input a name and capture a photo to create a new ID.
*   **Training & Optimization**: Select an existing user to add more angles (Active Learning).
*   **Manage Samples**: Click on a user's card image to view all stored vectors. You can delete specific blurry or bad samples here.
*   **注册身份**: 输入姓名并拍照以创建新ID。
*   **训练与优化**: 选择现有用户以添加更多角度（主动学习）。
*   **样本管理**: 点击用户卡片图片可查看所有存储的向量。你可以在此处删除模糊或质量差的特定样本。

#### B. Analytics / 数据分析
*   **Dataset Distribution (Pie Chart)**: Shows how many training samples each user has.
*   **Recognition Frequency (Bar Chart)**: Shows who appears most often in front of the camera.
*   **Confidence Trend (Line Chart)**: Tracks the AI's confidence score over time.
*   **数据集分布（饼图）**: 显示每位用户拥有的训练样本数量。
*   **识别频率（柱状图）**: 显示谁最常出现在镜头前。
*   **置信度趋势（折线图）**: 追踪 AI 随时间变化的置信度评分。

---

## 4. Usage Guide / 使用指南

### Step 1: Initialization / 初始化
1.  Open the application.
2.  **Wait**: The screen will show "Initializing Neural Networks". It downloads ~10MB of model weights from GitHub.
3.  **Permission**: Click "Allow" when the browser asks for camera access.
1.  打开应用。
2.  **等待**: 屏幕将显示“正在加载神经网络”。系统会从 GitHub 下载约 10MB 的模型权重。
3.  **权限**: 当浏览器请求摄像头访问权限时，点击“允许”。

### Step 2: Registration / 注册身份
1.  Switch to the **CONFIG (配置)** tab.
2.  Ensure **Face Database (人脸库管理)** is selected.
3.  Enter a name (e.g., "John") in the input box.
4.  Face the camera and click **Register ID (注册身份)**.
1.  切换到 **CONFIG (配置)** 标签页。
2.  确保选中 **Face Database (人脸库管理)**。
3.  在输入框中输入姓名（例如 "John"）。
4.  面向摄像头，点击 **Register ID (注册身份)**。

### Step 3: Optimization (Crucial Step) / 优化（关键步骤）
*To ensure the system works when you turn your head:*
*为了确保当你转头时系统也能工作：*

1.  Find your card in the list below.
2.  Click the **+ Add Training Sample (+ 添加训练样本)** button on your card.
3.  Turn your head slightly to the **Left**. Click **Add Training Sample**.
4.  Turn your head slightly to the **Right**. Click **Add Training Sample**.
5.  Repeat for **Up** and **Down**.
1.  在下方的列表中找到你的卡片。
2.  点击卡片上的 **+ Add Training Sample (+ 添加训练样本)** 按钮。
3.  将头向 **左** 微转。点击 **Add Training Sample (添加训练样本)**。
4.  将头向 **右** 微转。点击 **Add Training Sample (添加训练样本)**。
5.  对 **抬头** 和 **低头** 重复此操作。

### Step 4: Monitoring / 监控
1.  Switch back to the **MONITOR (实时监控)** tab.
2.  Walk around. The system should track your face and display your name.
1.  切换回 **MONITOR (实时监控)** 标签页。
2.  随意走动。系统应能追踪你的人脸并显示你的名字。

---

## 5. Troubleshooting / 故障排除

*   **Problem**: "Models Failed to Load" / **问题**: "模型加载失败"
    *   **Solution**: Check your internet connection. The app uses GitHub Pages CDN to fetch AI models.
    *   **解决**: 检查网络连接。应用使用 GitHub Pages CDN 获取 AI 模型。

*   **Problem**: "No Face Detected" / **问题**: "未检测到人脸"
    *   **Solution**: Ensure your face is evenly lit. Avoid strong backlighting (e.g., sitting in front of a bright window).
    *   **解决**: 确保面部光线均匀。避免强逆光（例如背对明亮的窗户坐着）。

*   **Problem**: System recognizes me as "Unknown" or the wrong person / **问题**: 系统识别为“陌生人”或认错人
    *   **Solution**:
        1.  Go to **Config** tab.
        2.  Click your photo to open the **Sample Manager**.
        3.  Delete any blurry or dark images.
        4.  Add new, clear samples using the "Training" mode.
    *   **解决**:
        1.  进入 **配置** 标签页。
        2.  点击你的照片打开 **样本管理器**。
        3.  删除任何模糊或黑暗的照片。
        4.  使用“训练”模式添加清晰的新样本。
