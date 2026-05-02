const express = require('express');
const router = express.Router();
const llmService = require('../services/llmService');
const { LLM_PROVIDERS } = require('../services/llmService');

router.post('/config', (req, res) => {
  try {
    const { provider, baseUrl, apiKey, model } = req.body;
    
    if (!provider || !Object.values(LLM_PROVIDERS).includes(provider)) {
      return res.status(400).json({ 
        error: '无效的 provider，有效值: ' + Object.values(LLM_PROVIDERS).join(', ') 
      });
    }
    
    if (!baseUrl) {
      return res.status(400).json({ error: 'baseUrl 是必填项' });
    }

    llmService.setConfig(provider, { baseUrl, apiKey, model });
    
    res.json({ 
      success: true, 
      message: `${provider} 配置已保存`,
      config: { provider, baseUrl, model: model || '未设置' }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/test', async (req, res) => {
  try {
    const { provider, baseUrl, apiKey, model } = req.body;
    
    if (!provider || !baseUrl) {
      return res.status(400).json({ error: 'provider 和 baseUrl 是必填项' });
    }

    const result = await llmService.testConnection({ provider, baseUrl, apiKey, model });
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: '测试失败',
      error: error.message 
    });
  }
});

router.get('/config/:provider', (req, res) => {
  try {
    const { provider } = req.params;
    const config = llmService.getConfig(provider);
    
    if (!config) {
      return res.status(404).json({ error: `未找到 ${provider} 的配置` });
    }
    
    res.json({ 
      provider: config.provider,
      baseUrl: config.baseUrl,
      model: config.model
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/providers', (req, res) => {
  res.json({ 
    providers: Object.values(LLM_PROVIDERS),
    descriptions: {
      openai: 'OpenAI 官方 API 或兼容接口',
      ollama: 'Ollama 本地模型',
      custom: '自定义 OpenAI 兼容接口'
    }
  });
});

module.exports = router;
