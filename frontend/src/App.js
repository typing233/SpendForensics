import React, { useState, useEffect } from 'react';
import { Settings, BarChart3, PieChart, AlertTriangle, Coffee, MessageSquare, Zap } from 'lucide-react';
import LLMConfig from './components/LLMConfig';
import DebateDialog from './components/DebateDialog';
import ScrollytellingSandbox from './components/ScrollytellingSandbox';
import SolarTermsChart from './components/SolarTermsChart';
import { analysisApi } from './services/api';

const TAB_ICONS = {
  config: Settings,
  anomalies: AlertTriangle,
  sandbox: BarChart3,
  solarterms: PieChart
};

const TAB_LABELS = {
  config: '模型配置',
  anomalies: '异常检测',
  sandbox: '资金沙盘',
  solarterms: '节气图谱'
};

function App() {
  const [activeTab, setActiveTab] = useState('anomalies');
  const [llmConfig, setLlmConfig] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [selectedAnomaly, setSelectedAnomaly] = useState(null);
  const [solarTermsData, setSolarTermsData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadSampleData();
  }, []);

  const loadSampleData = async () => {
    setIsLoading(true);
    try {
      const response = await analysisApi.getSampleData();
      setTransactions(response.data);
      
      const analysisResponse = await analysisApi.analyzeAnomalies(response.data);
      setAnalysisResult(analysisResponse.data);
      
      const solarResponse = await analysisApi.aggregateBySolarTerms(response.data);
      setSolarTermsData(solarResponse.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigSaved = (config) => {
    setLlmConfig(config);
  };

  const handleStartDebate = (anomaly) => {
    if (!llmConfig) {
      setActiveTab('config');
      return;
    }
    setSelectedAnomaly(anomaly);
  };

  const renderAnomaliesSection = () => {
    if (!analysisResult) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">正在分析数据...</p>
          </div>
        </div>
      );
    }

    const { zScoreAnalysis, latteFactorAnalysis, anomalies } = analysisResult;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-indigo-500/20 rounded-lg">
                <BarChart3 className="w-5 h-5 text-indigo-400" />
              </div>
              <span className="text-gray-400 text-sm">总交易笔数</span>
            </div>
            <p className="text-3xl font-bold text-white">
              {zScoreAnalysis.stats.totalTransactions}
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <span className="text-gray-400 text-sm">Z-score 异常</span>
            </div>
            <p className="text-3xl font-bold text-red-400">
              {zScoreAnalysis.stats.outlierCount}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              均值: ¥{zScoreAnalysis.stats.mean?.toFixed(2) || '0.00'}
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Coffee className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-gray-400 text-sm">拿铁因子</span>
            </div>
            <p className="text-3xl font-bold text-amber-400">
              {latteFactorAnalysis.factors.length}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              总计: ¥{latteFactorAnalysis.totalLatteAmount?.toFixed(2) || '0.00'}
            </p>
          </div>
        </div>

        {anomalies && anomalies.length > 0 && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                检测到的异常项目
              </h3>
              <span className="px-3 py-1 bg-red-500/20 text-red-400 text-sm rounded-full">
                {anomalies.length} 项待审查
              </span>
            </div>

            <div className="space-y-3">
              {anomalies.map((anomaly, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-xl border transition-all hover:bg-gray-700/30 ${
                    anomaly.severity === 'high'
                      ? 'border-red-500/30 bg-red-500/5'
                      : 'border-amber-500/30 bg-amber-500/5'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg mt-1 ${
                        anomaly.type === 'zscore_outlier'
                          ? 'bg-red-500/20'
                          : 'bg-amber-500/20'
                      }`}>
                        {anomaly.type === 'zscore_outlier' ? (
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                        ) : (
                          <Coffee className="w-4 h-4 text-amber-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            anomaly.severity === 'high'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {anomaly.severity === 'high' ? '高风险' : '中风险'}
                          </span>
                          <span className="text-sm font-medium text-white">
                            {anomaly.type === 'zscore_outlier' ? '大额支出' : '拿铁因子'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300">{anomaly.description}</p>
                        {anomaly.type === 'zscore_outlier' && (
                          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                            <span>金额: ¥{anomaly.transaction?.amount?.toFixed(2)}</span>
                            <span>Z-score: {anomaly.transaction?.zScore?.toFixed(2)}</span>
                            <span>类别: {anomaly.transaction?.category || '其他'}</span>
                          </div>
                        )}
                        {anomaly.type === 'latte_factor' && (
                          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                            <span>总支出: ¥{anomaly.data?.totalAmount?.toFixed(2)}</span>
                            <span>占比: {(anomaly.data?.percentage * 100)?.toFixed(1)}%</span>
                            <span>交易笔数: {anomaly.data?.transactionCount}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleStartDebate(anomaly)}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" />
                      {llmConfig ? '开始辩论' : '配置模型'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {zScoreAnalysis.outliers && zScoreAnalysis.outliers.length > 0 && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Z-score 异常交易详情
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">描述</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">类别</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-gray-400 uppercase">金额</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-gray-400 uppercase">Z-score</th>
                    <th className="text-center py-3 px-4 text-xs font-medium text-gray-400 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {zScoreAnalysis.outliers.map((tx, index) => (
                    <tr key={index} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                      <td className="py-3 px-4 text-white">{tx.description || '-'}</td>
                      <td className="py-3 px-4 text-gray-300">{tx.category || '其他'}</td>
                      <td className="py-3 px-4 text-right font-semibold text-red-400">
                        ¥{tx.amount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="px-2 py-1 bg-red-500/20 text-red-400 text-sm rounded">
                          {tx.zScore?.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleStartDebate({
                            type: 'zscore_outlier',
                            severity: Math.abs(tx.zScore) > 3 ? 'high' : 'medium',
                            transaction: tx,
                            description: `Z-score 异常: Z值为 ${tx.zScore?.toFixed(2)}`
                          })}
                          className="text-indigo-400 hover:text-indigo-300 text-sm"
                        >
                          审查
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900/20 to-gray-900">
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <span className="text-xl">💰</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">SpendForensics</h1>
                <p className="text-xs text-gray-400">v2.0 - 智能消费分析系统</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${
                llmConfig ? 'bg-green-400' : 'bg-gray-500'
              }`} />
              <span className="text-sm text-gray-400">
                {llmConfig ? `已连接: ${llmConfig.provider}` : '未配置模型'}
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800">
          <div className="max-w-7xl mx-auto px-6">
            <nav className="flex gap-1">
              {Object.entries(TAB_LABELS).map(([key, label]) => {
                const Icon = TAB_ICONS[key];
                return (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 ${
                      activeTab === key
                        ? 'text-white border-indigo-500 bg-indigo-500/10'
                        : 'text-gray-400 border-transparent hover:text-white hover:bg-gray-800/50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'config' && (
          <LLMConfig
            onConfigSaved={handleConfigSaved}
            currentConfig={llmConfig}
          />
        )}

        {activeTab === 'anomalies' && (
          <div className="space-y-6">
            {!llmConfig && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <div>
                  <p className="text-amber-200 font-medium">尚未配置大模型</p>
                  <p className="text-amber-300/70 text-sm">
                    请先在"模型配置"页面配置大模型接口，才能使用 AI 辩论功能。
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('config')}
                  className="ml-auto px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-sm font-medium rounded-lg transition-colors"
                >
                  去配置
                </button>
              </div>
            )}
            {renderAnomaliesSection()}
          </div>
        )}

        {activeTab === 'sandbox' && (
          <ScrollytellingSandbox transactions={transactions} />
        )}

        {activeTab === 'solarterms' && (
          <SolarTermsChart solarTermsData={solarTermsData} />
        )}
      </main>

      {selectedAnomaly && (
        <DebateDialog
          anomaly={selectedAnomaly}
          llmConfig={llmConfig}
          onClose={() => setSelectedAnomaly(null)}
        />
      )}
    </div>
  );
}

export default App;
