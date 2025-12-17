export const translations = {
  en: {
    appTitle: "68344042-4",
    navMonitor: "MONITOR",
    navAdmin: "CONFIG", 
    confidenceStream: "REAL-TIME DATA STREAM",
    
    // Config / Admin
    configTitle: "System Configuration",
    langSelect: "Language Selection",
    tabTrain: "Face Database",
    tabStats: "Analytics",
    
    // Registration & Training
    registerTitle: "Register Identity",
    trainingTitle: "Training & Optimization",
    optimizing: "OPTIMIZING", 
    trainTips: "Add varied angles (Left, Right, Up, Down) to improve robustness.", 
    cameraStart: "Start Camera",
    cameraStop: "Stop Camera",
    cameraOff: "Camera Off",
    loadingModels: "Loading AI Models...",
    processing: "Processing...",
    extracting: "EXTRACTING FEATURE VECTORS...",
    placeholderName: "Enter Name",
    btnRegister: "Register ID",
    btnAddSample: "Add Training Sample",
    btnCancelTrain: "End Training",
    registerStep1: "1. Start Camera",
    registerStep2: "2. Enter Name",
    registerStep3: "3. Register",
    
    // Sample Management
    manageSamples: "Manage Samples",
    samplesTitle: "Sample Management",
    samplesDesc: "View and delete specific feature vectors to improve recognition quality.",
    deleteSample: "Delete Sample",
    closeModal: "Close",
    confirmDeleteProfile: "Delete this entire identity?",
    btnDelete: "Delete",
    noProfiles: "No profiles found.",
    
    // Charts & Stats
    datasetTitle: "Registered Identities",
    chartDataset: "Library Sample Count",
    chartFreq: "Recognition Frequency (Top 10)",
    chartTrend: "Confidence Trend",
    totalSamples: "Total Vectors",
    // New Chart Keys
    waitingData: "Waiting for real-time data...",
    noLogs: "No recognition logs available.",
    confName: "Confidence Score",
    detectCount: "Detections",
    
    // Table
    tableTitle: "System Logs",
    tableTime: "Time",
    tableName: "ID",
    tableConf: "Confidence",
    tableStatus: "Status",

    // Live
    statusAnalyzing: "ANALYZING",
    statusReady: "READY",
    statusWaiting: "WAITING",
    noDetections: "No Targets",
    activeLearningTitle: "Active Learning",
    activeLearningDesc: "Verify detections to enhance the dataset.",
    its: "Is this",
    confirmUpdate: "Updated profile for",
    btnAutoOn: "Auto: ON",
    btnAutoOff: "Auto: OFF",
    btnScan: "Scan",
    capturedFrame: "Captured Frame",
    
    // Alerts
    alertEnterName: "Please enter a name.",
    alertAdded: "Identity registered successfully.",
    alertSampleAdded: "New sample vector added to dataset.",
    alertNoFace: "No face detected. Please ensure good lighting.",
    dbEmpty: "Database is empty. Please register identities in the Configuration tab."
  },
  zh: {
    appTitle: "68344042-4",
    navMonitor: "实时监控",
    navAdmin: "配置",
    confidenceStream: "实时数据流",
    
    // Config / Admin
    configTitle: "系统配置",
    langSelect: "语言选择",
    tabTrain: "人脸库管理",
    tabStats: "数据分析",
    
    // Registration & Training
    registerTitle: "身份注册",
    trainingTitle: "训练与优化",
    optimizing: "正在优化", 
    trainTips: "请录入不同角度（左、右、上、下）以提高识别鲁棒性。", 
    cameraStart: "开启摄像头",
    cameraStop: "关闭摄像头",
    cameraOff: "摄像头已关闭",
    loadingModels: "正在加载 AI 模型...",
    processing: "处理中...",
    extracting: "正在提取特征向量...",
    placeholderName: "输入姓名",
    btnRegister: "注册身份",
    btnAddSample: "添加训练样本",
    btnCancelTrain: "结束训练",
    registerStep1: "1. 开启摄像头",
    registerStep2: "2. 输入姓名",
    registerStep3: "3. 点击注册",
    
    // Sample Management
    manageSamples: "管理样本",
    samplesTitle: "样本管理详情",
    samplesDesc: "查看或删除特定样本以提高识别准确率。",
    deleteSample: "删除此样本",
    closeModal: "关闭",
    confirmDeleteProfile: "确定要删除该身份及其所有数据吗？",
    btnDelete: "删除",
    noProfiles: "暂无档案。",
    
    // Charts & Stats
    datasetTitle: "已注册身份列表",
    chartDataset: "人脸库样本数量统计", 
    chartFreq: "识别频率统计 (Top 10)",
    chartTrend: "置信度趋势",
    totalSamples: "特征向量总数",
    // New Chart Keys
    waitingData: "等待实时数据...",
    noLogs: "暂无识别记录。",
    confName: "置信度评分",
    detectCount: "识别次数",
    
    // Table
    tableTitle: "系统日志",
    tableTime: "时间",
    tableName: "身份ID",
    tableConf: "置信度",
    tableStatus: "状态",

    // Live
    statusAnalyzing: "分析中",
    statusReady: "就绪",
    statusWaiting: "等待中",
    noDetections: "未检测到目标",
    activeLearningTitle: "主动学习",
    activeLearningDesc: "验证预测结果以扩充数据集。",
    its: "这是",
    confirmUpdate: "已更新档案：",
    btnAutoOn: "自动: 开",
    btnAutoOff: "自动: 关",
    btnScan: "扫描",
    capturedFrame: "捕获画面",
    
    // Alerts
    alertEnterName: "请输入姓名。",
    alertAdded: "身份注册成功。",
    alertSampleAdded: "新样本向量已添加至数据集。",
    alertNoFace: "未检测到人脸，请确保光线充足。",
    dbEmpty: "数据库为空。请在配置页面注册身份。"
  }
};

export type Language = 'en' | 'zh';