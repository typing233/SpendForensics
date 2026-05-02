import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Calendar, ChevronDown, Info } from 'lucide-react';

const SOLAR_TERMS = [
  { name: '立春', nameEn: 'Start of Spring', date: '02-04', season: 'spring' },
  { name: '雨水', nameEn: 'Rain Water', date: '02-19', season: 'spring' },
  { name: '惊蛰', nameEn: 'Awakening of Insects', date: '03-05', season: 'spring' },
  { name: '春分', nameEn: 'Spring Equinox', date: '03-20', season: 'spring' },
  { name: '清明', nameEn: 'Pure Brightness', date: '04-05', season: 'spring' },
  { name: '谷雨', nameEn: 'Grain Rain', date: '04-20', season: 'spring' },
  { name: '立夏', nameEn: 'Start of Summer', date: '05-05', season: 'summer' },
  { name: '小满', nameEn: 'Grain Buds', date: '05-21', season: 'summer' },
  { name: '芒种', nameEn: 'Grain in Ear', date: '06-05', season: 'summer' },
  { name: '夏至', nameEn: 'Summer Solstice', date: '06-21', season: 'summer' },
  { name: '小暑', nameEn: 'Minor Heat', date: '07-07', season: 'summer' },
  { name: '大暑', nameEn: 'Major Heat', date: '07-22', season: 'summer' },
  { name: '立秋', nameEn: 'Start of Autumn', date: '08-07', season: 'autumn' },
  { name: '处暑', nameEn: 'End of Heat', date: '08-23', season: 'autumn' },
  { name: '白露', nameEn: 'White Dew', date: '09-07', season: 'autumn' },
  { name: '秋分', nameEn: 'Autumn Equinox', date: '09-23', season: 'autumn' },
  { name: '寒露', nameEn: 'Cold Dew', date: '10-08', season: 'autumn' },
  { name: '霜降', nameEn: 'Frost\'s Descent', date: '10-23', season: 'autumn' },
  { name: '立冬', nameEn: 'Start of Winter', date: '11-07', season: 'winter' },
  { name: '小雪', nameEn: 'Minor Snow', date: '11-22', season: 'winter' },
  { name: '大雪', nameEn: 'Major Snow', date: '12-07', season: 'winter' },
  { name: '冬至', nameEn: 'Winter Solstice', date: '12-21', season: 'winter' },
  { name: '小寒', nameEn: 'Minor Cold', date: '01-05', season: 'winter' },
  { name: '大寒', nameEn: 'Major Cold', date: '01-20', season: 'winter' }
];

const SEASON_COLORS = {
  spring: { main: '#22c55e', light: '#166534', glow: 'rgba(34, 197, 94, 0.5)' },
  summer: { main: '#f97316', light: '#c2410c', glow: 'rgba(249, 115, 22, 0.5)' },
  autumn: { main: '#ef4444', light: '#b91c1c', glow: 'rgba(239, 68, 68, 0.5)' },
  winter: { main: '#3b82f6', light: '#1d4ed8', glow: 'rgba(59, 130, 246, 0.5)' }
};

function SolarTermsChart({ solarTermsData }) {
  const svgRef = useRef(null);
  const [selectedTerm, setSelectedTerm] = useState(null);
  const [hoveredTerm, setHoveredTerm] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const data = solarTermsData || SOLAR_TERMS.map((term, index) => ({
    ...term,
    index,
    totalAmount: Math.random() * 5000 + 500,
    transactionCount: Math.floor(Math.random() * 20) + 3
  }));

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 600;
    const height = 600;
    const centerX = width / 2;
    const centerY = height / 2;

    svg.attr('viewBox', `0 0 ${width} ${height}`)
       .attr('preserveAspectRatio', 'xMidYMid meet');

    const defs = svg.append('defs');
    
    const filter = defs.append('filter')
      .attr('id', 'glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');
    
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'coloredBlur');
    
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const maxAmount = Math.max(...data.map(d => d.totalAmount));
    const outerRadius = Math.min(width, height) / 2 - 60;
    const innerRadius = outerRadius * 0.5;
    const barWidth = (2 * Math.PI) / data.length * 0.7;

    const arc = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(d => innerRadius + (d.totalAmount / maxAmount) * (outerRadius - innerRadius))
      .startAngle((d, i) => (i / data.length) * 2 * Math.PI - Math.PI / 2 - barWidth / 2)
      .endAngle((d, i) => (i / data.length) * 2 * Math.PI - Math.PI / 2 + barWidth / 2)
      .padAngle(0.02)
      .padRadius(innerRadius);

    const mainGroup = svg.append('g')
      .attr('transform', `translate(${centerX}, ${centerY})`);

    const seasonLabels = [
      { name: '春', season: 'spring', startAngle: -Math.PI / 3, endAngle: Math.PI / 6 },
      { name: '夏', season: 'summer', startAngle: Math.PI / 6, endAngle: 2 * Math.PI / 3 },
      { name: '秋', season: 'autumn', startAngle: 2 * Math.PI / 3, endAngle: 7 * Math.PI / 6 },
      { name: '冬', season: 'winter', startAngle: 7 * Math.PI / 6, endAngle: 5 * Math.PI / 3 }
    ];

    seasonLabels.forEach(season => {
      const midAngle = (season.startAngle + season.endAngle) / 2;
      const radius = outerRadius + 45;
      const x = Math.cos(midAngle - Math.PI / 2) * radius;
      const y = Math.sin(midAngle - Math.PI / 2) * radius;
      
      const seasonArc = d3.arc()
        .innerRadius(outerRadius + 25)
        .outerRadius(outerRadius + 30)
        .startAngle(season.startAngle - Math.PI / 2)
        .endAngle(season.endAngle - Math.PI / 2);

      mainGroup.append('path')
        .attr('d', seasonArc)
        .attr('fill', SEASON_COLORS[season.season].main)
        .attr('opacity', 0.8);

      mainGroup.append('text')
        .attr('x', x)
        .attr('y', y)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', SEASON_COLORS[season.season].main)
        .attr('font-size', '18px')
        .attr('font-weight', 'bold')
        .text(season.name);
    });

    const backgroundArc = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .startAngle((d, i) => (i / data.length) * 2 * Math.PI - Math.PI / 2 - barWidth / 2)
      .endAngle((d, i) => (i / data.length) * 2 * Math.PI - Math.PI / 2 + barWidth / 2);

    mainGroup.selectAll('.background-arc')
      .data(data)
      .enter()
      .append('path')
      .attr('class', 'background-arc')
      .attr('d', backgroundArc)
      .attr('fill', '#1e293b')
      .attr('stroke', '#334155')
      .attr('stroke-width', 1);

    mainGroup.selectAll('.arc')
      .data(data)
      .enter()
      .append('path')
      .attr('class', 'arc')
      .attr('d', arc)
      .attr('fill', d => SEASON_COLORS[d.season].main)
      .attr('opacity', d => 
        hoveredTerm !== null ? (hoveredTerm === d.index ? 1 : 0.3) : 0.8
      )
      .attr('stroke', d => 
        selectedTerm === d.index ? '#ffffff' : SEASON_COLORS[d.season].light
      )
      .attr('stroke-width', d => selectedTerm === d.index ? 3 : 1)
      .attr('filter', d => hoveredTerm === d.index ? 'url(#glow)' : null)
      .style('cursor', 'pointer')
      .on('mouseover', (event, d) => {
        setHoveredTerm(d.index);
      })
      .on('mouseout', () => {
        setHoveredTerm(null);
      })
      .on('click', (event, d) => {
        setSelectedTerm(selectedTerm === d.index ? null : d.index);
      });

    const termLabels = mainGroup.selectAll('.term-label')
      .data(data)
      .enter()
      .append('g')
      .attr('class', 'term-label')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        setSelectedTerm(selectedTerm === d.index ? null : d.index);
      });

    termLabels.each(function(d, i) {
      const angle = (i / data.length) * 2 * Math.PI - Math.PI / 2;
      const labelRadius = innerRadius * 0.7;
      const x = Math.cos(angle) * labelRadius;
      const y = Math.sin(angle) * labelRadius;
      
      const group = d3.select(this);
      
      group.append('text')
        .attr('x', x)
        .attr('y', y - 3)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', selectedTerm === d.index ? '#ffffff' : '#94a3b8')
        .attr('font-size', '11px')
        .attr('font-weight', selectedTerm === d.index ? 'bold' : 'normal')
        .text(d.name);

      if (selectedTerm === d.index) {
        group.append('text')
          .attr('x', x)
          .attr('y', y + 10)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('fill', SEASON_COLORS[d.season].main)
          .attr('font-size', '10px')
          .text(`¥${d.totalAmount.toFixed(0)}`);
      }
    });

    mainGroup.append('circle')
      .attr('r', innerRadius * 0.45)
      .attr('fill', 'rgba(15, 23, 42, 0.8)')
      .attr('stroke', '#334155')
      .attr('stroke-width', 2);

    if (selectedTerm !== null) {
      const term = data[selectedTerm];
      mainGroup.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('y', -15)
        .attr('fill', '#ffffff')
        .attr('font-size', '20px')
        .attr('font-weight', 'bold')
        .text(term.name);
      
      mainGroup.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('y', 10)
        .attr('fill', SEASON_COLORS[term.season].main)
        .attr('font-size', '16px')
        .attr('font-weight', 'bold')
        .text(`¥${term.totalAmount.toLocaleString()}`);
      
      mainGroup.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('y', 32)
        .attr('fill', '#94a3b8')
        .attr('font-size', '11px')
        .text(`${term.transactionCount} 笔交易`);
    } else {
      mainGroup.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('y', -10)
        .attr('fill', '#ffffff')
        .attr('font-size', '14px')
        .text('二十四节气');
      
      mainGroup.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('y', 15)
        .attr('fill', '#94a3b8')
        .attr('font-size', '11px')
        .text('点击节气查看详情');
    }

  }, [data, selectedTerm, hoveredTerm]);

  const totalAmount = data.reduce((sum, d) => sum + d.totalAmount, 0);
  const totalTransactions = data.reduce((sum, d) => sum + d.transactionCount, 0);

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 overflow-hidden">
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-emerald-400" />
            <div>
              <h2 className="text-xl font-semibold text-white">二十四节气环形数据图谱</h2>
              <p className="text-sm text-gray-400">按节气节点重新组织的全年流水数据</p>
            </div>
          </div>
          
          <div className="flex gap-6 text-sm">
            <div className="text-right">
              <p className="text-gray-400">年度总支出</p>
              <p className="text-white font-semibold text-lg">¥{totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-400">总交易笔数</p>
              <p className="text-indigo-400 font-semibold text-lg">{totalTransactions}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-6">
          {Object.entries(SEASON_COLORS).map(([season, colors]) => {
            const seasonData = data.filter(d => d.season === season);
            const seasonAmount = seasonData.reduce((sum, d) => sum + d.totalAmount, 0);
            const seasonName = season === 'spring' ? '春' : 
                              season === 'summer' ? '夏' : 
                              season === 'autumn' ? '秋' : '冬';
            
            return (
              <div key={season} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: colors.main }}
                />
                <span className="text-sm text-gray-300">{seasonName}季</span>
                <span className="text-sm font-medium" style={{ color: colors.main }}>
                  ¥{seasonAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-6 flex justify-center">
        <div className="w-full max-w-xl">
          <svg ref={svgRef} style={{ width: '100%', height: 'auto' }} />
        </div>
      </div>

      <div className="px-6 pb-6">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-4 bg-gray-700/30 rounded-xl hover:bg-gray-700/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-300">查看所有节气详细数据</span>
          </div>
          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>

        {isExpanded && (
          <div className="mt-4 grid grid-cols-4 gap-3">
            {data.map((term, index) => (
              <button
                key={term.index}
                onClick={() => setSelectedTerm(selectedTerm === index ? null : index)}
                className={`p-3 rounded-xl text-left transition-all ${
                  selectedTerm === index
                    ? 'bg-gray-700 ring-2 ring-indigo-500'
                    : 'bg-gray-700/30 hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: SEASON_COLORS[term.season].main }}
                  />
                  <span className="text-sm font-medium text-white">{term.name}</span>
                </div>
                <p className="text-xs text-gray-400">{term.date}</p>
                <p className="text-sm font-semibold mt-1" style={{ color: SEASON_COLORS[term.season].main }}>
                  ¥{term.totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-gray-500">{term.transactionCount} 笔</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SolarTermsChart;
