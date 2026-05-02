import React, { useState, useEffect } from 'react';
import { Settings, TestTube, Check, X, Loader2 } from 'lucide-react';
import { llmApi } from '../services/api';

const LLM_PROVIDERS = {
  openai: { name: 'OpenAI / 兼容接口', icon: '🤖' },
  ollama: { name: 'Ollama (本地)', icon: '🦙' },
  custom: { name: '自定义 OpenAI 兼容', icon: '⚙️' }
};

function LLMConfig({ onConfigSaved, currentConfig }) {
  const [provider, setProvider] = useState(currentConfig?.provider || 'openai');
  const [baseUrl, setBaseUrl] = useState(currentConfig?.baseUrl || '');
  const [apiKey, setApiKey] = useState(currentConfig?.apiKey || '');
  const [model, setModel] = useState(currentConfig?.model || '');
  const [availableModels, setAvailableModels] = useState([]);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (provider === 'openai' && !baseUrl) {
      setBaseUrl('https://api.openai.com');
    } else if (provider === 'ollama' && !baseUrl) {
      setBaseUrl('http://localhost:11434');
    }
  }, [provider]);

  const handleTestConnection = async () => {
    if (!baseUrl) {
      setTestResult({ success: false, message: '请填写 Base URL' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await llmApi.testConnection({
        provider,
        baseUrl,
        apiKey,
        model
      });

      setTestResult(response.data);
      
      if (response.data.success && response.data.availableModels) {
        setAvailableModels(response.data.availableModels);
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error.response?.data?.message || error.message
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!baseUrl) {
      setTestResult({ success: false, message: '请填写 Base URL' });
      return;
    }

    setIsSaving(true);
    try {
      await llmApi.setConfig({
        provider,
        baseUrl,
        apiKey,
        model
      });

      if (onConfigSaved) {
        onConfigSaved({ provider, baseUrl, apiKey, model });
      }

      setTestResult({ success: true, message: '配置已保存' });
    } catch (error) {
      setTestResult({
        success: false,
        message: error.response?.data?.error || '保存失败'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6 text-indigo-400" />
        <h2 className="text-xl font-semibold text-white">大模型接口配置</h2>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            选择接口类型
          </label>
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(LLM_PROVIDERS).map(([key, info]) => (
              <button
                key={key}
                onClick={() => setProvider(key)}
                className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                  provider === key
                    ? 'border-indigo-500 bg-indigo-500/20 text-white'
                    : 'border-gray-600 bg-gray-700/30 text-gray-400 hover:border-gray-500'
                }`}
              >
                <span className="text-2xl mb-2 block">{info.icon}</span>
                <span className="text-sm font-medium">{info.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Base URL
          </label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={
              provider === 'openai' 
                ? 'https://api.openai.com' 
                : provider === 'ollama'
                ? 'http://localhost:11434'
                : 'https://your-api-endpoint.com'
            }
            className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            API Key {provider === 'ollama' && <span className="text-gray-500">(可选)</span>}
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            模型名称 {availableModels.length > 0 && <span className="text-green-400">(已检测到 {availableModels.length} 个可用模型)</span>}
          </label>
          {availableModels.length > 0 ? (
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            >
              <option value="">-- 请选择模型 --</option>
              {availableModels.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={
                provider === 'openai' 
                  ? 'gpt-3.5-turbo, gpt-4, etc.' 
                  : provider === 'ollama'
                  ? 'llama2, mistral, etc.'
                  : 'your-model-name'
              }
              className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleTestConnection}
            disabled={isTesting}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTesting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                测试连接中...
              </>
            ) : (
              <>
                <TestTube className="w-5 h-5" />
                测试连接
              </>
            )}
          </button>
          <button
            onClick={handleSaveConfig}
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                保存配置
              </>
            )}
          </button>
        </div>

        {testResult && (
          <div
            className={`p-4 rounded-xl flex items-start gap-3 ${
              testResult.success
                ? 'bg-green-500/20 border border-green-500/30'
                : 'bg-red-500/20 border border-red-500/30'
            }`}
          >
            {testResult.success ? (
              <Check className="w-5 h-5 text-green-400 mt-0.5" />
            ) : (
              <X className="w-5 h-5 text-red-400 mt-0.5" />
            )}
            <div>
              <p className={`font-medium ${
                testResult.success ? 'text-green-400' : 'text-red-400'
              }`}>
                {testResult.success ? '成功' : '失败'}
              </p>
              <p className="text-sm text-gray-300 mt-1">{testResult.message}</p>
              {testResult.availableModels && testResult.availableModels.length > 0 && (
                <p className="text-sm text-gray-400 mt-1">
                  检测到 {testResult.availableModels.length} 个可用模型
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LLMConfig;
