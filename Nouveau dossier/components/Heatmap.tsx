import React, { useMemo } from 'react';
import { ScenarioRow } from '../types';

interface HeatmapProps {
  data: ScenarioRow[];
  s0Pivot: number;
  volPivot: number;
  isDarkMode?: boolean;
}

export const Heatmap: React.FC<HeatmapProps> = ({ data, s0Pivot, volPivot, isDarkMode = false }) => {
  
  // Extract unique sorted axes
  // S0 on Columns (X-axis): Sort Ascending (Low -> High)
  const s0Axis = useMemo(() => Array.from(new Set(data.map(d => d.s0))).sort((a: number, b: number) => a - b), [data]); 
  // Vol on Rows (Y-axis): Sort Ascending (Low -> High)
  const volAxis = useMemo(() => Array.from(new Set(data.map(d => d.vol))).sort((a: number, b: number) => a - b), [data]);

  // Color scale logic
  const minPrice = Math.min(...data.map(d => d.price));
  const maxPrice = Math.max(...data.map(d => d.price));
  
  const getColor = (price: number) => {
    if (maxPrice === minPrice) return isDarkMode ? '#1e293b' : 'rgb(243, 244, 246)'; // Slate-800 : Gray-100
    
    // Normalize 0-1
    const ratio = (price - minPrice) / (maxPrice - minPrice);
    
    if (isDarkMode) {
      // Dark Mode: Interpolate between Slate-900 (#0f172a) and Indigo-500 (#6366f1)
      const opacity = 0.2 + (ratio * 0.8);
      return `rgba(99, 102, 241, ${opacity})`; // Indigo-500
    } else {
      // Light Mode: Indigo-600 with opacity
      const opacity = 0.1 + (ratio * 0.9);
      return `rgba(79, 70, 229, ${opacity})`; 
    }
  };

  const getTextContrast = (price: number) => {
    const ratio = (price - minPrice) / (maxPrice - minPrice);
    if (isDarkMode) {
      return ratio > 0.4 ? 'white' : '#94a3b8'; // Slate-400 for inactive-ish
    } else {
      return ratio > 0.6 ? 'white' : '#1e293b'; // Slate-800
    }
  };

  // Helper for formatting price (No decimals, thousand separators)
  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  const axisHeaderClass = "p-3 text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400";
  const axisHighlightClass = "p-3 text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 ring-2 ring-inset ring-indigo-200 dark:ring-indigo-700";

  if (data.length === 0) return <div className="dark:text-slate-400">No data available</div>;

  return (
    <div className="overflow-x-auto pb-4">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="p-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              Vol \ S0
            </th>
            {s0Axis.map(s0 => (
              <th key={s0} className={Math.abs(s0 - s0Pivot) < 0.01 ? axisHighlightClass : axisHeaderClass}>
                <div className="flex flex-col items-center">
                    <span>{s0.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {volAxis.map(vol => (
            <tr key={vol}>
              <th className={`text-right ${Math.abs(vol - volPivot) < 0.0001 ? axisHighlightClass : axisHeaderClass}`}>
                {(vol * 100).toFixed(2)}%
              </th>
              {s0Axis.map(s0 => {
                const cell = data.find(d => Math.abs(d.s0 - s0) < 0.001 && Math.abs(d.vol - vol) < 0.0001);
                const price = cell ? cell.price : 0;
                return (
                  <td 
                    key={`${vol}-${s0}`} 
                    className="p-4 text-center text-sm font-medium border border-slate-200 dark:border-slate-700 transition-all hover:scale-105 hover:shadow-lg cursor-default relative group"
                    style={{ backgroundColor: getColor(price), color: getTextContrast(price) }}
                  >
                     {formatPrice(price)}
                     <div className="absolute opacity-0 group-hover:opacity-100 bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 dark:bg-slate-700 text-white text-xs py-1 px-2 rounded shadow-xl pointer-events-none whitespace-nowrap z-50">
                        Vol: {(vol*100).toFixed(2)}% | S0: {s0.toFixed(0)}
                     </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};