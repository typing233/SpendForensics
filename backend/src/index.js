require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const llmRouter = require('./routes/llm');
const analysisRouter = require('./routes/analysis');
const debateRouter = require('./routes/debate');

app.use('/api/llm', llmRouter);
app.use('/api/analysis', analysisRouter);
app.use('/api/debate', debateRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'SpendForensics 后端服务运行中' });
});

app.listen(PORT, () => {
  console.log(`SpendForensics 后端服务运行在端口 ${PORT}`);
});
