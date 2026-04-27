import pandas as pd
import numpy as np
from scipy import stats
from typing import Dict, List, Tuple, Optional
from config import Z_SCORE_THRESHOLD, FREQUENT_SPEND_DAYS, MIN_FREQUENT_COUNT


class AnomalyDetector:
    def __init__(self, z_score_threshold: float = Z_SCORE_THRESHOLD,
                 frequent_spend_days: int = FREQUENT_SPEND_DAYS,
                 min_frequent_count: int = MIN_FREQUENT_COUNT):
        self.z_score_threshold = z_score_threshold
        self.frequent_spend_days = frequent_spend_days
        self.min_frequent_count = min_frequent_count
    
    def detect_anomalies(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict]:
        df = df.copy()
        
        expense_df = df[df['amount'] < 0].copy()
        
        if expense_df.empty:
            return df, {'z_score_anomalies': [], 'frequent_spend_anomalies': []}
        
        expense_df['amount_abs'] = expense_df['amount'].abs()
        
        expense_df = self._detect_z_score_anomalies(expense_df)
        expense_df = self._detect_frequent_spend_anomalies(expense_df)
        
        df = df.merge(
            expense_df[['z_score_anomaly', 'z_score_value', 'frequent_spend_anomaly', 'frequent_spend_type']],
            left_index=True,
            right_index=True,
            how='left'
        )
        
        df['is_anomaly'] = df['z_score_anomaly'].fillna(False) | df['frequent_spend_anomaly'].fillna(False)
        
        anomalies_summary = self._generate_anomalies_summary(df)
        
        return df, anomalies_summary
    
    def _detect_z_score_anomalies(self, df: pd.DataFrame) -> pd.DataFrame:
        if len(df) < 2:
            df['z_score_anomaly'] = False
            df['z_score_value'] = 0.0
            return df
        
        df['z_score_value'] = stats.zscore(df['amount_abs'], nan_policy='omit')
        
        df['z_score_anomaly'] = (df['z_score_value'].abs() > self.z_score_threshold) & (~df['z_score_value'].isna())
        
        df['z_score_value'] = df['z_score_value'].round(3)
        
        return df
    
    def _detect_frequent_spend_anomalies(self, df: pd.DataFrame) -> pd.DataFrame:
        df['frequent_spend_anomaly'] = False
        df['frequent_spend_type'] = None
        
        if 'latte_factor_type' not in df.columns:
            return df
        
        if len(df) < self.min_frequent_count:
            return df
        
        df_sorted = df.sort_values('date')
        
        latte_df = df_sorted[df_sorted['is_latte_factor'].fillna(False)]
        
        if latte_df.empty:
            return df
        
        for factor_type, group in latte_df.groupby('latte_factor_type'):
            if len(group) < self.min_frequent_count:
                continue
            
            dates = group['date'].sort_values()
            
            for i in range(len(dates) - self.min_frequent_count + 1):
                window_dates = dates.iloc[i:i + self.min_frequent_count]
                date_range = (window_dates.max() - window_dates.min()).days
                
                if date_range <= self.frequent_spend_days:
                    for idx in group.index:
                        if group.loc[idx, 'date'] in window_dates.values:
                            df.loc[idx, 'frequent_spend_anomaly'] = True
                            df.loc[idx, 'frequent_spend_type'] = factor_type
        
        return df
    
    def _generate_anomalies_summary(self, df: pd.DataFrame) -> Dict:
        anomalies_df = df[df['is_anomaly'].fillna(False)]
        
        if anomalies_df.empty:
            return {
                'total_anomalies': 0,
                'z_score_anomalies': [],
                'frequent_spend_anomalies': [],
                'total_anomaly_amount': 0
            }
        
        z_score_anomalies = []
        frequent_spend_anomalies = []
        
        z_df = anomalies_df[anomalies_df['z_score_anomaly'].fillna(False)]
        for _, row in z_df.iterrows():
            z_score_anomalies.append({
                'date': row['date'].strftime('%Y-%m-%d') if pd.notna(row['date']) else '未知',
                'description': row['description'],
                'amount': abs(row['amount']),
                'z_score': row.get('z_score_value', 0),
                'category': row.get('category', '其他支出')
            })
        
        freq_df = anomalies_df[anomalies_df['frequent_spend_anomaly'].fillna(False)]
        for factor_type, group in freq_df.groupby('frequent_spend_type'):
            if factor_type is None:
                continue
            
            frequent_spend_anomalies.append({
                'type': factor_type,
                'transaction_count': len(group),
                'total_amount': group['amount'].abs().sum().round(2),
                'avg_amount': group['amount'].abs().mean().round(2),
                'transactions': [
                    {
                        'date': row['date'].strftime('%Y-%m-%d') if pd.notna(row['date']) else '未知',
                        'description': row['description'],
                        'amount': abs(row['amount'])
                    }
                    for _, row in group.iterrows()
                ]
            })
        
        total_anomaly_amount = anomalies_df['amount'].abs().sum().round(2)
        
        return {
            'total_anomalies': len(anomalies_df),
            'z_score_anomalies': z_score_anomalies,
            'frequent_spend_anomalies': frequent_spend_anomalies,
            'total_anomaly_amount': total_anomaly_amount,
            'z_score_threshold': self.z_score_threshold,
            'frequent_spend_days': self.frequent_spend_days,
            'min_frequent_count': self.min_frequent_count
        }
    
    def get_category_z_score_stats(self, df: pd.DataFrame) -> Dict:
        expense_df = df[df['amount'] < 0]
        
        if expense_df.empty:
            return {}
        
        category_stats = {}
        
        for category, group in expense_df.groupby('category'):
            amounts = group['amount'].abs()
            
            if len(amounts) < 2:
                continue
            
            mean = amounts.mean()
            std = amounts.std()
            median = amounts.median()
            max_val = amounts.max()
            min_val = amounts.min()
            
            z_scores = (amounts - mean) / std if std > 0 else pd.Series([0] * len(amounts))
            
            anomalies = group[z_scores.abs() > self.z_score_threshold]
            
            category_stats[category] = {
                'mean': round(mean, 2),
                'median': round(median, 2),
                'std': round(std, 2) if std > 0 else 0,
                'min': round(min_val, 2),
                'max': round(max_val, 2),
                'transaction_count': len(group),
                'anomaly_count': len(anomalies),
                'anomaly_percentage': round(len(anomalies) / len(group) * 100, 1) if len(group) > 0 else 0
            }
        
        return category_stats
