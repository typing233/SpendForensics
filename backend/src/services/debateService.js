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
    
    this.sessions.set(sessionId, session);
    return session;
  }

  async generateOpeningMessage(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('会话不存在');
    }

    const openingRequest = this.getOpeningRequest(session.anomaly);
    session.messages.push({
      role: 'user',
      content: openingRequest
    });

    try {
      const response = await llmService.generateChatCompletion(
        session.messages,
        {
          provider: session.config.provider,
          temperature: 0.85,
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
      const fallback = this.getFallbackOpening(session.anomaly);
      session.messages.push({
        role: 'assistant',
        content: fallback
      });
      return {
        sessionId: sessionId,
        message: {
          role: 'assistant',
          content: fallback,
          timestamp: new Date()
        }
      };
    }
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

  getOpeningRequest(anomaly) {
    if (anomaly.type === 'zscore_outlier') {
      const amount = anomaly.transaction.amount.toFixed(2);
      const description = anomaly.transaction.description || '未提供描述';
      const category = anomaly.transaction.category || '未分类';
      const meanVal = anomaly.transaction.mean?.toFixed(2) || '未知';
      const zVal = anomaly.transaction.zScore?.toFixed(2) || '未知';
      
      return `请立即对以下异常消费进行个性化审查，直接给出你的审查意见。不要使用模板化语言，要像一位真实的财务教练在审视一笔具体消费那样说话。

消费详情：
- 金额：¥${amount}
- 描述：${description}
- 类别：${category}
- Z-score：${zVal}（远超正常范围）
- 历史均值：¥${meanVal}

请从以下角度给出你的个性化审查：
1. 针对这笔具体消费的质疑（不要泛泛而谈）
2. 指出最可能存在的1-2个逻辑谬误（结合消费描述判断）
3. 用一个犀利但真诚的反问结束

注意：语气要像真人，不要用列表模板，不要用emoji标题行。`;
    } else if (anomaly.type === 'latte_factor') {
      const category = anomaly.category || '未知类别';
      const totalAmount = anomaly.data.totalAmount.toFixed(2);
      const percentage = (anomaly.data.percentage * 100).toFixed(1);
      const count = anomaly.data.transactionCount;
      const examples = anomaly.data.transactions?.slice(0, 3).map(t => t.description).join('、') || '无';
      
      return `请立即对以下拿铁因子消费类别进行个性化审查，直接给出你的审查意见。不要使用模板化语言，要像一位真实的财务教练在审视一种消费习惯那样说话。

消费类别详情：
- 类别：${category}
- 总支出：¥${totalAmount}
- 占总支出比例：${percentage}%
- 交易笔数：${count}
- 典型消费：${examples}

请从以下角度给出你的个性化审查：
1. 针对这个具体类别的质疑（结合典型消费示例判断）
2. 揭示这种消费模式最可能的逻辑陷阱
3. 用一个让人深思的反问结束

注意：语气要像真人，不要用列表模板，不要用emoji标题行。`;
    }
    
    return '请对这笔消费进行审查。';
  }

  getFallbackOpening(anomaly) {
    if (anomaly.type === 'zscore_outlier') {
      const amount = anomaly.transaction.amount.toFixed(2);
      const description = anomaly.transaction.description || '这笔消费';
      return `我注意到了一笔需要审查的消费——${description}，金额 ¥${amount}。这个数字明显高于你的日常消费水平，我想听听你做这个决定时的想法。是真正需要，还是某个瞬间觉得"应该买"？`;
    } else if (anomaly.type === 'latte_factor') {
      const category = anomaly.category || '这个类别';
      const totalAmount = anomaly.data.totalAmount.toFixed(2);
      return `${category}的累计支出达到了 ¥${totalAmount}，这个数字可能比你直觉感受到的要大。我想了解一下，这些消费中有多少是你真正享受的，有多少只是习惯使然？`;
    }
    return '请告诉我这笔消费的背景，我来帮你审查。';
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
