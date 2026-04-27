import pandas as pd
import numpy as np
import re
from datetime import datetime
from typing import Dict, List, Tuple, Optional
from config import COLUMN_MAPPING_CANDIDATES


class CSVParser:
    def __init__(self):
        self.column_mapping_candidates = COLUMN_MAPPING_CANDIDATES
    
    def parse_csv(self, file) -> pd.DataFrame:
        try:
            df = pd.read_csv(file, encoding='utf-8')
        except UnicodeDecodeError:
            try:
                df = pd.read_csv(file, encoding='gbk')
            except:
                df = pd.read_csv(file, encoding='gb18030')
        
        return self._standardize_columns(df)
    
    def _standardize_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        column_mapping = self._detect_columns(df)
        
        standardized_df = pd.DataFrame()
        
        if column_mapping.get('date'):
            standardized_df['date'] = df[column_mapping['date']]
            standardized_df['date'] = self._parse_dates(standardized_df['date'])
        
        if column_mapping.get('description'):
            standardized_df['description'] = df[column_mapping['description']].astype(str)
        
        if column_mapping.get('amount'):
            standardized_df['amount'] = self._parse_amounts(df[column_mapping['amount']])
        
        if column_mapping.get('type'):
            standardized_df['transaction_type'] = df[column_mapping['type']].astype(str)
            standardized_df = self._infer_amount_from_type(standardized_df)
        else:
            standardized_df = self._infer_transaction_type(standardized_df)
        
        if column_mapping.get('balance'):
            standardized_df['balance'] = self._parse_amounts(df[column_mapping['balance']])
        
        standardized_df = self._ensure_required_columns(standardized_df)
        
        return standardized_df
    
    def _detect_columns(self, df: pd.DataFrame) -> Dict[str, str]:
        mapping = {}
        columns = df.columns.tolist()
        
        for standard_name, candidates in self.column_mapping_candidates.items():
            for col in columns:
                col_lower = str(col).lower()
                for candidate in candidates:
                    if str(candidate).lower() in col_lower or col_lower in str(candidate).lower():
                        mapping[standard_name] = col
                        break
                if standard_name in mapping:
                    break
        
        return mapping
    
    def _parse_dates(self, date_series: pd.Series) -> pd.Series:
        parsed_dates = []
        
        for date_str in date_series:
            if pd.isna(date_str):
                parsed_dates.append(pd.NaT)
                continue
            
            date_str = str(date_str).strip()
            
            formats = [
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%d %H:%M",
                "%Y-%m-%d",
                "%Y/%m/%d %H:%M:%S",
                "%Y/%m/%d %H:%M",
                "%Y/%m/%d",
                "%Y年%m月%d日 %H:%M:%S",
                "%Y年%m月%d日 %H:%M",
                "%Y年%m月%d日",
                "%m-%d-%Y",
                "%m/%d/%Y",
                "%d-%m-%Y",
                "%d/%m/%Y",
            ]
            
            parsed = None
            for fmt in formats:
                try:
                    parsed = datetime.strptime(date_str, fmt)
                    break
                except (ValueError, TypeError):
                    continue
            
            if parsed is None:
                try:
                    parsed = pd.to_datetime(date_str)
                except:
                    parsed = pd.NaT
            
            parsed_dates.append(parsed)
        
        return pd.Series(parsed_dates)
    
    def _parse_amounts(self, amount_series: pd.Series) -> pd.Series:
        parsed_amounts = []
        
        for amount in amount_series:
            if pd.isna(amount):
                parsed_amounts.append(np.nan)
                continue
            
            amount_str = str(amount).strip()
            
            amount_str = re.sub(r'[¥￥$,，]', '', amount_str)
            
            is_negative = False
            if amount_str.startswith('-') or amount_str.startswith('(') and amount_str.endswith(')'):
                is_negative = True
                amount_str = amount_str.replace('-', '').replace('(', '').replace(')', '')
            
            try:
                parsed = float(amount_str)
                if is_negative:
                    parsed = -parsed
                parsed_amounts.append(parsed)
            except ValueError:
                parsed_amounts.append(np.nan)
        
        return pd.Series(parsed_amounts)
    
    def _infer_transaction_type(self, df: pd.DataFrame) -> pd.DataFrame:
        if 'amount' not in df.columns:
            df['transaction_type'] = 'unknown'
            return df
        
        df['transaction_type'] = df['amount'].apply(
            lambda x: '收入' if x > 0 else '支出' if x < 0 else '其他'
        )
        
        return df
    
    def _infer_amount_from_type(self, df: pd.DataFrame) -> pd.DataFrame:
        if 'transaction_type' not in df.columns or 'amount' not in df.columns:
            return df
        
        type_lower = df['transaction_type'].str.lower()
        
        income_keywords = ['收入', '进账', '入账', '收款', '存入', 'income', 'credit', '收']
        expense_keywords = ['支出', '消费', '扣款', '支付', '转出', '取款', 'expense', 'debit', '付']
        
        def adjust_amount(row):
            t_type = str(row['transaction_type']).lower()
            amount = row['amount']
            
            if pd.isna(amount):
                return amount
            
            for kw in income_keywords:
                if kw.lower() in t_type:
                    return abs(amount)
            
            for kw in expense_keywords:
                if kw.lower() in t_type:
                    return -abs(amount)
            
            return amount
        
        df['amount'] = df.apply(adjust_amount, axis=1)
        
        return df
    
    def _ensure_required_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        required_cols = ['date', 'description', 'amount', 'transaction_type']
        
        for col in required_cols:
            if col not in df.columns:
                if col == 'date':
                    df['date'] = pd.NaT
                elif col == 'description':
                    df['description'] = ''
                elif col == 'amount':
                    df['amount'] = np.nan
                elif col == 'transaction_type':
                    df['transaction_type'] = '未知'
        
        return df
    
    def get_sample_data(self) -> pd.DataFrame:
        sample_data = [
            {"date": "2024-01-01", "description": "工资入账", "amount": 15000, "transaction_type": "收入"},
            {"date": "2024-01-02", "description": "美团外卖-宫保鸡丁", "amount": -35.5, "transaction_type": "支出"},
            {"date": "2024-01-03", "description": "滴滴出行-快车", "amount": -28.8, "transaction_type": "支出"},
            {"date": "2024-01-03", "description": "星巴克咖啡", "amount": -42, "transaction_type": "支出"},
            {"date": "2024-01-04", "description": "京东商城-手机壳", "amount": -128, "transaction_type": "支出"},
            {"date": "2024-01-05", "description": "饿了么-早餐", "amount": -18.5, "transaction_type": "支出"},
            {"date": "2024-01-05", "description": "滴滴出行-快车", "amount": -32, "transaction_type": "支出"},
            {"date": "2024-01-06", "description": "瑞幸咖啡", "amount": -19, "transaction_type": "支出"},
            {"date": "2024-01-06", "description": "美团外卖-午餐", "amount": -45, "transaction_type": "支出"},
            {"date": "2024-01-07", "description": "淘宝购物-衣服", "amount": -358, "transaction_type": "支出"},
            {"date": "2024-01-08", "description": "滴滴出行-快车", "amount": -25, "transaction_type": "支出"},
            {"date": "2024-01-08", "description": "星巴克咖啡", "amount": -38, "transaction_type": "支出"},
            {"date": "2024-01-09", "description": "美团外卖-晚餐", "amount": -52, "transaction_type": "支出"},
            {"date": "2024-01-10", "description": "大额消费-奢侈品", "amount": -5800, "transaction_type": "支出"},
            {"date": "2024-01-10", "description": "滴滴出行-快车", "amount": -30, "transaction_type": "支出"},
            {"date": "2024-01-11", "description": "瑞幸咖啡", "amount": -16, "transaction_type": "支出"},
            {"date": "2024-01-11", "description": "饿了么-早餐", "amount": -22, "transaction_type": "支出"},
            {"date": "2024-01-12", "description": "京东商城-电子产品", "amount": -2599, "transaction_type": "支出"},
            {"date": "2024-01-13", "description": "滴滴出行-快车", "amount": -27, "transaction_type": "支出"},
            {"date": "2024-01-13", "description": "星巴克咖啡", "amount": -45, "transaction_type": "支出"},
            {"date": "2024-01-14", "description": "美团外卖-午餐", "amount": -38, "transaction_type": "支出"},
            {"date": "2024-01-15", "description": "理财收益", "amount": 125, "transaction_type": "收入"},
            {"date": "2024-01-15", "description": "滴滴出行-快车", "amount": -33, "transaction_type": "支出"},
            {"date": "2024-01-16", "description": "瑞幸咖啡", "amount": -19, "transaction_type": "支出"},
            {"date": "2024-01-16", "description": "饿了么-晚餐", "amount": -48, "transaction_type": "支出"},
            {"date": "2024-01-17", "description": "淘宝购物-化妆品", "amount": -688, "transaction_type": "支出"},
            {"date": "2024-01-18", "description": "滴滴出行-快车", "amount": -29, "transaction_type": "支出"},
            {"date": "2024-01-18", "description": "星巴克咖啡", "amount": -40, "transaction_type": "支出"},
            {"date": "2024-01-19", "description": "美团外卖-早餐", "amount": -15, "transaction_type": "支出"},
            {"date": "2024-01-20", "description": "京东商城-家电", "amount": -1999, "transaction_type": "支出"},
        ]
        
        df = pd.DataFrame(sample_data)
        df['date'] = pd.to_datetime(df['date'])
        return df
