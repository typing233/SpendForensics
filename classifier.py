import pandas as pd
import re
from typing import Dict, List, Tuple
from config import CATEGORY_RULES, LATTE_FACTOR_KEYWORDS


class TransactionClassifier:
    def __init__(self):
        self.category_rules = CATEGORY_RULES
        self.latte_factor_keywords = LATTE_FACTOR_KEYWORDS
    
    def classify_transactions(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        
        df['category'] = df['description'].apply(self._classify_single)
        df['latte_factor_type'] = df['description'].apply(self._detect_latte_factor)
        df['is_latte_factor'] = df['latte_factor_type'].notna()
        
        df = self._refine_category_by_type(df)
        
        return df
    
    def _classify_single(self, description: str) -> str:
        if pd.isna(description):
            return "其他支出"
        
        desc_lower = str(description).lower()
        
        for category, rules in self.category_rules.items():
            if category == "其他支出":
                continue
            
            keywords = rules.get('keywords', [])
            patterns = rules.get('patterns', [])
            
            for keyword in keywords:
                if keyword.lower() in desc_lower:
                    return category
            
            for pattern in patterns:
                if re.search(pattern, desc_lower, re.IGNORECASE):
                    return category
        
        return "其他支出"
    
    def _detect_latte_factor(self, description: str) -> str:
        if pd.isna(description):
            return None
        
        desc_lower = str(description).lower()
        
        for factor_type, keywords in self.latte_factor_keywords.items():
            for keyword in keywords:
                if keyword.lower() in desc_lower:
                    return factor_type
        
        return None
    
    def _refine_category_by_type(self, df: pd.DataFrame) -> pd.DataFrame:
        if 'transaction_type' not in df.columns:
            return df
        
        income_mask = df['transaction_type'].str.contains('收入|进账|入账', case=False, na=False)
        transfer_mask = df['transaction_type'].str.contains('转账|还款', case=False, na=False)
        
        df.loc[income_mask & (df['category'] == '其他支出'), 'category'] = '收入'
        df.loc[transfer_mask & (df['category'] == '其他支出'), 'category'] = '转账还款'
        
        return df
    
    def get_category_summary(self, df: pd.DataFrame) -> Dict:
        expense_df = df[(df['amount'] < 0) & (df['category'] != '收入') & (df['category'] != '转账还款')]
        
        category_summary = expense_df.groupby('category').agg({
            'amount': ['sum', 'count', 'mean'],
            'description': 'first'
        }).round(2)
        
        category_summary.columns = ['total_amount', 'transaction_count', 'avg_amount', 'sample_description']
        category_summary['total_amount'] = category_summary['total_amount'].abs()
        
        total_expense = category_summary['total_amount'].sum()
        category_summary['percentage'] = (category_summary['total_amount'] / total_expense * 100).round(1) if total_expense > 0 else 0
        
        category_summary = category_summary.sort_values('total_amount', ascending=False)
        
        return {
            'by_category': category_summary.to_dict('index'),
            'total_expense': round(total_expense, 2),
            'total_income': round(df[df['amount'] > 0]['amount'].sum(), 2),
            'transaction_count': len(df)
        }
    
    def get_latte_factor_summary(self, df: pd.DataFrame) -> Dict:
        latte_df = df[(df['is_latte_factor']) & (df['amount'] < 0)]
        
        if latte_df.empty:
            return {
                'by_type': {},
                'total_amount': 0,
                'transaction_count': 0
            }
        
        type_summary = latte_df.groupby('latte_factor_type').agg({
            'amount': ['sum', 'count', 'mean'],
            'description': 'first'
        }).round(2)
        
        type_summary.columns = ['total_amount', 'transaction_count', 'avg_amount', 'sample_description']
        type_summary['total_amount'] = type_summary['total_amount'].abs()
        
        total_latte = type_summary['total_amount'].sum()
        
        type_summary = type_summary.sort_values('total_amount', ascending=False)
        
        return {
            'by_type': type_summary.to_dict('index'),
            'total_amount': round(total_latte, 2),
            'transaction_count': len(latte_df)
        }
