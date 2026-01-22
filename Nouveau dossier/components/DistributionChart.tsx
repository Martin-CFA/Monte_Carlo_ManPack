import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface DistributionChartProps {
  data: number[];
  currentSpot: number;
  isDarkMode?: boolean;
  binCount?: number;
}

export const DistributionChart: React.FC<DistributionChartProps> = ({ 
  data, 
  currentSpot, 
  isDarkMode = false, 
  binCount = 40 
}) => {
  
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    let min = Infinity;
    let max = -Infinity;
    
    for (let i = 0; i < data.length; i++) {
        const val = data[i];
        if (val < min) min = val;
        if (val > max) max = val;
    }

    if (!isFinite(min) || !isFinite(max)) return [];

    // Use dynamic binCount prop
    const binsToUse = binCount;
    
    if (min === max) {
         return [{
            rangeStart: min,
            rangeEnd: max,
            mid: min,
            name: min.toFixed(0),
            count: data.length
        }];
    }

    const step = (max - min) / binsToUse;
    
    const bins = Array(binsToUse).fill(0).map((_, i) => ({
      rangeStart: min + i * step,
      rangeEnd: min + (i + 1) * step,
      mid: min + (i * step) + (step / 2),
      // Store numeric mid for calculating name later if needed, but store name as string for XAxis
      name: (min + (i * step) + (step / 2)),
      count: 0
    }));

    data.forEach(val => {
      let index = Math.floor((val - min) / step);
      if (index >= binsToUse) index = binsToUse - 1; 
      if (index < 0) index = 0;
      
      if (bins[index]) {
          bins[index].count++;
      }
    });

    return bins;
  }, [data, binCount]);

  const axisColor = isDarkMode ? '#94a3b8' : '#64748b'; // Slate-400 : Slate-500
  const gridColor = isDarkMode ? '#334155' : '#e2e8f0'; // Slate-700 : Slate-200
  const tooltipBg = isDarkMode ? '#1e293b' : '#ffffff'; // Slate-800 : White
  const tooltipText = isDarkMode ? '#f8fafc' : '#475569'; // Slate-50 : Slate-600

  // Helper for thousand separators
  const formatNumber = (num: number) => num.toLocaleString('en-US', { maximumFractionDigits: 0 });

  if (chartData.length === 0) return <div className="dark:text-slate-400">No distribution data generated</div>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{
          top: 20,
          right: 30,
          left: 20,
          bottom: 5,
        }}
        barCategoryGap={1}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
        <XAxis 
          dataKey="name" 
          tickFormatter={(val) => formatNumber(Number(val))}
          tick={{fontSize: 12, fill: axisColor}} 
          label={{ value: 'Terminal Price (ST)', position: 'insideBottom', offset: -5, fill: axisColor }}
          stroke={gridColor}
        />
        <YAxis 
          tickFormatter={(val) => formatNumber(val)}
          tick={{fontSize: 12, fill: axisColor}}
          label={{ value: 'Frequency', angle: -90, position: 'insideLeft', fill: axisColor }}
          stroke={gridColor}
        />
        <Tooltip 
          contentStyle={{ 
            borderRadius: '8px', 
            border: 'none', 
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            backgroundColor: tooltipBg,
            color: tooltipText
          }}
          labelStyle={{ color: tooltipText, fontWeight: 600 }}
          formatter={(value: number) => [formatNumber(value), 'Occurrences']}
          labelFormatter={(label) => `Price ~ ${formatNumber(Number(label))}`}
          cursor={{fill: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}}
        />
        <ReferenceLine 
          x={currentSpot} 
          stroke="#ef4444" 
          strokeDasharray="3 3" 
          label={{ 
            position: 'top', 
            value: `Spot: ${formatNumber(currentSpot)}`, 
            fill: '#ef4444', 
            fontSize: 12 
          }} 
        />
        <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};