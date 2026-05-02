import React, { useState, useEffect, useRef } from 'react';
import { X, Send, AlertTriangle, Coffee, Loader2, MessageSquare } from 'lucide-react';
import { debateApi } from '../services/api';

function DebateDialog({ anomaly, llmConfig, onClose }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    startDebateSession();
  }, []);

  const startDebateSession = async () => {
    if (!anomaly || !llmConfig) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await debateApi.startSession(anomaly, llmConfig);
      setSessionId(response.data.sessionId);
      setMessages(response.data.messages.filter(m => m.role !== 'system'));
    } catch (error) {
      console.error('Failed to start debate:', error);
      setMessages([{
        role: 'assistant',
        content: `⚠️ 无法启动辩论会话: ${error.response?.data?.error || error.message}\n\n请确保已正确配置大模型接口并测试连接成功。`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !sessionId) {
      return;
    }

    const userMessage = inputMessage.trim();
    setInputMessage('');
    
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await debateApi.sendMessage(sessionId, userMessage);
      setMessages(prev => [...prev, response.data.message]);
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ 发送消息失败: ${error.response?.data?.error || error.message}`
      }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getAnomalyTypeIcon = () => {
    if (anomaly?.type === 'zscore_outlier') {
      return <AlertTriangle className="w-5 h-5 text-red-400" />;
    } else if (anomaly?.type === 'latte_factor') {
      return <Coffee className="w-5 h-5 text-amber-400" />;
    }
    return <MessageSquare className="w-5 h-5 text-indigo-400" />;
  };

  const getAnomalyTitle = () => {
    if (anomaly?.type === 'zscore_outlier') {
      return `异常大额支出 - ¥${anomaly.transaction?.amount?.toFixed(2) || '0.00'}`;
    } else if (anomaly?.type === 'latte_factor') {
      return `拿铁因子 - ${anomaly.category || '未知类别'}`;
    }
    return '消费逻辑审查';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl h-[85vh] bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800/50">
          <div className="flex items-center gap-3">
            {getAnomalyTypeIcon()}
            <div>
              <h2 className="text-lg font-semibold text-white">{getAnomalyTitle()}</h2>
              <p className="text-sm text-gray-400">AI 消费逻辑审查官</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
              <p>正在初始化辩论会话...</p>
            </div>
          )}

          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-4 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-md'
                    : 'bg-gray-800 text-gray-100 border border-gray-700 rounded-bl-md'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-xs font-bold">
                      反
                    </div>
                    <span className="text-xs font-medium text-red-400">消费逻辑审查官</span>
                  </div>
                )}
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {msg.content}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-800 border border-gray-700 p-4 rounded-2xl rounded-bl-md">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                  <span className="text-sm text-gray-400">AI 正在分析...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-gray-700 bg-gray-800/50">
          <div className="flex gap-3">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="回复 AI 的审查问题，或描述你的消费决策过程..."
              className="flex-1 resize-none px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              rows={2}
              disabled={!sessionId || isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || !sessionId || isLoading}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl transition-all flex items-center justify-center"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            AI 扮演反方角色，会以批判性思维审查你的消费逻辑。按 Enter 发送，Shift+Enter 换行。
          </p>
        </div>
      </div>
    </div>
  );
}

export default DebateDialog;
