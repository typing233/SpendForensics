from typing import Dict, List, Optional
from openai import OpenAI
import json
from config import VOLCENGINE_CONFIG


class LLMService:
    def __init__(self, api_key: str = None, model: str = None, api_base: str = None):
        self.api_key = api_key
        self.model = model or VOLCENGINE_CONFIG["default_model"]
        self.api_base = api_base or VOLCENGINE_CONFIG["api_base"]
        self.client = None
        
        if self.api_key:
            self._init_client()
    
    def _init_client(self):
        if self.api_key:
            self.client = OpenAI(
                api_key=self.api_key,
                base_url=self.api_base
            )
    
    def update_config(self, api_key: str = None, model: str = None, api_base: str = None):
        if api_key:
            self.api_key = api_key
        if model:
            self.model = model
        if api_base:
            self.api_base = api_base
        
        self._init_client()
    
    def is_configured(self) -> bool:
        return self.client is not None and self.api_key is not None
    
    def generate_budget_advice(self, leak_report: Dict, max_tokens: int = 2000) -> str:
        if not self.is_configured():
            return self._generate_fallback_advice(leak_report)
        
        summary = leak_report.get('summary', {})
        high_expense_cats = leak_report.get('high_expense_categories', [])
        z_anomalies = leak_report.get('z_score_anomalies', [])
        freq_anomalies = leak_report.get('frequent_spend_anomalies', [])
        latte_breakdown = leak_report.get('latte_breakdown', {})
        forecast = leak_report.get('forecast', {})
        risk_level = leak_report.get('risk_level', '低')
        
        context = f"""
请分析以下个人账单数据，提供专业的预算优化建议：

【基本情况】
- 总交易笔数：{summary.get('total_transactions', 0)}
- 总支出：¥{summary.get('total_expense', 0):,.2f}
- 总收入：¥{summary.get('total_income', 0):,.2f}
- 净收支：¥{summary.get('total_income', 0) - summary.get('total_expense', 0):,.2f}

【风险评估】
- 风险等级：{risk_level}

【异常消费检测】
- 异常消费总额：¥{summary.get('total_anomaly_amount', 0):,.2f}
- Z-score大额异常笔数：{len(z_anomalies)}
- 高频消费异常类型数：{len(freq_anomalies)}

【大额异常详情】
"""
        
        if z_anomalies:
            for i, anomaly in enumerate(z_anomalies[:5], 1):
                context += f"{i}. {anomaly.get('description', '未知')[:50]} - ¥{anomaly.get('amount', 0):,.2f} (Z-score: {anomaly.get('z_score', 0):.2f})\n"
        
        context += "\n【高频消费详情】\n"
        if freq_anomalies:
            for i, fa in enumerate(freq_anomalies[:5], 1):
                context += f"{i}. {fa.get('type', '未知')} - {fa.get('transaction_count', 0)}次，总金额 ¥{fa.get('total_amount', 0):,.2f}\n"
        
        context += "\n【拿铁因子分析】\n"
        if latte_breakdown:
            for latte_type, data in latte_breakdown.items():
                context += f"- {latte_type}: {data.get('transaction_count', 0)}次，¥{data.get('total_amount', 0):,.2f}\n"
        
        context += "\n【趋势预测】\n"
        if forecast.get('has_forecast'):
            context += f"- 趋势方向：{forecast.get('trend_direction', '平稳')}\n"
            context += f"- R² 拟合度：{forecast.get('r_squared', 0)}\n"
            if forecast.get('forecast_values'):
                context += f"- 下月预测支出：¥{forecast['forecast_values'][0]:,.2f}\n"
        
        context += """
【输出要求】
请基于以上数据分析，按照以下格式生成专业的预算优化建议：

1. 整体财务状况评估（200字左右）
2. 主要问题分析（分点列出，每个问题包含：问题描述、影响程度、建议措施）
3. 具体削减预算建议（按优先级排序，每个建议包含：行动项、预期节省金额、执行难度）
4. 长期财务规划建议

注意：
- 语言要专业但通俗易懂
- 建议要具体、可执行
- 金额要具体，要有实际意义
- 不要使用Markdown格式，使用中文标点
"""
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "你是一位专业的个人理财顾问，擅长分析个人消费账单并提供实用的预算优化建议。"
                                   "你的建议需要具体、可执行，并且要考虑到中国的实际消费场景。"
                    },
                    {
                        "role": "user",
                        "content": context
                    }
                ],
                max_tokens=max_tokens,
                temperature=0.7
            )
            
            return response.choices[0].message.content
        
        except Exception as e:
            return f"LLM 调用失败: {str(e)}\n\n{self._generate_fallback_advice(leak_report)}"
    
    def _generate_fallback_advice(self, leak_report: Dict) -> str:
        summary = leak_report.get('summary', {})
        high_expense_cats = leak_report.get('high_expense_categories', [])
        z_anomalies = leak_report.get('z_score_anomalies', [])
        freq_anomalies = leak_report.get('frequent_spend_anomalies', [])
        latte_breakdown = leak_report.get('latte_breakdown', {})
        forecast = leak_report.get('forecast', {})
        risk_level = leak_report.get('risk_level', '低')
        recommendations = leak_report.get('recommendations', [])
        
        advice = f"""
=== 整体财务状况评估 ===

根据您的账单数据分析，您的总支出为 ¥{summary.get('total_expense', 0):,.2f}，"
总收入为 ¥{summary.get('total_income', 0):,.2f}。"

当前风险等级为：{risk_level}

=== 主要问题分析 ===

"""
        
        if z_anomalies:
            advice += "1. 存在大额异常消费\n"
            advice += f"   - 共检测到 {len(z_anomalies)} 笔大额异常支出\n"
            advice += "   - 建议：仔细核对这些支出是否为必要消费，考虑是否存在冲动消费或误消费\n\n"
        
        if freq_anomalies:
            advice += "2. 存在高频小额消费（拿铁因子）\n"
            for fa in freq_anomalies:
                advice += f"   - {fa.get('type', '未知')}：{fa.get('transaction_count', 0)}次，总金额 ¥{fa.get('total_amount', 0):,.2f}\n"
            advice += "   - 建议：这类高频小额支出容易累积成大额浪费，可以考虑设置每周/每月限额\n\n"
        
        if forecast.get('trend_direction') == '上升':
            advice += "3. 支出呈上升趋势\n"
            advice += f"   - 根据历史数据预测，您的月度支出呈上升趋势\n"
            advice += "   - 建议：尽快制定预算控制计划，遏制支出上涨势头\n\n"
        
        advice += "=== 具体削减预算建议 ===\n\n"
        
        for i, rec in enumerate(recommendations[:5], 1):
            advice += f"优先级：{rec.get('priority', '中')}\n"
            advice += f"标题：{rec.get('title', '')}\n"
            advice += f"说明：{rec.get('description', '')}\n"
            advice += f"预期节省：{rec.get('potential_savings', '')}\n\n"
        
        advice += """=== 长期财务规划建议 ===

1. 建立应急基金：建议储备3-6个月的必要支出作为应急基金
2. 制定月度预算：为每个消费类别设定预算上限，并定期跟踪执行情况
3. 强制储蓄：建议采用"先存后花"的方式，每月收入到账后先将一定比例转入储蓄账户
4. 定期复盘：每月抽出时间回顾消费情况，识别浪费并调整消费习惯
5. 投资学习：在建立应急基金后，可以考虑学习投资理财知识，让钱生钱
"""
        
        return advice
    
    def analyze_transaction_pattern(self, transactions: List[Dict]) -> str:
        if not self.is_configured():
            return "LLM 未配置，无法进行智能分析"
        
        context = f"""
请分析以下交易模式，识别潜在的消费问题和优化机会：

交易数据（最近{len(transactions)}笔）：
"""
        
        for i, t in enumerate(transactions[:20], 1):
            context += f"{i}. {t.get('date', '未知')} - {t.get('description', '未知')[:30]} - ¥{abs(t.get('amount', 0)):,.2f}\n"
        
        context += """
请分析：
1. 这些交易中是否存在明显的消费模式？
2. 有哪些可以优化的地方？
3. 有什么具体的建议？
"""
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "你是一位敏锐的消费行为分析师，擅长从交易数据中发现模式和问题。"
                    },
                    {
                        "role": "user",
                        "content": context
                    }
                ],
                max_tokens=1000,
                temperature=0.7
            )
            
            return response.choices[0].message.content
        
        except Exception as e:
            return f"分析失败: {str(e)}"
