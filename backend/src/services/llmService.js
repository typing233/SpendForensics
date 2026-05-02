const axios = require('axios');

const LLM_PROVIDERS = {
  OPENAI: 'openai',
  OLLAMA: 'ollama',
  CUSTOM: 'custom'
};

class LLMService {
  constructor() {
    this.configs = new Map();
  }

  setConfig(provider, config) {
    this.configs.set(provider, {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey || '',
      model: config.model,
      provider: provider
    });
  }

  getConfig(provider) {
    return this.configs.get(provider);
  }

  async testConnection(config) {
    const { baseUrl, apiKey, model, provider } = config;
    
    try {
      let testUrl, headers;
      
      switch (provider) {
        case LLM_PROVIDERS.OPENAI:
          testUrl = `${baseUrl}/v1/models`;
          headers = { 'Authorization': `Bearer ${apiKey}` };
          break;
        case LLM_PROVIDERS.OLLAMA:
          testUrl = `${baseUrl}/api/tags`;
          headers = {};
          break;
        case LLM_PROVIDERS.CUSTOM:
        default:
          testUrl = `${baseUrl}/v1/models`;
          headers = apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {};
          break;
      }

      const response = await axios.get(testUrl, {
        headers,
        timeout: 10000
      });

      return {
        success: true,
        message: `连接成功到 ${provider}`,
        availableModels: this.extractModels(response.data, provider)
      };
    } catch (error) {
      return {
        success: false,
        message: `连接失败: ${error.message}`,
        error: error.response?.data || error.message
      };
    }
  }

  extractModels(data, provider) {
    switch (provider) {
      case LLM_PROVIDERS.OPENAI:
      case LLM_PROVIDERS.CUSTOM:
        return data.data?.map(m => m.id) || [];
      case LLM_PROVIDERS.OLLAMA:
        return data.models?.map(m => m.name) || [];
      default:
        return [];
    }
  }

  async generateChatCompletion(messages, options = {}) {
    const provider = options.provider || LLM_PROVIDERS.OPENAI;
    const config = this.configs.get(provider);
    
    if (!config) {
      throw new Error(`未找到 ${provider} 的配置，请先配置大模型接口`);
    }

    const { baseUrl, apiKey, model } = config;
    const requestBody = {
      model: options.model || model,
      messages: messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.max_tokens || 2048
    };

    let url, headers;
    
    switch (provider) {
      case LLM_PROVIDERS.OLLAMA:
        url = `${baseUrl}/api/chat`;
        headers = { 'Content-Type': 'application/json' };
        requestBody.stream = false;
        break;
      case LLM_PROVIDERS.OPENAI:
      case LLM_PROVIDERS.CUSTOM:
      default:
        url = `${baseUrl}/v1/chat/completions`;
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        };
        break;
    }

    try {
      const response = await axios.post(url, requestBody, {
        headers,
        timeout: 60000
      });

      return this.parseResponse(response.data, provider);
    } catch (error) {
      throw new Error(`大模型调用失败: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  parseResponse(data, provider) {
    switch (provider) {
      case LLM_PROVIDERS.OLLAMA:
        return {
          content: data.message?.content,
          role: data.message?.role,
          model: data.model
        };
      case LLM_PROVIDERS.OPENAI:
      case LLM_PROVIDERS.CUSTOM:
      default:
        const choice = data.choices?.[0];
        return {
          content: choice?.message?.content,
          role: choice?.message?.role,
          model: data.model,
          usage: data.usage
        };
    }
  }
}

module.exports = new LLMService();
module.exports.LLM_PROVIDERS = LLM_PROVIDERS;
