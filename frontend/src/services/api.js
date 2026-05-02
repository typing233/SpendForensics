import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const llmApi = {
  getProviders: () => api.get('/llm/providers'),
  
  setConfig: (config) => api.post('/llm/config', config),
  
  testConnection: (config) => api.post('/llm/test', config),
  
  getConfig: (provider) => api.get(`/llm/config/${provider}`),
};

export const analysisApi = {
  getSampleData: () => api.get('/analysis/sample-data'),
  
  analyzeAnomalies: (transactions) => api.post('/analysis/anomalies', { transactions }),
  
  calculateZScores: (transactions) => api.post('/analysis/zscore', { transactions }),
  
  detectLatteFactors: (transactions, threshold) => 
    api.post('/analysis/latte-factor', { transactions, threshold }),
  
  getSolarTerms: () => api.get('/analysis/solar-terms'),
  
  aggregateBySolarTerms: (transactions) => 
    api.post('/analysis/solar-terms', { transactions }),
};

export const debateApi = {
  startSession: (anomaly, config) => 
    api.post('/debate/start', { anomaly, config }),
  
  sendMessage: (sessionId, message) => 
    api.post('/debate/message', { sessionId, message }),
  
  getSession: (sessionId) => api.get(`/debate/${sessionId}`),
  
  closeSession: (sessionId) => api.delete(`/debate/${sessionId}`),
};

export default api;
