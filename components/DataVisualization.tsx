import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { PersonProfile, RecognitionLog } from '../types';
import { translations, Language } from '../utils/i18n';

interface DataVisualizationProps {
  profiles: PersonProfile[];
  logs: RecognitionLog[];
  lang: Language;
}

const COLORS = ['#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const DataVisualization: React.FC<DataVisualizationProps> = ({ profiles, logs, lang }) => {
  const t = translations[lang];

  // 1. Dataset Stats (Vectors per Person) / 每个人拥有的向量样本数量
  const datasetStats = profiles.map(p => ({
    name: p.name,
    value: p.descriptors.length 
  }));

  // 2. Recognition Frequency / 识别频率统计
  const recognitionCounts: Record<string, number> = {};
  
  // Initialize with existing profiles (Count 0) so the chart isn't empty on start
  // 预填充已存在的用户，确保图表不为空
  profiles.forEach(p => {
    recognitionCounts[p.name] = 0;
  });

  logs.forEach(log => {
    // We count both Unknown and Known to show system activity
    // Unknown might create a new key
    const name = log.isUnknown ? "Unknown" : log.personName;
    recognitionCounts[name] = (recognitionCounts[name] || 0) + 1;
  });
  
  // Convert to array and sort by frequency
  const recognitionStats = Object.keys(recognitionCounts)
    .map(name => ({
        name,
        count: recognitionCounts[name]
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10

  // 4. Trend Data / 趋势数据
  const trendData = [...logs].reverse().slice(-20).map((log, idx) => ({
    index: idx + 1,
    confidence: log.confidence,
    name: log.personName,
    time: new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 p-2 border border-gray-700 rounded shadow-lg text-xs">
          <p className="text-gray-300 font-bold mb-1">{label}</p>
          <p className="text-cyan-400">
             {payload[0].name}: {payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      
      {/* Top Row: Pie & Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* DATASET DISTRIBUTION / 人脸库样本统计 */}
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg flex flex-col">
          <h3 className="text-lg font-bold mb-4 text-gray-200 flex items-center justify-between">
             {t.chartDataset}
             <span className="text-xs font-normal text-gray-400 bg-gray-900 px-2 py-1 rounded border border-gray-800">
                {t.totalSamples}: {profiles.reduce((acc, p) => acc + p.descriptors.length, 0)}
             </span>
          </h3>
          <div className="h-64 flex-1 relative">
            {datasetStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                    data={datasetStats}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name} (${value})`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    >
                    {datasetStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                </PieChart>
                </ResponsiveContainer>
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 text-sm">
                    <p>{t.dbEmpty}</p>
                </div>
            )}
          </div>
        </div>

        {/* RECOGNITION FREQUENCY / 识别频率 */}
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg flex flex-col">
          <h3 className="text-lg font-bold mb-4 text-gray-200">{t.chartFreq}</h3>
          <div className="h-64 flex-1 relative">
            {recognitionStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={recognitionStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                    <XAxis dataKey="name" stroke="#9ca3af" tick={{fontSize: 12}} />
                    <YAxis stroke="#9ca3af" tick={{fontSize: 12}} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{fill: '#374151', opacity: 0.2}} />
                    <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} name={t.detectCount} />
                </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                    <p>{t.noLogs}</p>
                </div>
            )}
          </div>
        </div>
      </div>

      {/* Middle Row: Trend / 趋势图 */}
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
        <h3 className="text-lg font-bold mb-4 text-gray-200">{t.chartTrend}</h3>
        <div className="h-64 relative">
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="time" stroke="#9ca3af" tick={{fontSize: 10}} />
                <YAxis domain={[0, 100]} stroke="#9ca3af" tick={{fontSize: 10}} />
                <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} 
                    itemStyle={{ color: '#fff' }}
                />
                <Line 
                    type="monotone" 
                    dataKey="confidence" 
                    stroke="#10b981" 
                    strokeWidth={2} 
                    dot={{r: 3, fill: '#10b981'}} 
                    activeDot={{r: 5}} 
                    name={t.confName}
                />
                </LineChart>
            </ResponsiveContainer>
          ) : (
             <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                {t.waitingData}
             </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Detailed Log Table / 日志表 */}
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg overflow-hidden">
        <h3 className="text-lg font-bold mb-4 text-gray-200">{t.tableTitle}</h3>
        <div className="overflow-x-auto max-h-80">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="bg-gray-900 text-gray-200 uppercase font-medium sticky top-0">
              <tr>
                <th className="px-4 py-3">{t.tableTime}</th>
                <th className="px-4 py-3">{t.tableName}</th>
                <th className="px-4 py-3">{t.tableConf}</th>
                <th className="px-4 py-3">{t.tableStatus}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-700/50 transition">
                  <td className="px-4 py-3 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</td>
                  <td className={`px-4 py-3 font-bold ${log.isUnknown ? 'text-red-400' : 'text-white'}`}>
                      {log.personName}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-full ${log.confidence > 70 ? 'bg-green-500' : log.confidence > 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${log.confidence}%` }}></div>
                      </div>
                      <span className="font-mono">{log.confidence}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {/* FIXED: Localized Status Tags */}
                    {log.isUnknown ? (
                        <span className="px-2 py-1 rounded-full bg-red-900/50 text-red-400 text-xs border border-red-800">{t.unknown}</span>
                    ) : (
                        <span className="px-2 py-1 rounded-full bg-green-900/50 text-green-400 text-xs border border-green-800">{t.verified}</span>
                    )}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center italic text-gray-500">{t.noLogs}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DataVisualization;