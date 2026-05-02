const express = require('express');
const router = express.Router();
const debateService = require('../services/debateService');

router.post('/start', (req, res) => {
  try {
    const { anomaly, config } = req.body;
    
    if (!anomaly) {
      return res.status(400).json({ error: 'anomaly 是必填项' });
    }
    
    if (!config || !config.provider) {
      return res.status(400).json({ error: 'config 和 provider 是必填项' });
    }

    const session = debateService.createSession(anomaly, config);
    
    res.json({
      sessionId: session.id,
      anomaly: session.anomaly,
      messages: session.messages.filter(m => m.role !== 'system')
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/message', async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId 是必填项' });
    }
    
    if (!message) {
      return res.status(400).json({ error: 'message 是必填项' });
    }

    const response = await debateService.sendMessage(sessionId, message);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = debateService.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: '会话不存在或已过期' });
    }
    
    res.json({
      sessionId: session.id,
      anomaly: session.anomaly,
      messages: session.messages.filter(m => m.role !== 'system'),
      status: session.status,
      createdAt: session.createdAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    debateService.closeSession(sessionId);
    
    res.json({ success: true, message: '会话已关闭' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
