import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from typing import Dict, List, Optional
from datetime import datetime, timedelta


class Visualizer:
    def __init__(self):
        self.color_palette = {
            '餐饮美食': '#FF6B6B',
            '交通出行': '#4ECDC4',
            '购物消费': '#45B7D1',
            '居家生活': '#96CEB4',
            '娱乐休闲': '#FFEAA7',
            '医疗健康': '#DDA0DD',
            '教育学习': '#98D8C8',
            '投资理财': '#F7DC6F',
            '收入': '#2ECC71',
            '转账还款': '#95A5A6',
            '其他支出': '#BDC3C7'
        }
    
    def create_expense_pie_chart(self, category_summary: Dict) -> go.Figure:
        by_category = category_summary.get('by_category', {})
        
        if not by_category:
            fig = go.Figure()
            fig.add_annotation(text="暂无支出数据", xref="paper", yref="paper", 
                              x=0.5, y=0.5, showarrow=False)
            return fig
        
        categories = list(by_category.keys())
        amounts = [data['total_amount'] for data in by_category.values()]
        percentages = [data['percentage'] for data in by_category.values()]
        
        colors = [self.color_palette.get(cat, '#BDC3C7') for cat in categories]
        
        fig = go.Figure(data=[go.Pie(
            labels=categories,
            values=amounts,
            hole=0.4,
            marker_colors=colors,
            textinfo='label+percent',
            textposition='outside',
            hovertemplate='<b>%{label}</b><br>' +
                         '金额: ¥%{value:,.2f}<br>' +
                         '占比: %{percent}<extra></extra>'
        )])
        
        fig.update_layout(
            title={
                'text': '支出构成分析',
                'y': 0.95,
                'x': 0.5,
                'xanchor': 'center',
                'yanchor': 'top'
            },
            showlegend=True,
            height=500,
            margin=dict(l=20, r=20, t=80, b=20)
        )
        
        return fig
    
    def create_income_expense_bar_chart(self, df: pd.DataFrame, freq: str = 'M') -> go.Figure:
        df = df.copy()
        df['date'] = pd.to_datetime(df['date'])
        
        if freq == 'W':
            df['period'] = df['date'].dt.to_period('W').apply(lambda r: r.start_time)
        elif freq == 'M':
            df['period'] = df['date'].dt.to_period('M').apply(lambda r: r.start_time)
        else:
            df['period'] = df['date'].dt.to_period('D').apply(lambda r: r.start_time)
        
        income = df[df['amount'] > 0].groupby('period')['amount'].sum().reindex(
            df['period'].unique(), fill_value=0
        )
        expense = df[df['amount'] < 0].groupby('period')['amount'].sum().abs().reindex(
            df['period'].unique(), fill_value=0
        )
        
        periods = [p.strftime('%Y-%m-%d') if freq == 'D' else 
                  (p.strftime('%Y-%m-%d') if freq == 'W' else p.strftime('%Y-%m')) 
                  for p in income.index]
        
        fig = go.Figure()
        
        fig.add_trace(go.Bar(
            name='收入',
            x=periods,
            y=income.values,
            marker_color='#2ECC71',
            hovertemplate='<b>收入</b><br>%{x}<br>金额: ¥%{y:,.2f}<extra></extra>'
        ))
        
        fig.add_trace(go.Bar(
            name='支出',
            x=periods,
            y=expense.values,
            marker_color='#FF6B6B',
            hovertemplate='<b>支出</b><br>%{x}<br>金额: ¥%{y:,.2f}<extra></extra>'
        ))
        
        fig.update_layout(
            title={
                'text': '收支趋势对比',
                'y': 0.95,
                'x': 0.5,
                'xanchor': 'center',
                'yanchor': 'top'
            },
            barmode='group',
            xaxis_title='时间段',
            yaxis_title='金额 (¥)',
            showlegend=True,
            height=400,
            margin=dict(l=20, r=20, t=80, b=40)
        )
        
        return fig
    
    def create_category_trend_chart(self, df: pd.DataFrame, freq: str = 'W') -> go.Figure:
        df = df.copy()
        df['date'] = pd.to_datetime(df['date'])
        
        expense_df = df[df['amount'] < 0].copy()
        expense_df['amount_abs'] = expense_df['amount'].abs()
        
        if freq == 'W':
            expense_df['period'] = expense_df['date'].dt.to_period('W').apply(lambda r: r.start_time)
        elif freq == 'M':
            expense_df['period'] = expense_df['date'].dt.to_period('M').apply(lambda r: r.start_time)
        else:
            expense_df['period'] = expense_df['date'].dt.to_period('D').apply(lambda r: r.start_time)
        
        pivot_df = expense_df.pivot_table(
            index='period',
            columns='category',
            values='amount_abs',
            aggfunc='sum',
            fill_value=0
        )
        
        periods = [p.strftime('%Y-%m-%d') if freq == 'D' else 
                  (p.strftime('%Y-%m-%d') if freq == 'W' else p.strftime('%Y-%m')) 
                  for p in pivot_df.index]
        
        fig = go.Figure()
        
        for category in pivot_df.columns:
            fig.add_trace(go.Scatter(
                name=category,
                x=periods,
                y=pivot_df[category].values,
                mode='lines+markers',
                line=dict(color=self.color_palette.get(category, '#BDC3C7'), width=2),
                marker=dict(size=6),
                hovertemplate='<b>' + category + '</b><br>%{x}<br>金额: ¥%{y:,.2f}<extra></extra>'
            ))
        
        fig.update_layout(
            title={
                'text': '各类别支出趋势',
                'y': 0.95,
                'x': 0.5,
                'xanchor': 'center',
                'yanchor': 'top'
            },
            xaxis_title='时间段',
            yaxis_title='金额 (¥)',
            showlegend=True,
            height=450,
            margin=dict(l=20, r=20, t=80, b=40)
        )
        
        return fig
    
    def create_latte_factor_chart(self, latte_summary: Dict) -> go.Figure:
        by_type = latte_summary.get('by_type', {})
        
        if not by_type:
            fig = go.Figure()
            fig.add_annotation(text="暂无拿铁因子数据", xref="paper", yref="paper", 
                              x=0.5, y=0.5, showarrow=False)
            return fig
        
        types = list(by_type.keys())
        amounts = [data['total_amount'] for data in by_type.values()]
        counts = [data['transaction_count'] for data in by_type.values()]
        
        fig = make_subplots(specs=[[{"secondary_y": True}]])
        
        fig.add_trace(
            go.Bar(
                name='总金额',
                x=types,
                y=amounts,
                marker_color='#FF6B6B',
                hovertemplate='<b>%{x}</b><br>总金额: ¥%{y:,.2f}<extra></extra>'
            ),
            secondary_y=False
        )
        
        fig.add_trace(
            go.Scatter(
                name='交易次数',
                x=types,
                y=counts,
                mode='lines+markers',
                line=dict(color='#45B7D1', width=3),
                marker=dict(size=10),
                hovertemplate='<b>%{x}</b><br>交易次数: %{y}<extra></extra>'
            ),
            secondary_y=True
        )
        
        fig.update_layout(
            title={
                'text': '拿铁因子分析',
                'y': 0.95,
                'x': 0.5,
                'xanchor': 'center',
                'yanchor': 'top'
            },
            xaxis_title='消费类型',
            showlegend=True,
            height=400,
            margin=dict(l=20, r=20, t=80, b=40)
        )
        
        fig.update_yaxes(title_text='金额 (¥)', secondary_y=False)
        fig.update_yaxes(title_text='交易次数', secondary_y=True)
        
        return fig
    
    def create_anomaly_scatter_chart(self, df: pd.DataFrame) -> go.Figure:
        df = df.copy()
        df['date'] = pd.to_datetime(df['date'])
        
        expense_df = df[df['amount'] < 0].copy()
        expense_df['amount_abs'] = expense_df['amount'].abs()
        
        if expense_df.empty:
            fig = go.Figure()
            fig.add_annotation(text="暂无支出数据", xref="paper", yref="paper", 
                              x=0.5, y=0.5, showarrow=False)
            return fig
        
        normal_df = expense_df[~expense_df['is_anomaly'].fillna(False)]
        anomaly_df = expense_df[expense_df['is_anomaly'].fillna(False)]
        
        fig = go.Figure()
        
        if not normal_df.empty:
            fig.add_trace(go.Scatter(
                name='正常消费',
                x=normal_df['date'],
                y=normal_df['amount_abs'],
                mode='markers',
                marker=dict(
                    color='#45B7D1',
                    size=8,
                    opacity=0.6
                ),
                hovertemplate='<b>正常消费</b><br>' +
                             '日期: %{x}<br>' +
                             '金额: ¥%{y:,.2f}<br>' +
                             '描述: %{customdata}<extra></extra>',
                customdata=normal_df['description']
            ))
        
        if not anomaly_df.empty:
            z_score_anomaly = anomaly_df[anomaly_df['z_score_anomaly'].fillna(False)]
            freq_anomaly = anomaly_df[anomaly_df['frequent_spend_anomaly'].fillna(False)]
            
            if not z_score_anomaly.empty:
                fig.add_trace(go.Scatter(
                    name='Z-score异常（大额）',
                    x=z_score_anomaly['date'],
                    y=z_score_anomaly['amount_abs'],
                    mode='markers',
                    marker=dict(
                        color='#FF6B6B',
                        size=12,
                        symbol='triangle-up',
                        line=dict(width=2, color='#C0392B')
                    ),
                    hovertemplate='<b>Z-score异常</b><br>' +
                                 '日期: %{x}<br>' +
                                 '金额: ¥%{y:,.2f}<br>' +
                                 'Z-score: %{customdata[0]}<br>' +
                                 '描述: %{customdata[1]}<extra></extra>',
                    customdata=list(zip(
                        z_score_anomaly['z_score_value'].round(2),
                        z_score_anomaly['description']
                    ))
                ))
            
            if not freq_anomaly.empty:
                fig.add_trace(go.Scatter(
                    name='高频异常（拿铁因子）',
                    x=freq_anomaly['date'],
                    y=freq_anomaly['amount_abs'],
                    mode='markers',
                    marker=dict(
                        color='#F39C12',
                        size=10,
                        symbol='diamond',
                        line=dict(width=2, color='#E67E22')
                    ),
                    hovertemplate='<b>高频异常</b><br>' +
                                 '日期: %{x}<br>' +
                                 '金额: ¥%{y:,.2f}<br>' +
                                 '类型: %{customdata[0]}<br>' +
                                 '描述: %{customdata[1]}<extra></extra>',
                    customdata=list(zip(
                        freq_anomaly['frequent_spend_type'].fillna('未知'),
                        freq_anomaly['description']
                    ))
                ))
        
        fig.update_layout(
            title={
                'text': '异常消费检测分布',
                'y': 0.95,
                'x': 0.5,
                'xanchor': 'center',
                'yanchor': 'top'
            },
            xaxis_title='日期',
            yaxis_title='金额 (¥)',
            showlegend=True,
            height=450,
            margin=dict(l=20, r=20, t=80, b=40)
        )
        
        return fig
    
    def create_monthly_comparison_chart(self, df: pd.DataFrame) -> go.Figure:
        df = df.copy()
        df['date'] = pd.to_datetime(df['date'])
        
        df['month'] = df['date'].dt.to_period('M')
        
        expense_df = df[df['amount'] < 0].copy()
        expense_df['amount_abs'] = expense_df['amount'].abs()
        
        monthly_expense = expense_df.groupby('month')['amount_abs'].sum()
        monthly_income = df[df['amount'] > 0].groupby('month')['amount'].sum()
        
        months = [p.strftime('%Y-%m') for p in monthly_expense.index]
        
        fig = go.Figure()
        
        fig.add_trace(go.Bar(
            name='月度支出',
            x=months,
            y=monthly_expense.values,
            marker_color='#FF6B6B',
            hovertemplate='<b>%{x}</b><br>支出: ¥%{y:,.2f}<extra></extra>'
        ))
        
        if len(monthly_expense) >= 2:
            changes = monthly_expense.pct_change() * 100
            
            fig.add_trace(go.Scatter(
                name='环比变化',
                x=months,
                y=changes.values,
                mode='lines+markers',
                line=dict(color='#95A5A6', width=2, dash='dash'),
                marker=dict(size=8),
                hovertemplate='<b>%{x}</b><br>环比: %{y:.1f}%<extra></extra>'
            ))
        
        fig.update_layout(
            title={
                'text': '月度支出对比与环比变化',
                'y': 0.95,
                'x': 0.5,
                'xanchor': 'center',
                'yanchor': 'top'
            },
            xaxis_title='月份',
            yaxis_title='金额 (¥)',
            showlegend=True,
            height=400,
            margin=dict(l=20, r=20, t=80, b=40)
        )
        
        return fig
