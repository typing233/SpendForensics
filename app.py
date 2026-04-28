"""
SpendForensics · 个人账单侦探
------------------------------
Streamlit app for personal finance analysis:
  - Upload bank / credit-card CSV exports
  - Auto-categorise transactions with keyword-regex rules
  - Visualise income/expense breakdown
  - Z-score anomaly detection
  - Latte-factor (high-frequency small-spend) analysis
  - Trend forecast + money-leak report with budget suggestions
"""

from __future__ import annotations

import io
import re
import warnings
from typing import Optional, Tuple

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

warnings.filterwarnings("ignore")

# ── Page configuration ─────────────────────────────────────────────────────────
st.set_page_config(
    page_title="SpendForensics · 个人账单侦探",
    page_icon="🔍",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Category keyword-regex rules ───────────────────────────────────────────────
# Each value is a list of regex patterns; first match wins.
CATEGORIES: dict[str, list[str]] = {
    "餐饮外卖": [
        r"美团",
        r"饿了么",
        r"肯德基|KFC",
        r"麦当劳|McDonald",
        r"星巴克|Starbucks",
        r"瑞幸|luckin",
        r"必胜客|Pizza\s*Hut",
        r"汉堡王|Burger\s*King",
        r"海底捞",
        r"喜茶",
        r"奈雪",
        r"蜜雪冰城",
        r"餐厅|饭店|食堂|小吃|烧烤|火锅",
        r"外卖|早餐|午餐|晚餐",
    ],
    "交通出行": [
        r"滴滴|DiDi|didi",
        r"高德打车",
        r"曹操出行",
        r"T3出行",
        r"享道出行",
        r"地铁|公交|轨道交通",
        r"高铁|火车|动车|铁路",
        r"航空|机票|飞机",
        r"出租车|的士|taxi",
        r"哈啰|青桔|美团单车|共享单车",
        r"uber|Uber",
    ],
    "购物电商": [
        r"淘宝|天猫|Taobao|Tmall",
        r"京东|JD\.com",
        r"拼多多|Pinduoduo",
        r"苏宁",
        r"唯品会",
        r"抖音小店|抖音电商",
        r"快手小店",
        r"亚马逊|Amazon",
        r"当当",
        r"SHEIN|shein",
    ],
    "超市便利": [
        r"沃尔玛|Walmart",
        r"家乐福|Carrefour",
        r"大润发|RT-Mart",
        r"永辉超市",
        r"盒马|Hema",
        r"物美",
        r"华润万家",
        r"7-11|711|便利蜂|全家|FamilyMart|罗森|Lawson",
        r"超市|便利店",
    ],
    "娱乐订阅": [
        r"爱奇艺|iQIYI",
        r"腾讯视频|WeTV",
        r"优酷|Youku",
        r"哔哩哔哩|bilibili|B站",
        r"Netflix",
        r"Disney\+|迪士尼",
        r"网易云音乐|QQ音乐|Spotify",
        r"抖音|TikTok|快手",
        r"游戏|Steam|Epic|腾讯游戏|网易游戏",
        r"电影|影院|万达|CGV|大地影院",
    ],
    "健康医疗": [
        r"医院|诊所|门诊|挂号",
        r"药店|药房|大参林|益丰|老百姓",
        r"健身|健身房|gym|瑜伽|Keep",
        r"体检|化验|检查",
    ],
    "教育学习": [
        r"学费|培训费|报名费",
        r"网课|在线教育|慕课",
        r"书店|图书|书籍|教材",
        r"新东方|好未来|作业帮|猿辅导|学而思",
    ],
    "居家生活": [
        r"水费|电费|燃气|煤气|自来水",
        r"物业费|房租|租金|租房",
        r"宜家|IKEA|居然之家|红星美凯龙",
        r"家政|保洁|维修|装修",
    ],
    "数字会员": [
        r"会员|VIP|Premium|订阅|membership",
        r"iCloud|百度网盘|腾讯云|阿里云盘",
        r"ChatGPT|OpenAI|Claude|Midjourney",
        r"Adobe|Microsoft\s*365|Office",
    ],
    "转账还款": [
        r"转账|转款|汇款",
        r"还款|还信用卡|信用卡还款",
        r"红包",
    ],
    "收入": [
        r"工资|薪资|薪酬|salary",
        r"奖金|绩效|年终奖",
        r"退款|退货|refund",
        r"报销|reimburs",
        r"理财|收益|利息|分红",
    ],
}

# Latte-factor sub-types: high-frequency small recurring expenses
LATTE_FACTORS: dict[str, list[str]] = {
    "外卖点餐": [r"美团", r"饿了么", r"外卖"],
    "打车出行": [r"滴滴", r"高德打车", r"曹操出行", r"T3出行", r"出租车"],
    "咖啡奶茶": [
        r"星巴克|Starbucks",
        r"瑞幸|luckin",
        r"喜茶",
        r"奈雪",
        r"蜜雪冰城",
        r"咖啡|奶茶|茶饮",
    ],
    "视频会员": [
        r"爱奇艺",
        r"腾讯视频",
        r"优酷",
        r"哔哩哔哩|B站",
        r"Netflix",
    ],
    "音乐订阅": [r"网易云音乐", r"QQ音乐", r"Spotify"],
    "游戏充值": [r"游戏|Steam|腾讯游戏|网易游戏"],
}

# ── Helper functions ───────────────────────────────────────────────────────────


def categorize(description: str) -> str:
    """Return the first matching category for a transaction description."""
    if pd.isna(description):
        return "其他"
    text = str(description)
    for cat, patterns in CATEGORIES.items():
        for pat in patterns:
            if re.search(pat, text, re.IGNORECASE):
                return cat
    return "其他"


def detect_latte(description: str) -> Optional[str]:
    """Return the latte-factor sub-type if matched, else None."""
    if pd.isna(description):
        return None
    text = str(description)
    for lf, patterns in LATTE_FACTORS.items():
        for pat in patterns:
            if re.search(pat, text, re.IGNORECASE):
                return lf
    return None


def _to_numeric_amount(series: pd.Series) -> pd.Series:
    """Strip currency symbols / commas and coerce to float."""
    return pd.to_numeric(
        series.astype(str)
        .str.replace(",", "", regex=False)
        .str.replace("¥", "", regex=False)
        .str.replace("￥", "", regex=False)
        .str.strip(),
        errors="coerce",
    )


def parse_csv(uploaded_file) -> Optional[pd.DataFrame]:
    """
    Parse an uploaded CSV into a normalised DataFrame with columns:
      date (datetime64), description (str), amount (float ≥ 0),
      direction ('支出' | '收入')

    Handles:
      - WeChat Pay / Alipay style exports with header comment rows
      - Single signed-amount column  vs  separate debit/credit columns
      - Explicit direction column
      - GBK / GB18030 / UTF-8 encodings
    """
    raw = uploaded_file.read()

    text: Optional[str] = None
    for enc in ("utf-8-sig", "gbk", "gb18030", "utf-8"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        st.error("无法解码文件编码，请确保是 UTF-8 或 GBK 编码的 CSV 文件。")
        return None

    # Skip comment / header lines until we hit the row containing column names
    lines = text.splitlines()
    start_row = 0
    for i, line in enumerate(lines):
        if re.search(r"(日期|时间|金额|date|amount)", line, re.IGNORECASE):
            start_row = i
            break
    clean_text = "\n".join(lines[start_row:])

    try:
        df = pd.read_csv(io.StringIO(clean_text))
    except Exception as exc:
        st.error(f"CSV 解析失败：{exc}")
        return None

    df.columns = [str(c).strip() for c in df.columns]

    def _find_col(keywords: list[str]) -> Optional[str]:
        for col in df.columns:
            for kw in keywords:
                if kw.lower() in col.lower():
                    return col
        return None

    # Date column
    date_col = _find_col(
        ["日期", "时间", "交易时间", "记账日期", "date", "交易日期", "成交日期"]
    )
    if date_col is None:
        st.error("未找到日期列，请检查 CSV 格式。支持的日期列名示例：日期、交易时间、date。")
        return None

    # Description column
    desc_col = _find_col(
        [
            "商户名称",
            "交易对方",
            "备注",
            "描述",
            "摘要",
            "交易描述",
            "说明",
            "交易说明",
            "description",
            "merchant",
            "name",
            "备注信息",
        ]
    )
    if desc_col is None:
        desc_col = df.columns[1] if len(df.columns) > 1 else df.columns[0]

    # Amount / debit / credit columns
    amount_col = _find_col(["金额", "交易金额", "amount", "收支金额"])
    debit_col = _find_col(["支出", "借方", "debit", "出账"])
    credit_col = _find_col(["收入", "贷方", "credit", "入账"])

    # Direction column
    dir_col = _find_col(["收/支", "类型", "交易类型", "type", "direction", "收支类型"])

    result = pd.DataFrame()
    result["date"] = pd.to_datetime(df[date_col], errors="coerce")
    result["description"] = df[desc_col].astype(str).str.strip()

    if amount_col:
        result["amount"] = _to_numeric_amount(df[amount_col]).abs()
        if dir_col:
            result["direction"] = df[dir_col].astype(str).str.strip().apply(
                lambda x: "收入"
                if re.search(r"收入|income|credit|\+", x, re.IGNORECASE)
                else "支出"
            )
        else:
            signed = _to_numeric_amount(df[amount_col])
            result["direction"] = signed.apply(
                lambda x: "收入" if (pd.notna(x) and x > 0) else "支出"
            )
    elif debit_col and credit_col:
        debit = _to_numeric_amount(df[debit_col]).fillna(0).abs()
        credit = _to_numeric_amount(df[credit_col]).fillna(0).abs()
        result["amount"] = debit + credit
        result["direction"] = np.where(credit > 0, "收入", "支出")
    else:
        st.error("未找到金额列，请检查 CSV 格式。支持的列名示例：金额、交易金额、支出、收入。")
        return None

    result = result.dropna(subset=["date", "amount"])
    result = result[result["amount"] > 0].copy()
    result = result.sort_values("date").reset_index(drop=True)
    return result


def zscore_anomalies(df: pd.DataFrame, threshold: float = 2.5) -> pd.DataFrame:
    """Return expense rows where (amount − mean) / std > threshold."""
    expenses = df[df["direction"] == "支出"].copy()
    if len(expenses) < 3:
        return expenses.head(0)
    mean = expenses["amount"].mean()
    std = expenses["amount"].std()
    if std == 0:
        return expenses.head(0)
    expenses["z_score"] = (expenses["amount"] - mean) / std
    return expenses[expenses["z_score"] > threshold].sort_values(
        "z_score", ascending=False
    )


def trend_forecast(
    df: pd.DataFrame, future_months: int = 3
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Compute monthly expense totals, fit a linear trend, and extrapolate.

    Returns (monthly_df, forecast_df).  Both contain columns:
      month_dt (Timestamp), label (str), amount (float | NaN), trend (float)
    """
    expenses = df[df["direction"] == "支出"].copy()
    expenses["month"] = expenses["date"].dt.to_period("M")
    monthly = expenses.groupby("month")["amount"].sum().reset_index()
    monthly["month_dt"] = monthly["month"].dt.to_timestamp()
    monthly["x"] = np.arange(len(monthly), dtype=float)
    monthly["label"] = monthly["month"].astype(str)

    forecast_df = pd.DataFrame()
    if len(monthly) >= 2:
        x = monthly["x"].values
        y = monthly["amount"].values
        slope, intercept = np.polyfit(x, y, 1)
        monthly["trend"] = slope * x + intercept

        last_x = x[-1]
        last_period = monthly["month"].iloc[-1]
        rows = []
        for i in range(1, future_months + 1):
            xi = last_x + i
            rows.append(
                {
                    "month_dt": (last_period + i).to_timestamp(),
                    "label": str(last_period + i),
                    "trend": slope * xi + intercept,
                    "amount": None,
                }
            )
        forecast_df = pd.DataFrame(rows)
    else:
        monthly["trend"] = monthly["amount"]

    return monthly, forecast_df


# ── Demo data ──────────────────────────────────────────────────────────────────

def generate_demo_data() -> pd.DataFrame:
    """Generate a realistic six-month set of demo transactions."""
    rng = np.random.default_rng(42)
    dates = pd.date_range("2024-01-01", "2024-06-30", freq="D")

    # (description, mean_amount, std_amount, daily_probability)
    expense_templates = [
        ("美团外卖", 32, 10, 0.35),
        ("饿了么", 28, 8, 0.20),
        ("星巴克", 38, 6, 0.25),
        ("瑞幸咖啡", 18, 4, 0.30),
        ("滴滴出行", 25, 8, 0.20),
        ("地铁公交", 5, 1, 0.50),
        ("淘宝购物", 160, 80, 0.10),
        ("京东", 220, 120, 0.06),
        ("拼多多", 75, 30, 0.08),
        ("爱奇艺会员", 25, 0, 0.04),
        ("腾讯视频会员", 20, 0, 0.04),
        ("网易云音乐会员", 8, 0, 0.03),
        ("超市购物", 130, 40, 0.15),
        ("沃尔玛", 210, 60, 0.06),
        ("便利蜂", 15, 5, 0.25),
        ("健身房月卡", 299, 0, 0.02),
        ("医院挂号", 55, 15, 0.03),
        ("哔哩哔哩大会员", 30, 0, 0.03),
    ]

    transactions: list[dict] = []
    for date in dates:
        for desc, mean, std, prob in expense_templates:
            if rng.random() < prob:
                amt = max(1.0, float(rng.normal(mean, std) if std > 0 else mean))
                transactions.append(
                    {
                        "date": date,
                        "description": desc,
                        "amount": round(amt, 2),
                        "direction": "支出",
                    }
                )

    # Inject obvious anomalies
    for desc, date_str, amt in [
        ("淘宝购物-笔记本电脑", "2024-02-18", 6800),
        ("机票-春节往返", "2024-01-20", 3200),
        ("海底捞-聚餐", "2024-04-05", 950),
        ("iPhone手机", "2024-05-12", 7499),
    ]:
        transactions.append(
            {
                "date": pd.Timestamp(date_str),
                "description": desc,
                "amount": float(amt),
                "direction": "支出",
            }
        )

    # Monthly salary
    for month in range(1, 7):
        transactions.append(
            {
                "date": pd.Timestamp(f"2024-{month:02d}-15"),
                "description": "工资发放",
                "amount": round(float(rng.normal(14000, 300)), 2),
                "direction": "收入",
            }
        )
        # Year-end bonus in January
        if month == 1:
            transactions.append(
                {
                    "date": pd.Timestamp("2024-01-25"),
                    "description": "年终奖",
                    "amount": 20000.0,
                    "direction": "收入",
                }
            )

    df = pd.DataFrame(transactions)
    df["date"] = pd.to_datetime(df["date"])
    return df.sort_values("date").reset_index(drop=True)


# ── Main application ───────────────────────────────────────────────────────────

def main() -> None:
    st.title("🔍 SpendForensics · 个人账单侦探")
    st.caption(
        "上传银行 / 信用卡 CSV 流水，自动分类 · 异常检测 · 资金泄漏简报"
    )

    # ── Sidebar ─────────────────────────────────────────────────────────────
    with st.sidebar:
        st.header("📁 数据来源")
        uploaded = st.file_uploader(
            "上传 CSV 流水文件",
            type=["csv"],
            help=(
                "支持微信支付、支付宝、招行、工行等主流 CSV 导出格式。\n"
                "必须包含：日期列、描述/商户列、金额列。"
            ),
        )
        use_demo = st.checkbox(
            "使用演示数据",
            value=(uploaded is None),
            help="勾选后忽略上传文件，展示内置演示数据。",
        )

        st.divider()
        st.header("⚙️ 分析参数")
        z_threshold = st.slider(
            "异常检测 Z-score 阈值",
            min_value=1.5,
            max_value=4.0,
            value=2.5,
            step=0.1,
            help="超过该 Z-score 的消费将被标记为异常大额支出。",
        )
        latte_min_count = st.slider(
            "拿铁因子最低月频次",
            min_value=2,
            max_value=15,
            value=4,
            help="某类高频小额消费在单月出现次数达到此阈值时，触发拿铁因子预警。",
        )
        forecast_months = st.slider(
            "趋势预测月数",
            min_value=1,
            max_value=6,
            value=3,
        )

        st.divider()
        st.caption(
            "💡 **拿铁因子**：看似微小的每日消费习惯（咖啡、外卖、打车……），"
            "长期累积却是财务的无声漏洞。"
        )

    # ── Load & process data ─────────────────────────────────────────────────
    if uploaded and not use_demo:
        df = parse_csv(uploaded)
        if df is None:
            st.stop()
    else:
        df = generate_demo_data()
        st.info(
            "📊 当前展示的是内置演示数据（2024-01 ~ 2024-06）。"
            "上传您自己的 CSV 流水文件即可查看真实分析结果。"
        )

    df["category"] = df["description"].apply(categorize)

    # ── Tabs ─────────────────────────────────────────────────────────────────
    tab_overview, tab_anomaly, tab_report = st.tabs(
        ["📊 收支总览", "🚨 异常检测", "📋 资金泄漏简报"]
    )

    # ════════════════════════════════════════════════════════════════════════
    # TAB 1 – Overview
    # ════════════════════════════════════════════════════════════════════════
    with tab_overview:
        income_total = df[df["direction"] == "收入"]["amount"].sum()
        expense_total = df[df["direction"] == "支出"]["amount"].sum()
        balance = income_total - expense_total
        savings_rate = balance / income_total * 100 if income_total > 0 else 0.0

        c1, c2, c3, c4 = st.columns(4)
        c1.metric("💰 总收入", f"¥{income_total:,.0f}")
        c2.metric("💸 总支出", f"¥{expense_total:,.0f}")
        c3.metric(
            "💼 净结余",
            f"¥{balance:,.0f}",
            delta=f"储蓄率 {savings_rate:.1f}%",
            delta_color="normal",
        )
        c4.metric("📝 交易笔数", f"{len(df):,}")

        st.divider()

        # Category breakdown
        exp_df = df[df["direction"] == "支出"]
        cat_sum = (
            exp_df.groupby("category")["amount"]
            .sum()
            .reset_index()
            .sort_values("amount", ascending=False)
        )

        col_pie, col_bar = st.columns(2)
        with col_pie:
            st.subheader("支出分类占比")
            fig_pie = px.pie(
                cat_sum,
                values="amount",
                names="category",
                hole=0.4,
                color_discrete_sequence=px.colors.qualitative.Set3,
            )
            fig_pie.update_traces(textposition="inside", textinfo="percent+label")
            fig_pie.update_layout(
                showlegend=False, margin=dict(t=10, b=10, l=10, r=10)
            )
            st.plotly_chart(fig_pie, use_container_width=True)

        with col_bar:
            st.subheader("各类支出金额排行")
            fig_bar = px.bar(
                cat_sum,
                x="amount",
                y="category",
                orientation="h",
                color="amount",
                color_continuous_scale="RdYlGn_r",
                labels={"amount": "金额 (¥)", "category": ""},
            )
            fig_bar.update_layout(
                coloraxis_showscale=False,
                yaxis=dict(categoryorder="total ascending"),
                margin=dict(t=10, b=10, l=10, r=10),
            )
            st.plotly_chart(fig_bar, use_container_width=True)

        # Monthly income vs expense bar chart
        st.subheader("月度收支对比")
        df_month = df.copy()
        df_month["month"] = df_month["date"].dt.to_period("M").astype(str)
        monthly_io = (
            df_month.groupby(["month", "direction"])["amount"].sum().reset_index()
        )
        fig_monthly = px.bar(
            monthly_io,
            x="month",
            y="amount",
            color="direction",
            barmode="group",
            color_discrete_map={"收入": "#2ecc71", "支出": "#e74c3c"},
            labels={"month": "月份", "amount": "金额 (¥)", "direction": "类型"},
        )
        fig_monthly.update_layout(margin=dict(t=10, b=10))
        st.plotly_chart(fig_monthly, use_container_width=True)

        # Raw data expander
        with st.expander("📄 查看原始明细"):
            display_df = (
                df[["date", "description", "category", "amount", "direction"]]
                .sort_values("date", ascending=False)
                .reset_index(drop=True)
            )
            st.dataframe(
                display_df,
                use_container_width=True,
                column_config={
                    "date": st.column_config.DateColumn("日期"),
                    "description": st.column_config.TextColumn("描述"),
                    "category": st.column_config.TextColumn("分类"),
                    "amount": st.column_config.NumberColumn(
                        "金额", format="¥%.2f"
                    ),
                    "direction": st.column_config.TextColumn("收/支"),
                },
            )

    # ════════════════════════════════════════════════════════════════════════
    # TAB 2 – Anomaly Detection
    # ════════════════════════════════════════════════════════════════════════
    with tab_anomaly:

        # ── Z-score large-expense anomalies ─────────────────────────────────
        st.subheader(f"🚨 大额异常消费（Z-score > {z_threshold}）")

        anomalies = zscore_anomalies(df, z_threshold)

        exp_plot = df[df["direction"] == "支出"].copy()
        if len(exp_plot) >= 3:
            mean_amt = exp_plot["amount"].mean()
            std_amt = exp_plot["amount"].std()
            exp_plot["z_score"] = (exp_plot["amount"] - mean_amt) / std_amt
            exp_plot["异常"] = exp_plot["z_score"] > z_threshold

            fig_scatter = px.scatter(
                exp_plot,
                x="date",
                y="amount",
                color="异常",
                color_discrete_map={True: "#e74c3c", False: "#95a5a6"},
                hover_data=["description", "category", "z_score"],
                labels={"date": "日期", "amount": "金额 (¥)"},
                title="支出散点图（红色为异常大额）",
            )
            threshold_line = mean_amt + z_threshold * std_amt
            fig_scatter.add_hline(
                y=threshold_line,
                line_dash="dash",
                line_color="red",
                annotation_text=f"异常阈值 ¥{threshold_line:,.0f}",
                annotation_position="top right",
            )
            fig_scatter.update_layout(margin=dict(t=40, b=10))
            st.plotly_chart(fig_scatter, use_container_width=True)

        if anomalies.empty:
            st.success("✅ 未检测到明显异常大额消费。")
        else:
            st.warning(f"检测到 **{len(anomalies)}** 笔异常消费：")
            st.dataframe(
                anomalies[["date", "description", "category", "amount", "z_score"]]
                .reset_index(drop=True),
                use_container_width=True,
                column_config={
                    "date": st.column_config.DateColumn("日期"),
                    "description": st.column_config.TextColumn("描述"),
                    "category": st.column_config.TextColumn("分类"),
                    "amount": st.column_config.NumberColumn(
                        "金额", format="¥%.2f"
                    ),
                    "z_score": st.column_config.NumberColumn(
                        "Z-score", format="%.2f"
                    ),
                },
            )

        st.divider()

        # ── Latte-factor analysis ────────────────────────────────────────────
        st.subheader("☕ 拿铁因子分析（高频小额支出）")

        latte_df = df[df["direction"] == "支出"].copy()
        latte_df["latte_type"] = latte_df["description"].apply(detect_latte)
        latte_tagged = latte_df[latte_df["latte_type"].notna()].copy()

        if latte_tagged.empty:
            st.info("未检测到典型拿铁因子消费，继续保持！")
        else:
            latte_tagged["month"] = (
                latte_tagged["date"].dt.to_period("M").astype(str)
            )
            monthly_latte = (
                latte_tagged.groupby(["month", "latte_type"])
                .agg(count=("amount", "count"), total=("amount", "sum"))
                .reset_index()
            )
            high_freq = monthly_latte[monthly_latte["count"] >= latte_min_count]

            col_latte_pie, col_latte_bar = st.columns(2)
            with col_latte_pie:
                latte_total = latte_tagged["amount"].sum()
                latte_by_type = (
                    latte_tagged.groupby("latte_type")["amount"]
                    .sum()
                    .reset_index()
                )
                fig_latte_pie = px.pie(
                    latte_by_type,
                    values="amount",
                    names="latte_type",
                    title=f"拿铁因子构成  总计 ¥{latte_total:,.0f}",
                    hole=0.4,
                    color_discrete_sequence=px.colors.qualitative.Pastel,
                )
                fig_latte_pie.update_layout(margin=dict(t=40, b=10))
                st.plotly_chart(fig_latte_pie, use_container_width=True)

            with col_latte_bar:
                if not high_freq.empty:
                    fig_latte_trend = px.bar(
                        high_freq,
                        x="month",
                        y="total",
                        color="latte_type",
                        title=f"高频拿铁消费月度趋势（≥{latte_min_count} 次/月）",
                        labels={
                            "month": "月份",
                            "total": "金额 (¥)",
                            "latte_type": "类型",
                        },
                    )
                    fig_latte_trend.update_layout(margin=dict(t=40, b=10))
                    st.plotly_chart(fig_latte_trend, use_container_width=True)
                else:
                    st.info(
                        f"没有月频次 ≥ {latte_min_count} 次的拿铁因子消费。"
                        "可适当调低左侧「拿铁因子最低月频次」滑块。"
                    )

            if not high_freq.empty:
                st.warning(
                    f"⚠️ 发现 **{high_freq['latte_type'].nunique()}** 类高频拿铁消费，"
                    "建议重点关注："
                )
                summary = (
                    high_freq.groupby("latte_type")
                    .agg(
                        月份数=("month", "count"),
                        累计支出=("total", "sum"),
                        月均支出=("total", "mean"),
                    )
                    .reset_index()
                    .sort_values("累计支出", ascending=False)
                )
                for _, row in summary.iterrows():
                    st.write(
                        f"• **{row['latte_type']}**："
                        f"累计 ¥{row['累计支出']:,.0f}，"
                        f"月均 ¥{row['月均支出']:,.0f}"
                    )

    # ════════════════════════════════════════════════════════════════════════
    # TAB 3 – Money-Leak Report
    # ════════════════════════════════════════════════════════════════════════
    with tab_report:

        # ── Trend forecast chart ─────────────────────────────────────────────
        st.subheader("📈 支出趋势与预测")
        monthly_data, forecast_data = trend_forecast(df, forecast_months)

        fig_trend = go.Figure()
        fig_trend.add_trace(
            go.Scatter(
                x=monthly_data["month_dt"],
                y=monthly_data["amount"],
                mode="lines+markers",
                name="实际月支出",
                line=dict(color="#3498db", width=2),
                marker=dict(size=8),
            )
        )
        if "trend" in monthly_data.columns:
            fig_trend.add_trace(
                go.Scatter(
                    x=monthly_data["month_dt"],
                    y=monthly_data["trend"],
                    mode="lines",
                    name="趋势线（线性回归）",
                    line=dict(color="#e74c3c", width=1.5, dash="dot"),
                )
            )
        if not forecast_data.empty:
            fig_trend.add_trace(
                go.Scatter(
                    x=forecast_data["month_dt"],
                    y=forecast_data["trend"],
                    mode="lines+markers",
                    name=f"预测（未来 {forecast_months} 个月）",
                    line=dict(color="#f39c12", width=2, dash="dash"),
                    marker=dict(size=9, symbol="diamond"),
                )
            )
            # Confidence band (±10 %)
            upper = forecast_data["trend"] * 1.10
            lower = forecast_data["trend"] * 0.90
            fig_trend.add_trace(
                go.Scatter(
                    x=pd.concat(
                        [
                            forecast_data["month_dt"],
                            forecast_data["month_dt"].iloc[::-1],
                        ]
                    ),
                    y=pd.concat([upper, lower.iloc[::-1]]),
                    fill="toself",
                    fillcolor="rgba(243,156,18,0.15)",
                    line=dict(color="rgba(0,0,0,0)"),
                    name="预测区间 (±10%)",
                )
            )

        fig_trend.update_layout(
            xaxis_title="月份",
            yaxis_title="支出金额 (¥)",
            hovermode="x unified",
            legend=dict(
                orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1
            ),
            margin=dict(t=40, b=10),
        )
        st.plotly_chart(fig_trend, use_container_width=True)

        st.divider()

        # ── Textual money-leak brief ─────────────────────────────────────────
        st.subheader("🩺 资金泄漏简报")

        exp_df2 = df[df["direction"] == "支出"]
        inc_df2 = df[df["direction"] == "收入"]
        total_exp2 = exp_df2["amount"].sum()
        total_inc2 = inc_df2["amount"].sum()
        savings_rate2 = (
            (total_inc2 - total_exp2) / total_inc2 * 100 if total_inc2 > 0 else 0.0
        )

        top_cats = (
            exp_df2.groupby("category")["amount"]
            .sum()
            .sort_values(ascending=False)
            .head(3)
        )

        anomalies2 = zscore_anomalies(df, z_threshold)

        latte_df3 = exp_df2.copy()
        latte_df3["latte_type"] = latte_df3["description"].apply(detect_latte)
        latte_total2 = latte_df3[latte_df3["latte_type"].notna()]["amount"].sum()
        latte_pct = latte_total2 / total_exp2 * 100 if total_exp2 > 0 else 0.0

        # Trend direction from last 3 available months
        if len(monthly_data) >= 2:
            tail = monthly_data["amount"].tail(3).values
            trend_direction = "↑ 上升" if tail[-1] > tail[0] else "↓ 下降"
        else:
            trend_direction = "数据不足"

        savings_flag = (
            "  ⚠️ 储蓄率偏低，建议目标 ≥ 20%"
            if savings_rate2 < 20
            else "  ✅ 储蓄率良好"
        )

        cat_lines = "\n".join(
            f"- {cat}：¥{amt:,.0f}（{amt / total_exp2 * 100:.1f}%）"
            for cat, amt in top_cats.items()
        )

        if not anomalies2.empty:
            anomaly_lines = "\n".join(
                f"  - {row.description}（{row.date.strftime('%m-%d')}）：¥{row.amount:,.0f}"
                for _, row in anomalies2.head(3).iterrows()
            )
        else:
            anomaly_lines = "  - 未检测到异常"

        latte_flag = (
            "  ⚠️ 占比偏高，建议审视日常高频小额消费习惯"
            if latte_pct > 15
            else "  ✅ 拿铁因子在合理范围内"
        )

        brief = f"""
**📅 分析周期**：{df['date'].min().strftime('%Y-%m-%d')} ～ {df['date'].max().strftime('%Y-%m-%d')}

---

**💰 收支概况**
- 总收入：**¥{total_inc2:,.0f}**
- 总支出：**¥{total_exp2:,.0f}**
- 储蓄率：**{savings_rate2:.1f}%**{savings_flag}

**🏆 前三大支出类别**
{cat_lines}

**🚨 异常大额消费**
- 检测到 **{len(anomalies2)}** 笔（Z-score > {z_threshold}）
{anomaly_lines}

**☕ 拿铁因子**
- 高频小额消费合计：**¥{latte_total2:,.0f}**（占总支出 {latte_pct:.1f}%）{latte_flag}

**📈 支出趋势**：{trend_direction}
"""
        st.markdown(brief)

        st.divider()

        # ── Budget-reduction suggestions ─────────────────────────────────────
        st.subheader("💡 削减预算建议")

        num_months = max(1, len(monthly_data))
        suggestions: list[str] = []

        # 1. Savings rate
        if savings_rate2 < 20:
            needed_monthly_cut = (
                total_exp2 - (total_inc2 - total_inc2 * 0.20)
            ) / num_months
            suggestions.append(
                f"📌 **提高储蓄率**：当前储蓄率 {savings_rate2:.1f}%，目标 20%。"
                f"建议每月减少支出约 **¥{needed_monthly_cut:,.0f}**，"
                f"可从高频消费类别入手。"
            )

        # 2. Latte factor
        if latte_pct > 10:
            monthly_latte_avg = latte_total2 / num_months
            potential_saving = monthly_latte_avg * 0.30
            suggestions.append(
                f"☕ **控制拿铁因子**：外卖/打车/咖啡等高频消费月均 **¥{monthly_latte_avg:,.0f}**，"
                f"占总支出 {latte_pct:.1f}%。\n"
                f"  建议：每周外卖限 3 次、尝试自备咖啡或使用折扣券，"
                f"预计每月可节省 **¥{potential_saving:,.0f}**。"
            )

        # 3. Top spending category
        if not top_cats.empty:
            top1_cat, top1_amt = top_cats.index[0], top_cats.iloc[0]
            if top1_amt / total_exp2 > 0.25:
                monthly_top1 = top1_amt / num_months
                suggestions.append(
                    f"🛍️ **{top1_cat}** 支出占比 {top1_amt / total_exp2 * 100:.1f}%，比例偏高。\n"
                    f"  建议设置月度预算上限 **¥{monthly_top1 * 0.8:,.0f}**"
                    f"（当前月均 ¥{monthly_top1:,.0f}，削减 20%）。"
                )

        # 4. Anomaly prevention
        if not anomalies2.empty:
            alert_threshold = (
                exp_df2["amount"].mean() + 2 * exp_df2["amount"].std()
            )
            suggestions.append(
                f"🚨 **大额消费预警**：共 {len(anomalies2)} 笔异常支出，"
                f"建议在银行 App 开启大额消费通知"
                f"（推荐阈值 ¥{alert_threshold:,.0f}）。"
            )

        # 5. Silent subscriptions
        sub_df = exp_df2[exp_df2["category"] == "数字会员"]
        if not sub_df.empty:
            suggestions.append(
                f"📱 **清理沉默订阅**：数字会员/订阅总支出 **¥{sub_df['amount'].sum():,.0f}**。\n"
                f"  建议逐项核查是否仍在使用，取消不必要的自动续费。"
            )

        # 6. Forward-looking forecast
        if not forecast_data.empty:
            next_month_pred = forecast_data["trend"].iloc[0]
            annual_pred = next_month_pred * 12
            suggestions.append(
                f"🔮 **支出预测**：按当前趋势，下月预计支出约 ¥{next_month_pred:,.0f}，"
                f"年化约 ¥{annual_pred:,.0f}。"
                + (
                    f"  若储蓄目标为年收入的 20%，年度可用支出上限为 ¥{total_inc2 / num_months * 12 * 0.80:,.0f}。"
                    if total_inc2 > 0
                    else ""
                )
            )

        if suggestions:
            for idx, text in enumerate(suggestions, 1):
                st.markdown(f"**{idx}.** {text}")
                st.write("")
        else:
            st.success("✅ 您的消费结构相对健康，继续保持良好习惯！")


if __name__ == "__main__":
    main()
