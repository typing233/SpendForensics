import pandas as pd
import numpy as np
import plotly.graph_objects as go
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from scipy import stats


class ReportGenerator:
    def __init__(self):
        pass
    
    def generate_trend_forecast(self, df: pd.DataFrame, forecast_periods: int = 3) -> Dict:
        df = df.copy()
        df['date'] = pd.to_datetime(df['date'])
        
        expense_df = df[df['amount'] < 0].copy()
        expense_df['amount_abs'] = expense_df['amount'].abs()
        
        expense_df['month'] = expense_df['date'].dt.to_period('M')
        monthly_expense = expense_df.groupby('month')['amount_abs'].sum()
        
        if len(monthly_expense) < 2:
            return {
                'has_forecast': False,
                'message': '数据点不足，无法进行趋势预测',
                'historical_data': monthly_expense.to_dict()
            }
        
        x = np.arange(len(monthly_expense))
        y = monthly_expense.values
        
        slope, intercept, r_value, p_value, std_err = stats.linregress(x, y)
        
        future_x = np.arange(len(monthly_expense), len(monthly_expense) + forecast_periods)
        forecast_y = slope * future_x + intercept
        
        historical_periods = [p.strftime('%Y-%m') for p in monthly_expense.index]
        last_month = monthly_expense.index[-1]
        forecast_periods_labels = [
            (last_month + i + 1).strftime('%Y-%m') 
            for i in range(forecast_periods)
        ]
        
        trend_direction = "上升" if slope > 0 else "下降" if slope < 0 else "平稳"
        
        return {
            'has_forecast': True,
            'historical_periods': historical_periods,
            'historical_values': [round(v, 2) for v in monthly_expense.values],
            'forecast_periods': forecast_periods_labels,
            'forecast_values': [round(v, 2) for v in forecast_y],
            'trend_slope': round(slope, 2),
            'trend_intercept': round(intercept, 2),
            'r_squared': round(r_value ** 2, 3),
            'trend_direction': trend_direction,
            'avg_monthly_expense': round(monthly_expense.mean(), 2),
            'std_monthly_expense': round(monthly_expense.std(), 2) if len(monthly_expense) > 1 else 0
        }
    
    def create_forecast_chart(self, forecast_data: Dict) -> go.Figure:
        if not forecast_data.get('has_forecast', False):
            fig = go.Figure()
            fig.add_annotation(text=forecast_data.get('message', '暂无预测数据'), 
                              xref="paper", yref="paper", 
                              x=0.5, y=0.5, showarrow=False)
            return fig
        
        historical_periods = forecast_data['historical_periods']
        historical_values = forecast_data['historical_values']
        forecast_periods = forecast_data['forecast_periods']
        forecast_values = forecast_data['forecast_values']
        
        all_periods = historical_periods + forecast_periods
        
        fig = go.Figure()
        
        fig.add_trace(go.Scatter(
            name='历史支出',
            x=historical_periods,
            y=historical_values,
            mode='lines+markers',
            line=dict(color='#45B7D1', width=3),
            marker=dict(size=10, color='#2980B9'),
            hovertemplate='<b>%{x}</b><br>实际支出: ¥%{y:,.2f}<extra></extra>'
        ))
        
        if len(historical_values) >= 2:
            x_hist = np.arange(len(historical_values))
            slope = forecast_data.get('trend_slope', 0)
            intercept = forecast_data.get('trend_intercept', 0)
            trend_line = slope * x_hist + intercept
            
            fig.add_trace(go.Scatter(
                name='历史趋势线',
                x=historical_periods,
                y=trend_line,
                mode='lines',
                line=dict(color='#95A5A6', width=2, dash='dash'),
                hovertemplate='<b>趋势线</b><br>%{x}<br>预测值: ¥%{y:,.2f}<extra></extra>'
            ))
        
        last_hist_value = historical_values[-1]
        forecast_start = [last_hist_value] + forecast_values
        forecast_x = [historical_periods[-1]] + forecast_periods
        
        fig.add_trace(go.Scatter(
            name='预测支出',
            x=forecast_x,
            y=forecast_start,
            mode='lines+markers',
            line=dict(color='#E74C3C', width=3, dash='dot'),
            marker=dict(size=10, color='#C0392B', symbol='diamond'),
            hovertemplate='<b>预测</b><br>%{x}<br>预测支出: ¥%{y:,.2f}<extra></extra>'
        ))
        
        fig.update_layout(
            title={
                'text': '月度支出趋势预测',
                'y': 0.95,
                'x': 0.5,
                'xanchor': 'center',
                'yanchor': 'top'
            },
            xaxis_title='月份',
            yaxis_title='金额 (¥)',
            showlegend=True,
            height=450,
            margin=dict(l=20, r=20, t=80, b=40)
        )
        
        return fig
    
    def generate_leak_report(self, df: pd.DataFrame, anomalies_summary: Dict, 
                             category_summary: Dict, latte_summary: Dict,
                             forecast_data: Dict) -> Dict:
        total_expense = category_summary.get('total_expense', 0)
        total_anomaly = anomalies_summary.get('total_anomaly_amount', 0)
        total_latte = latte_summary.get('total_amount', 0)
        
        z_score_anomalies = anomalies_summary.get('z_score_anomalies', [])
        frequent_spend_anomalies = anomalies_summary.get('frequent_spend_anomalies', [])
        
        by_category = category_summary.get('by_category', {})
        high_expense_categories = []
        for cat, data in by_category.items():
            if data.get('percentage', 0) > 15:
                high_expense_categories.append({
                    'category': cat,
                    'amount': data['total_amount'],
                    'percentage': data['percentage'],
                    'count': data['transaction_count']
                })
        
        risk_level = "低"
        risk_score = 0
        
        if total_anomaly > 0:
            anomaly_ratio = total_anomaly / total_expense if total_expense > 0 else 0
            if anomaly_ratio > 0.3:
                risk_score += 3
            elif anomaly_ratio > 0.15:
                risk_score += 2
            elif anomaly_ratio > 0.05:
                risk_score += 1
        
        if total_latte > 0:
            latte_ratio = total_latte / total_expense if total_expense > 0 else 0
            if latte_ratio > 0.2:
                risk_score += 2
            elif latte_ratio > 0.1:
                risk_score += 1
        
        if len(z_score_anomalies) > 3:
            risk_score += 2
        elif len(z_score_anomalies) > 0:
            risk_score += 1
        
        if len(frequent_spend_anomalies) > 2:
            risk_score += 2
        elif len(frequent_spend_anomalies) > 0:
            risk_score += 1
        
        if forecast_data.get('trend_direction') == '上升':
            risk_score += 1
        
        if risk_score >= 6:
            risk_level = "高"
        elif risk_score >= 3:
            risk_level = "中"
        else:
            risk_level = "低"
        
        recommendations = self._generate_recommendations(
            high_expense_categories,
            z_score_anomalies,
            frequent_spend_anomalies,
            latte_summary,
            forecast_data,
            total_expense
        )
        
        return {
            'generated_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'risk_level': risk_level,
            'risk_score': risk_score,
            'summary': {
                'total_transactions': category_summary.get('transaction_count', 0),
                'total_expense': total_expense,
                'total_income': category_summary.get('total_income', 0),
                'total_anomaly_amount': total_anomaly,
                'total_latte_amount': total_latte,
                'anomaly_count': anomalies_summary.get('total_anomalies', 0),
                'z_score_anomaly_count': len(z_score_anomalies),
                'frequent_anomaly_count': len(frequent_spend_anomalies)
            },
            'high_expense_categories': high_expense_categories,
            'z_score_anomalies': z_score_anomalies,
            'frequent_spend_anomalies': frequent_spend_anomalies,
            'latte_breakdown': latte_summary.get('by_type', {}),
            'forecast': forecast_data,
            'recommendations': recommendations
        }
    
    def _generate_recommendations(self, high_expense_categories: List,
                                   z_score_anomalies: List,
                                   frequent_spend_anomalies: List,
                                   latte_summary: Dict,
                                   forecast_data: Dict,
                                   total_expense: float) -> List[Dict]:
        recommendations = []
        
        if forecast_data.get('trend_direction') == '上升':
            slope = forecast_data.get('trend_slope', 0)
            recommendations.append({
                'priority': '高',
                'category': '趋势预警',
                'title': '支出呈上升趋势',
                'description': f'根据历史数据分析，您的月度支出呈上升趋势，每月预计增加约 ¥{abs(slope):,.2f}。建议尽快审视支出结构，制定预算控制计划。',
                'potential_savings': f'如能控制趋势，每月可节省 ¥{abs(slope):,.0f} 以上'
            })
        
        for anomaly in z_score_anomalies:
            recommendations.append({
                'priority': '高',
                'category': '大额异常',
                'title': f"大额支出提醒: {anomaly.get('description', '未知')[:30]}",
                'description': f"在 {anomaly.get('date', '未知')} 有一笔大额支出 ¥{anomaly.get('amount', 0):,.2f}，Z-score 为 {anomaly.get('z_score', 0):.2f}，明显偏离您的正常消费模式。请确认此笔支出是否必要。",
                'potential_savings': f'如为非必要支出，可节省 ¥{anomaly.get("amount", 0):,.0f}'
            })
        
        for freq_anomaly in frequent_spend_anomalies:
            count = freq_anomaly.get('transaction_count', 0)
            amount = freq_anomaly.get('total_amount', 0)
            freq_type = freq_anomaly.get('type', '未知')
            
            recommendations.append({
                'priority': '中',
                'category': '高频消费',
                'title': f"高频{freq_type}消费预警",
                'description': f"您在短期内（{anomalies_summary.get('frequent_spend_days', 3)}天内）进行了 {count} 次{freq_type}消费，总金额 ¥{amount:,.2f}。这类高频小额支出容易累积成大额浪费。",
                'potential_savings': f'建议每周控制在 1-2 次，预计每月可节省 ¥{amount * 0.5:,.0f}'
            })
        
        latte_by_type = latte_summary.get('by_type', {})
        for latte_type, data in latte_by_type.items():
            amount = data.get('total_amount', 0)
            count = data.get('transaction_count', 0)
            
            if amount > total_expense * 0.1:
                recommendations.append({
                    'priority': '中',
                    'category': '拿铁因子',
                    'title': f"{latte_type}消费占比较高",
                    'description': f"您在{latte_type}上的消费为 ¥{amount:,.2f}（{count}次），占总支出的 {amount/total_expense*100:.1f}%。这是典型的\"拿铁因子\"类型支出，可以考虑优化。",
                    'potential_savings': f'如减少50%，每月可节省 ¥{amount * 0.5:,.0f}'
                })
        
        for cat in high_expense_categories:
            recommendations.append({
                'priority': '中',
                'category': '高占比类别',
                'title': f"{cat['category']}支出占比较高",
                'description': f"您在{cat['category']}上的支出为 ¥{cat['amount']:,.2f}，占总支出的 {cat['percentage']}%（{cat['count']}笔交易）。建议审视是否有优化空间。",
                'potential_savings': f'如优化10%，可节省 ¥{cat["amount"] * 0.1:,.0f}'
            })
        
        if not recommendations:
            recommendations.append({
                'priority': '低',
                'category': '健康状况',
                'title': '财务状况良好',
                'description': '您的支出模式相对健康，没有发现明显的异常或高频浪费。继续保持良好的消费习惯！',
                'potential_savings': '暂无明显可节省项目'
            })
        
        priority_order = {'高': 0, '中': 1, '低': 2}
        recommendations.sort(key=lambda x: priority_order.get(x['priority'], 3))
        
        return recommendations
