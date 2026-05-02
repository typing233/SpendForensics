const { zScore, mean, standardDeviation } = require('simple-statistics');

class AnalysisService {
  
  calculateZScores(transactions) {
    if (!transactions || transactions.length === 0) {
      return [];
    }

    const amounts = transactions.map(t => t.amount);
    const meanAmount = mean(amounts);
    const stdDev = standardDeviation(amounts);

    return transactions.map(transaction => {
      const z = stdDev > 0 ? zScore(transaction.amount, meanAmount, stdDev) : 0;
      const isOutlier = Math.abs(z) > 2;
      
      return {
        ...transaction,
        zScore: z,
        isOutlier: isOutlier,
        mean: meanAmount,
        standardDeviation: stdDev
      };
    });
  }

  detectLatteFactors(transactions, threshold = 0.1) {
    if (!transactions || transactions.length === 0) {
      return [];
    }

    const categoryGroups = this.groupByCategory(transactions);
    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

    const latteFactors = [];
    
    for (const [category, categoryTransactions] of Object.entries(categoryGroups)) {
      const categoryTotal = categoryTransactions.reduce((sum, t) => sum + t.amount, 0);
      const percentage = totalAmount > 0 ? categoryTotal / totalAmount : 0;
      
      const frequentSmallTransactions = categoryTransactions.filter(t => {
        return t.amount < totalAmount * 0.05; 
      });

      const isLatteFactor = percentage > threshold || frequentSmallTransactions.length > 5;
      
      if (isLatteFactor) {
        latteFactors.push({
          category: category,
          totalAmount: categoryTotal,
          percentage: percentage,
          transactionCount: categoryTransactions.length,
          frequentSmallCount: frequentSmallTransactions.length,
          transactions: categoryTransactions.slice(0, 5) 
        });
      }
    }

    return latteFactors.sort((a, b) => b.percentage - a.percentage);
  }

  analyzeAnomalies(transactions) {
    const zScoreResults = this.calculateZScores(transactions);
    const latteFactors = this.detectLatteFactors(transactions);
    
    const outliers = zScoreResults.filter(t => t.isOutlier);
    
    return {
      zScoreAnalysis: {
        results: zScoreResults,
        outliers: outliers,
        stats: {
          mean: zScoreResults.length > 0 ? zScoreResults[0].mean : 0,
          standardDeviation: zScoreResults.length > 0 ? zScoreResults[0].standardDeviation : 0,
          totalTransactions: transactions.length,
          outlierCount: outliers.length
        }
      },
      latteFactorAnalysis: {
        factors: latteFactors,
        totalLatteAmount: latteFactors.reduce((sum, f) => sum + f.totalAmount, 0)
      },
      anomalies: [
        ...outliers.map(t => ({
          type: 'zscore_outlier',
          severity: Math.abs(t.zScore) > 3 ? 'high' : 'medium',
          transaction: t,
          description: `Z-score 异常: Z值为 ${t.zScore.toFixed(2)}，超出正常范围`
        })),
        ...latteFactors.map(f => ({
          type: 'latte_factor',
          severity: f.percentage > 0.2 ? 'high' : 'medium',
          category: f.category,
          data: f,
          description: `拿铁因子: ${f.category} 类别占总支出 ${(f.percentage * 100).toFixed(1)}%`
        }))
      ]
    };
  }

  groupByCategory(transactions) {
    return transactions.reduce((groups, transaction) => {
      const category = transaction.category || '其他';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(transaction);
      return groups;
    }, {});
  }

  groupBySolarTerms(transactions) {
    const solarTerms = this.getSolarTerms();
    
    return transactions.map(transaction => {
      const date = new Date(transaction.date);
      const term = this.findSolarTerm(date, solarTerms);
      
      return {
        ...transaction,
        solarTerm: term.name,
        solarTermIndex: term.index,
        solarTermDate: term.date
      };
    });
  }

  aggregateBySolarTerms(transactions) {
    const withTerms = this.groupBySolarTerms(transactions);
    const solarTerms = this.getSolarTerms();
    
    const aggregated = solarTerms.map((term, index) => {
      const termTransactions = withTerms.filter(t => t.solarTermIndex === index);
      const totalAmount = termTransactions.reduce((sum, t) => sum + t.amount, 0);
      
      return {
        index: index,
        name: term.name,
        nameEn: term.nameEn,
        date: term.date,
        totalAmount: totalAmount,
        transactionCount: termTransactions.length,
        transactions: termTransactions
      };
    });
    
    return aggregated;
  }

  getSolarTerms() {
    return [
      { name: '立春', nameEn: 'Start of Spring', date: '02-04' },
      { name: '雨水', nameEn: 'Rain Water', date: '02-19' },
      { name: '惊蛰', nameEn: 'Awakening of Insects', date: '03-05' },
      { name: '春分', nameEn: 'Spring Equinox', date: '03-20' },
      { name: '清明', nameEn: 'Pure Brightness', date: '04-05' },
      { name: '谷雨', nameEn: 'Grain Rain', date: '04-20' },
      { name: '立夏', nameEn: 'Start of Summer', date: '05-05' },
      { name: '小满', nameEn: 'Grain Buds', date: '05-21' },
      { name: '芒种', nameEn: 'Grain in Ear', date: '06-05' },
      { name: '夏至', nameEn: 'Summer Solstice', date: '06-21' },
      { name: '小暑', nameEn: 'Minor Heat', date: '07-07' },
      { name: '大暑', nameEn: 'Major Heat', date: '07-22' },
      { name: '立秋', nameEn: 'Start of Autumn', date: '08-07' },
      { name: '处暑', nameEn: 'End of Heat', date: '08-23' },
      { name: '白露', nameEn: 'White Dew', date: '09-07' },
      { name: '秋分', nameEn: 'Autumn Equinox', date: '09-23' },
      { name: '寒露', nameEn: 'Cold Dew', date: '10-08' },
      { name: '霜降', nameEn: 'Frost\'s Descent', date: '10-23' },
      { name: '立冬', nameEn: 'Start of Winter', date: '11-07' },
      { name: '小雪', nameEn: 'Minor Snow', date: '11-22' },
      { name: '大雪', nameEn: 'Major Snow', date: '12-07' },
      { name: '冬至', nameEn: 'Winter Solstice', date: '12-21' },
      { name: '小寒', nameEn: 'Minor Cold', date: '01-05' },
      { name: '大寒', nameEn: 'Major Cold', date: '01-20' }
    ];
  }

  findSolarTerm(date, solarTerms) {
    const monthDay = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    for (let i = 0; i < solarTerms.length; i++) {
      if (monthDay >= solarTerms[i].date) {
        const nextIndex = (i + 1) % solarTerms.length;
        if (i === solarTerms.length - 1 || monthDay < solarTerms[nextIndex].date) {
          return { ...solarTerms[i], index: i };
        }
      }
    }
    
    return { ...solarTerms[solarTerms.length - 1], index: solarTerms.length - 1 };
  }
}

module.exports = new AnalysisService();
