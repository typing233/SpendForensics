const llmService = require('./llmService');
const { LLM_PROVIDERS } = require('./llmService');
const { v4: uuidv4 } = require('uuid');

class DebateService {
  constructor() {
    this.sessions = new Map();
  }

  createSession(anomaly, config) {
    const sessionId = uuidv4();
    
    const session = {
      id: sessionId,
      anomaly: anomaly,
      config: config,
      messages: [],
      createdAt: new Date(),
      status: 'active'
    };
    
    const systemPrompt = this.getSystemPrompt(anomaly);
    session.messages.push({
      role: 'system',
      content: systemPrompt
    });
    
    session.messages.push({
      role: 'assistant',
      content: this.getOpeningMessage(anomaly)
    });
    
    this.sessions.set(sessionId, session);
    return session;
  }

  getSystemPrompt(anomaly) {
    let context = '';
    
    if (anomaly.type === 'zscore_outlier') {
      context = `这是一笔异常大额支出，消费金额为 ¥${anomaly.transaction.amount.toFixed(2)}，
      消费描述：${anomaly.transaction.description || '未提供'}，
      消费类别：${anomaly.transaction.category || '未分类'}。
      该支出的 Z-score 为 ${anomaly.transaction.zScore?.toFixed(2)}，
      显著高于平均消费水平（均值：¥${anomaly.transaction.mean?.toFixed(2)}）。`;
    } else if (anomaly.type === 'latte_factor') {
      context = `这是一个拿铁因子类别 - "${anomaly.category}"，
      该类别总支出为 ¥${anomaly.data.totalAmount.toFixed(2)}，
      占总支出的 ${(anomaly.data.percentage * 100).toFixed(1)}%，
      共发生 ${anomaly.data.transactionCount} 笔交易，
      其中高频小额交易 ${anomaly.data.frequentSmallCount} 笔。
      典型交易示例：${anomaly.data.transactions?.slice(0, 3).map(t => t.description).join('、') || '无'}。`;
    }

    return `你是一位严格的消费逻辑审查官，扮演反方角色，专门审查消费决策中的逻辑谬误。

当前审查的消费问题：
${context}

你的任务：
1. 以批判性思维审查这笔消费/这个消费类别的逻辑合理性
2. 识别可能存在的逻辑谬误，包括但不限于：
   - 冲动消费："我想要" vs "我需要"
   - 沉没成本谬误
   - 锚定效应（打折促销陷阱）
   - 从众心理
   - 即时满足 vs 延迟满足
   - 机会成本忽视
3. 用苏格拉底式提问法引导用户反思
4. 保持专业但不刻薄，目的是帮助用户建立更好的消费习惯

回答要求：
- 用中文回复
- 每次回复要包含：1) 问题分析 2) 逻辑谬误指出（如果有）3) 反问引导
- 语气像一位严格但关心用户的财务教练`;
  }

  getOpeningMessage(anomaly) {
    if (anomaly.type === 'zscore_outlier') {
      const amount = anomaly.transaction.amount.toFixed(2);
      const description = anomaly.transaction.description || '这笔消费';
      
      return `🎯 消费逻辑审查启动

📌 异常类型：大额支出 (Z-score 异常)
💰 金额：¥${amount}
📝 描述：${description}

---

让我仔细审查这笔消费的逻辑。

**问题分析**：这笔支出明显高于你的平均消费水平。根据历史数据，你的平均单笔支出约为 ¥${anomaly.transaction.mean?.toFixed(2) || '未知'}，而这笔消费是平均值的 ${((anomaly.transaction.amount / anomaly.transaction.mean) * 100).toFixed(0)}%。

**潜在逻辑谬误**：
1. **即时满足偏差**：你是否因为一时冲动而购买？
2. **锚定效应**：是否因为"打折"或"限时优惠"而觉得划算？
3. **机会成本忽视**：这笔钱如果存下来，未来能做什么？

**反思引导**：
- 这笔购买是"需要"还是"想要"？
- 如果推迟72小时，你还会买吗？
- 同样金额的钱，有什么其他更好的用途？

请告诉我你当时的消费决策过程，我会帮你进一步分析。`;
    } else if (anomaly.type === 'latte_factor') {
      return `🎯 消费逻辑审查启动

📌 异常类型：拿铁因子
🏷️ 类别：${anomaly.category}
💰 总支出：¥${anomaly.data.totalAmount.toFixed(2)}
📊 占比：${(anomaly.data.percentage * 100).toFixed(1)}%
🔄 交易笔数：${anomaly.data.transactionCount}

---

让我仔细审查这个消费类别的逻辑。

**问题分析**：这是典型的"拿铁因子"——看似小额但高频的消费，积少成多。
- 单看每一笔可能觉得"没多少钱"
- 但累积起来是一笔可观的数目
- 每月 ¥${(anomaly.data.totalAmount / 3).toFixed(0)}，每年就是 ¥${(anomaly.data.totalAmount * 4).toFixed(0)}

**潜在逻辑谬误**：
1. **小钱效应**：认为单笔金额小就无所谓
2. **习惯成自然**：变成无意识的例行消费
3. **心理账户偏差**：把这些小钱放在"无关紧要"的账户里

**反思引导**：
- 这些消费真的让你快乐吗？还是只是习惯？
- 如果减少一半，生活质量会下降吗？
- 一年省下的钱能做什么更有价值的事？

请告诉我你对这些消费的真实感受，我会帮你进一步分析。`;
    }
    
    return '审查已启动，请描述这笔消费的背景。';
  }

  async sendMessage(sessionId, userMessage) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new Error('会话不存在或已过期');
    }
    
    session.messages.push({
      role: 'user',
      content: userMessage
    });
    
    const recentMessages = session.messages.slice(-10);
    
    try {
      const response = await llmService.generateChatCompletion(
        recentMessages,
        {
          provider: session.config.provider,
          temperature: 0.8,
          max_tokens: 1024
        }
      );
      
      session.messages.push({
        role: 'assistant',
        content: response.content
      });
      
      return {
        sessionId: sessionId,
        message: {
          role: 'assistant',
          content: response.content,
          timestamp: new Date()
        }
      };
    } catch (error) {
      throw new Error(`AI 回复失败: ${error.message}`);
    }
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  closeSession(sessionId) {
    this.sessions.delete(sessionId);
  }
}

module.exports = new DebateService();
