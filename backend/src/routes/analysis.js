const express = require('express');
const router = express.Router();
const analysisService = require('../services/analysisService');

router.post('/zscore', (req, res) => {
  try {
    const { transactions } = req.body;
    
    if (!transactions || !Array.isArray(transactions)) {
      return res.status(400).json({ error: 'transactions 必须是数组' });
    }

    const results = analysisService.calculateZScores(transactions);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/latte-factor', (req, res) => {
  try {
    const { transactions, threshold } = req.body;
    
    if (!transactions || !Array.isArray(transactions)) {
      return res.status(400).json({ error: 'transactions 必须是数组' });
    }

    const results = analysisService.detectLatteFactors(transactions, threshold);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/anomalies', (req, res) => {
  try {
    const { transactions } = req.body;
    
    if (!transactions || !Array.isArray(transactions)) {
      return res.status(400).json({ error: 'transactions 必须是数组' });
    }

    const results = analysisService.analyzeAnomalies(transactions);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/solar-terms', (req, res) => {
  try {
    const { transactions } = req.body;
    
    if (!transactions || !Array.isArray(transactions)) {
      return res.status(400).json({ error: 'transactions 必须是数组' });
    }

    const aggregated = analysisService.aggregateBySolarTerms(transactions);
    res.json(aggregated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/solar-terms', (req, res) => {
  try {
    const terms = analysisService.getSolarTerms();
    res.json(terms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/sample-data', (req, res) => {
  const sampleTransactions = [
    { id: 1, amount: 25.50, category: '餐饮', description: '午餐 - 麦当劳', date: '2024-01-15' },
    { id: 2, amount: 1500.00, category: '电子产品', description: '购买新耳机', date: '2024-01-18' },
    { id: 3, amount: 35.00, category: '咖啡', description: '星巴克拿铁', date: '2024-01-20' },
    { id: 4, amount: 85.00, category: '餐饮', description: '晚餐 - 火锅店', date: '2024-01-22' },
    { id: 5, amount: 28.00, category: '咖啡', description: '星巴克拿铁', date: '2024-01-23' },
    { id: 6, amount: 45.00, category: '餐饮', description: '午餐 - 寿司', date: '2024-01-25' },
    { id: 7, amount: 3200.00, category: '旅行', description: '机票预订', date: '2024-02-01' },
    { id: 8, amount: 32.00, category: '咖啡', description: '星巴克拿铁', date: '2024-02-05' },
    { id: 9, amount: 55.00, category: '餐饮', description: '晚餐 - 烧烤', date: '2024-02-10' },
    { id: 10, amount: 29.00, category: '咖啡', description: '星巴克拿铁', date: '2024-02-15' },
    { id: 11, amount: 78.00, category: '娱乐', description: '电影票', date: '2024-03-01' },
    { id: 12, amount: 260.00, category: '购物', description: '衣服', date: '2024-03-05' },
    { id: 13, amount: 30.00, category: '咖啡', description: '星巴克拿铁', date: '2024-03-10' },
    { id: 14, amount: 120.00, category: '餐饮', description: '聚餐', date: '2024-03-15' },
    { id: 15, amount: 4500.00, category: '电子产品', description: '新手机', date: '2024-04-01' },
    { id: 16, amount: 35.00, category: '咖啡', description: '星巴克拿铁', date: '2024-04-05' },
    { id: 17, amount: 28.00, category: '咖啡', description: '星巴克拿铁', date: '2024-04-10' },
    { id: 18, amount: 95.00, category: '餐饮', description: '日料', date: '2024-04-15' },
    { id: 19, amount: 32.00, category: '咖啡', description: '星巴克拿铁', date: '2024-04-20' },
    { id: 20, amount: 180.00, category: '娱乐', description: '演唱会门票', date: '2024-05-01' }
  ];
  
  res.json(sampleTransactions);
});

module.exports = router;
