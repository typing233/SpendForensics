import streamlit as st
import pandas as pd
import numpy as np
from datetime import datetime
import plotly.express as px
import plotly.graph_objects as go

from data_parser import CSVParser
from classifier import TransactionClassifier
from anomaly_detector import AnomalyDetector
from visualizer import Visualizer
from report_generator import ReportGenerator
from llm_service import LLMService
from config import VOLCENGINE_CONFIG, Z_SCORE_THRESHOLD, FREQUENT_SPEND_DAYS, MIN_FREQUENT_COUNT

st.set_page_config(
    page_title="SpendForensics - 个人账单分析助手",
    page_icon="💰",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.markdown("""
<style>
    .main-header {
        font-size: 2.5rem;
        font-weight: bold;
        color: #1f77b4;
        margin-bottom: 1rem;
    }
    .sub-header {
        font-size: 1.5rem;
        font-weight: bold;
        color: #2c3e50;
        margin-bottom: 0.5rem;
    }
    .metric-card {
        background-color: #f8f9fa;
        border-radius: 10px;
        padding: 1rem;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .risk-high {
        background-color: #fee;
        border-left: 5px solid #dc3545;
    }
    .risk-medium {
        background-color: #fff3cd;
        border-left: 5px solid #ffc107;
    }
    .risk-low {
        background-color: #d4edda;
        border-left: 5px solid #28a745;
    }
    .anomaly-highlight {
        background-color: #fff3f3;
        border-radius: 5px;
        padding: 0.5rem;
        margin: 0.25rem 0;
    }
</style>
""", unsafe_allow_html=True)

def init_session_state():
    if 'df' not in st.session_state:
        st.session_state.df = None
    if 'classified_df' not in st.session_state:
        st.session_state.classified_df = None
    if 'anomalies_df' not in st.session_state:
        st.session_state.anomalies_df = None
    if 'category_summary' not in st.session_state:
        st.session_state.category_summary = None
    if 'latte_summary' not in st.session_state:
        st.session_state.latte_summary = None
    if 'anomalies_summary' not in st.session_state:
        st.session_state.anomalies_summary = None
    if 'leak_report' not in st.session_state:
        st.session_state.leak_report = None
    if 'forecast_data' not in st.session_state:
        st.session_state.forecast_data = None
    if 'llm_service' not in st.session_state:
        st.session_state.llm_service = LLMService()
    if 'llm_advice' not in st.session_state:
        st.session_state.llm_advice = None
    if 'api_key' not in st.session_state:
        st.session_state.api_key = ''
    if 'selected_model' not in st.session_state:
        st.session_state.selected_model = VOLCENGINE_CONFIG['default_model']
    if 'z_score_threshold' not in st.session_state:
        st.session_state.z_score_threshold = Z_SCORE_THRESHOLD
    if 'frequent_spend_days' not in st.session_state:
        st.session_state.frequent_spend_days = FREQUENT_SPEND_DAYS
    if 'min_frequent_count' not in st.session_state:
        st.session_state.min_frequent_count = MIN_FREQUENT_COUNT

def sidebar_config():
    with st.sidebar:
        st.markdown("## ⚙️ 设置")
        
        with st.expander("🔑 火山方舟 LLM 配置", expanded=True):
            api_key = st.text_input(
                "API Key",
                type="password",
                value=st.session_state.api_key,
                placeholder="请输入火山方舟 API Key"
            )
            st.session_state.api_key = api_key
            
            selected_model = st.selectbox(
                "选择模型",
                options=VOLCENGINE_CONFIG['available_models'],
                index=VOLCENGINE_CONFIG['available_models'].index(st.session_state.selected_model) 
                if st.session_state.selected_model in VOLCENGINE_CONFIG['available_models'] else 0
            )
            st.session_state.selected_model = selected_model
            
            if st.button("更新 LLM 配置"):
                if api_key:
                    st.session_state.llm_service.update_config(
                        api_key=api_key,
                        model=selected_model
                    )
                    st.success("配置已更新！")
                else:
                    st.warning("请输入 API Key")
            
            st.markdown("""
            <small>
            💡 如何获取 API Key：<br>
            1. 访问 <a href="https://www.volcengine.com/product/ark" target="_blank">火山方舟</a><br>
            2. 注册账号并完成实名认证<br>
            3. 进入控制台 → API Key 管理 → 创建新 Key
            </small>
            """, unsafe_allow_html=True)
        
        with st.expander("📊 异常检测参数", expanded=False):
            z_score = st.slider(
                "Z-score 异常阈值",
                min_value=1.0,
                max_value=5.0,
                value=st.session_state.z_score_threshold,
                step=0.5,
                help="Z-score 越大，检测越宽松"
            )
            st.session_state.z_score_threshold = z_score
            
            freq_days = st.slider(
                "高频消费时间窗口（天）",
                min_value=1,
                max_value=7,
                value=st.session_state.frequent_spend_days,
                help="在多少天内视为高频"
            )
            st.session_state.frequent_spend_days = freq_days
            
            min_count = st.slider(
                "高频消费最小次数",
                min_value=3,
                max_value=10,
                value=st.session_state.min_frequent_count,
                help="达到多少次视为高频"
            )
            st.session_state.min_frequent_count = min_count

def main():
    init_session_state()
    sidebar_config()
    
    st.markdown('<h1 class="main-header">💰 SpendForensics</h1>', unsafe_allow_html=True)
    st.markdown("### 智能个人账单分析助手 - 发现隐藏的资金泄漏")
    
    tab1, tab2, tab3, tab4, tab5 = st.tabs([
        "📁 数据上传",
        "📊 收支分析",
        "🔍 异常检测",
        "📋 资金泄漏简报",
        "🤖 AI 预算建议"
    ])
    
    parser = CSVParser()
    classifier = TransactionClassifier()
    visualizer = Visualizer()
    report_gen = ReportGenerator()
    
    with tab1:
        upload_data_tab(parser)
    
    with tab2:
        if st.session_state.classified_df is not None:
            expense_analysis_tab(classifier, visualizer)
        else:
            st.info("请先上传并处理账单数据")
    
    with tab3:
        if st.session_state.anomalies_df is not None:
            anomaly_detection_tab(visualizer)
        else:
            st.info("请先上传并处理账单数据")
    
    with tab4:
        if st.session_state.leak_report is not None:
            leak_report_tab(report_gen)
        else:
            st.info("请先上传并处理账单数据")
    
    with tab5:
        if st.session_state.leak_report is not None:
            ai_advice_tab()
        else:
            st.info("请先上传并处理账单数据")

def upload_data_tab(parser: CSVParser):
    st.markdown('<h2 class="sub-header">📁 上传账单数据</h2>', unsafe_allow_html=True)
    
    st.markdown("### 方式一：上传您的 CSV 账单文件")
    st.caption("支持各大银行和信用卡导出的标准 CSV 流水格式")
    
    uploaded_file = st.file_uploader(
        "选择 CSV 文件",
        type=['csv'],
        help="文件应包含：日期、交易描述/摘要、金额、收支类型等列",
        label_visibility="collapsed"
    )
    
    if uploaded_file is not None:
        try:
            with st.spinner("正在解析数据..."):
                df = parser.parse_csv(uploaded_file)
                process_data(df)
            st.success(f"✅ 数据处理完成！共 {len(df)} 条记录")
        
        except Exception as e:
            st.error(f"❌ 数据解析失败: {str(e)}")
    
    st.markdown("---")
    
    st.markdown("### 方式二：使用示例数据体验")
    st.caption("点击下方按钮加载预设的示例账单数据，快速体验所有功能")
    
    col1, col2, col3 = st.columns([1, 2, 1])
    
    with col2:
        use_sample = st.button(
            "📊 加载示例数据", 
            type="primary",
            use_container_width=True
        )
        
        if use_sample:
            with st.spinner("正在加载示例数据..."):
                sample_df = parser.get_sample_data()
                process_data(sample_df)
            st.success("✅ 示例数据加载完成！")
    
    st.markdown("""
    <div style="background-color: #f0f8ff; padding: 1rem; border-radius: 10px; margin-top: 1rem;">
        <h4 style="margin: 0 0 0.5rem 0; color: #1f77b4;">💡 提示</h4>
        <ul style="margin: 0; padding-left: 1.5rem;">
            <li>示例数据包含各种消费类型、异常消费和拿铁因子场景</li>
            <li>您可以先使用示例数据熟悉功能，再上传自己的账单</li>
            <li>支持的银行：招商银行、工商银行、建设银行、支付宝、微信支付等导出的 CSV</li>
        </ul>
    </div>
    """, unsafe_allow_html=True)
    
    if st.session_state.df is not None:
        st.markdown("---")
        st.markdown("### 📋 数据预览")
        
        display_df = st.session_state.df.copy()
        display_df['amount'] = display_df['amount'].apply(lambda x: f"¥{abs(x):,.2f}" if x < 0 else f"¥{x:,.2f}")
        display_df['date'] = display_df['date'].dt.strftime('%Y-%m-%d')
        
        st.dataframe(
            display_df[['date', 'description', 'amount', 'transaction_type']].head(20),
            use_container_width=True
        )
        
        st.info(f"共 {len(st.session_state.df)} 条记录")

def process_data(df: pd.DataFrame):
    st.session_state.df = df
    
    classifier = TransactionClassifier()
    
    with st.spinner("正在分类交易..."):
        classified_df = classifier.classify_transactions(df)
        st.session_state.classified_df = classified_df
        
        category_summary = classifier.get_category_summary(classified_df)
        st.session_state.category_summary = category_summary
        
        latte_summary = classifier.get_latte_factor_summary(classified_df)
        st.session_state.latte_summary = latte_summary
    
    with st.spinner("正在检测异常..."):
        detector = AnomalyDetector(
            z_score_threshold=st.session_state.z_score_threshold,
            frequent_spend_days=st.session_state.frequent_spend_days,
            min_frequent_count=st.session_state.min_frequent_count
        )
        anomalies_df, anomalies_summary = detector.detect_anomalies(classified_df)
        st.session_state.anomalies_df = anomalies_df
        st.session_state.anomalies_summary = anomalies_summary
    
    report_gen = ReportGenerator()
    
    with st.spinner("正在生成报告..."):
        forecast_data = report_gen.generate_trend_forecast(classified_df)
        st.session_state.forecast_data = forecast_data
        
        leak_report = report_gen.generate_leak_report(
            anomalies_df,
            anomalies_summary,
            category_summary,
            latte_summary,
            forecast_data
        )
        st.session_state.leak_report = leak_report
    
    st.session_state.llm_advice = None

def expense_analysis_tab(classifier: TransactionClassifier, visualizer: Visualizer):
    st.markdown('<h2 class="sub-header">📊 收支构成分析</h2>', unsafe_allow_html=True)
    
    summary = st.session_state.category_summary
    latte_summary = st.session_state.latte_summary
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric(
            "总收入",
            f"¥{summary['total_income']:,.2f}",
            help="期间内所有收入总和"
        )
    
    with col2:
        st.metric(
            "总支出",
            f"¥{summary['total_expense']:,.2f}",
            help="期间内所有支出总和"
        )
    
    with col3:
        net = summary['total_income'] - summary['total_expense']
        st.metric(
            "净收支",
            f"¥{net:,.2f}",
            delta=f"+{net:,.0f}" if net >= 0 else f"{net:,.0f}",
            delta_color="normal" if net >= 0 else "inverse"
        )
    
    with col4:
        st.metric(
            "交易笔数",
            f"{summary['transaction_count']}",
            help="总交易记录数"
        )
    
    st.markdown("---")
    
    col1, col2 = st.columns(2)
    
    with col1:
        fig_pie = visualizer.create_expense_pie_chart(summary)
        st.plotly_chart(fig_pie, use_container_width=True)
    
    with col2:
        fig_bar = visualizer.create_income_expense_bar_chart(st.session_state.classified_df)
        st.plotly_chart(fig_bar, use_container_width=True)
    
    st.markdown("---")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("### 📈 各类别支出趋势")
        freq_option = st.selectbox(
            "时间粒度",
            options=['周', '月', '日'],
            index=1,
            key='trend_freq'
        )
        freq_map = {'周': 'W', '月': 'M', '日': 'D'}
        
        fig_trend = visualizer.create_category_trend_chart(
            st.session_state.classified_df,
            freq=freq_map[freq_option]
        )
        st.plotly_chart(fig_trend, use_container_width=True)
    
    with col2:
        st.markdown("### ☕ 拿铁因子分析")
        fig_latte = visualizer.create_latte_factor_chart(latte_summary)
        st.plotly_chart(fig_latte, use_container_width=True)
        
        if latte_summary['total_amount'] > 0:
            st.info(
                f"💡 拿铁因子总支出: ¥{latte_summary['total_amount']:,.2f} "
                f"({latte_summary['transaction_count']} 笔交易)"
            )
    
    st.markdown("---")
    st.markdown("### 📋 支出类别详情")
    
    by_category = summary.get('by_category', {})
    if by_category:
        cat_df = pd.DataFrame.from_dict(by_category, orient='index')
        cat_df = cat_df.reset_index().rename(columns={'index': '类别'})
        cat_df = cat_df[['类别', 'total_amount', 'percentage', 'transaction_count', 'avg_amount']]
        cat_df.columns = ['类别', '总金额', '占比(%)', '交易次数', '平均金额']
        cat_df['总金额'] = cat_df['总金额'].apply(lambda x: f"¥{x:,.2f}")
        cat_df['平均金额'] = cat_df['平均金额'].apply(lambda x: f"¥{x:,.2f}")
        
        st.dataframe(cat_df, use_container_width=True, hide_index=True)

def anomaly_detection_tab(visualizer: Visualizer):
    st.markdown('<h2 class="sub-header">🔍 异常消费检测</h2>', unsafe_allow_html=True)
    
    anomalies_summary = st.session_state.anomalies_summary
    anomalies_df = st.session_state.anomalies_df
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.metric(
            "异常交易总数",
            f"{anomalies_summary['total_anomalies']}",
            help="检测到的所有异常交易数量"
        )
    
    with col2:
        st.metric(
            "异常总金额",
            f"¥{anomalies_summary['total_anomaly_amount']:,.2f}",
            help="所有异常交易的金额总和"
        )
    
    with col3:
        total_expense = st.session_state.category_summary.get('total_expense', 1)
        anomaly_ratio = anomalies_summary['total_anomaly_amount'] / total_expense * 100 if total_expense > 0 else 0
        st.metric(
            "异常占比",
            f"{anomaly_ratio:.1f}%",
            help="异常金额占总支出的比例"
        )
    
    st.markdown("---")
    
    fig_anomaly = visualizer.create_anomaly_scatter_chart(anomalies_df)
    st.plotly_chart(fig_anomaly, use_container_width=True)
    
    st.markdown("---")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("### 🚨 Z-score 大额异常")
        st.caption(f"Z-score 阈值: {anomalies_summary['z_score_threshold']} (绝对值大于此值视为异常)")
        
        z_anomalies = anomalies_summary.get('z_score_anomalies', [])
        
        if z_anomalies:
            for anomaly in z_anomalies:
                with st.container():
                    st.markdown(f"""
                    <div class="anomaly-highlight">
                        <strong>📅 {anomaly['date']}</strong><br>
                        💰 金额: ¥{anomaly['amount']:,.2f}<br>
                        📊 Z-score: {anomaly['z_score']:.2f}<br>
                        📝 描述: {anomaly['description']}<br>
                        🏷️ 类别: {anomaly.get('category', '未知')}
                    </div>
                    """, unsafe_allow_html=True)
        else:
            st.success("✅ 未检测到大额异常消费")
    
    with col2:
        st.markdown("### ⏰ 高频消费异常（拿铁因子）")
        st.caption(f"检测规则: {anomalies_summary['frequent_spend_days']}天内 {anomalies_summary['min_frequent_count']} 次以上同类消费")
        
        freq_anomalies = anomalies_summary.get('frequent_spend_anomalies', [])
        
        if freq_anomalies:
            for fa in freq_anomalies:
                with st.container():
                    st.markdown(f"""
                    <div class="anomaly-highlight">
                        <strong>⚠️ {fa['type']}</strong><br>
                        📊 交易次数: {fa['transaction_count']} 次<br>
                        💰 总金额: ¥{fa['total_amount']:,.2f}<br>
                        📈 平均金额: ¥{fa['avg_amount']:,.2f}
                    </div>
                    """, unsafe_allow_html=True)
                    
                    with st.expander("查看详情"):
                        for t in fa['transactions'][:10]:
                            st.markdown(f"- {t['date']}: ¥{t['amount']:,.2f} - {t['description'][:30]}")
                        if len(fa['transactions']) > 10:
                            st.markdown(f"... 还有 {len(fa['transactions']) - 10} 条")
        else:
            st.success("✅ 未检测到高频异常消费")

def leak_report_tab(report_gen: ReportGenerator):
    st.markdown('<h2 class="sub-header">📋 资金泄漏简报</h2>', unsafe_allow_html=True)
    
    report = st.session_state.leak_report
    forecast = st.session_state.forecast_data
    
    st.markdown(f"**生成时间:** {report['generated_at']}")
    
    risk_level = report['risk_level']
    risk_score = report['risk_score']
    
    risk_class = {
        '高': 'risk-high',
        '中': 'risk-medium',
        '低': 'risk-low'
    }.get(risk_level, 'risk-low')
    
    st.markdown(f"""
    <div class="metric-card {risk_class}" style="padding: 1.5rem; margin: 1rem 0;">
        <h3 style="margin: 0;">⚠️ 风险等级评估</h3>
        <p style="font-size: 2rem; font-weight: bold; margin: 0.5rem 0;">{risk_level}风险</p>
        <p style="margin: 0;">风险分数: {risk_score}/10</p>
    </div>
    """, unsafe_allow_html=True)
    
    st.markdown("---")
    
    col1, col2, col3, col4 = st.columns(4)
    
    summary = report['summary']
    with col1:
        st.metric("总交易数", f"{summary['total_transactions']}")
    with col2:
        st.metric("异常笔数", f"{summary['anomaly_count']}")
    with col3:
        st.metric("大额异常", f"{summary['z_score_anomaly_count']}")
    with col4:
        st.metric("高频异常类型", f"{summary['frequent_anomaly_count']}")
    
    st.markdown("---")
    
    st.markdown("### 📈 趋势预测")
    
    fig_forecast = report_gen.create_forecast_chart(forecast)
    st.plotly_chart(fig_forecast, use_container_width=True)
    
    if forecast.get('has_forecast'):
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("趋势方向", forecast['trend_direction'])
        with col2:
            st.metric("R² 拟合度", f"{forecast['r_squared']:.3f}")
        with col3:
            if forecast['forecast_values']:
                st.metric("下月预测支出", f"¥{forecast['forecast_values'][0]:,.2f}")
    
    st.markdown("---")
    
    st.markdown("### 💡 初步预算建议")
    
    recommendations = report.get('recommendations', [])
    
    if recommendations:
        for rec in recommendations:
            priority_color = {
                '高': '🔴',
                '中': '🟡',
                '低': '🟢'
            }.get(rec.get('priority', '中'), '🟡')
            
            with st.expander(
                f"{priority_color} [{rec.get('priority', '中')}优先级] {rec.get('title', '')}",
                expanded=rec.get('priority') == '高'
            ):
                st.markdown(f"**类别:** {rec.get('category', '未知')}")
                st.markdown(f"**说明:** {rec.get('description', '')}")
                st.markdown(f"**💰 预期节省:** {rec.get('potential_savings', '')}")
    else:
        st.success("您的财务状况良好，暂无明显的优化建议！")

def ai_advice_tab():
    st.markdown('<h2 class="sub-header">🤖 AI 智能预算建议</h2>', unsafe_allow_html=True)
    
    llm_service = st.session_state.llm_service
    report = st.session_state.leak_report
    
    col1, col2 = st.columns([3, 1])
    
    with col1:
        if llm_service.is_configured():
            st.success("✅ LLM 已配置就绪")
        else:
            st.warning("⚠️ LLM 未配置，将使用内置规则生成建议")
            st.info("请在左侧边栏配置火山方舟 API Key 以获得更智能的建议")
    
    with col2:
        if st.button("🔄 重新生成建议", type="primary"):
            st.session_state.llm_advice = None
    
    st.markdown("---")
    
    if st.session_state.llm_advice is None:
        with st.spinner("正在分析账单并生成建议..."):
            advice = llm_service.generate_budget_advice(report)
            st.session_state.llm_advice = advice
    
    if st.session_state.llm_advice:
        st.markdown("### 📋 AI 生成的专业建议")
        st.markdown(st.session_state.llm_advice)
        
        st.markdown("---")
        
        st.markdown("### 📊 报告数据摘要")
        
        col1, col2 = st.columns(2)
        
        with col1:
            summary = report['summary']
            st.markdown("**📈 基本统计**")
            st.json({
                "总支出": f"¥{summary['total_expense']:,.2f}",
                "总收入": f"¥{summary['total_income']:,.2f}",
                "净收支": f"¥{summary['total_income'] - summary['total_expense']:,.2f}",
                "异常金额": f"¥{summary['total_anomaly_amount']:,.2f}",
                "拿铁因子": f"¥{summary['total_latte_amount']:,.2f}"
            }, expanded=False)
        
        with col2:
            st.markdown("**⚠️ 风险信息**")
            st.json({
                "风险等级": report['risk_level'],
                "风险分数": f"{report['risk_score']}/10",
                "异常笔数": summary['anomaly_count'],
                "大额异常": summary['z_score_anomaly_count'],
                "高频异常类型": summary['frequent_anomaly_count']
            }, expanded=False)

if __name__ == "__main__":
    main()
