import React, { useMemo } from 'react';
import { SimulationResult, SimulationParams } from '../types';

interface ResultTableProps {
  results: SimulationResult;
  params: SimulationParams;
  isDarkMode?: boolean;
}

export const ResultTable: React.FC<ResultTableProps> = ({ results, params, isDarkMode = false }) => {
  // Helper to format numbers
  const fmt = (num: number) => num.toLocaleString('en-US', { maximumFractionDigits: 0 });
  const fmtPct = (num: number) => `${(num * 100).toFixed(2)}%`;

  // 1. Identify the specific 27 columns based on the requirement
  // Indices refer to the generated arrays (0 to 4). 
  // 2 is Pivot, 1 is Pivot-Step, 3 is Pivot+Step.
  
  const colDefs = useMemo(() => {
    const cols: { sIdx: number; vIdx: number; tIdx: number; label: string }[] = [];

    // --- Part 1: Central Scenario for T1, T2, T3 ---
    // Columns 1, 2, 3
    [0, 1, 2].forEach(tIdx => {
      cols.push({ sIdx: 2, vIdx: 2, tIdx: tIdx, label: 'Pivot' });
    });

    // --- Part 2: Detailed Scenarios for each Maturity ---
    // Pattern for S/Vol per maturity block:
    // s0-pas1 (Idx 1): Vol0 (2), Vol- (1), Vol+ (3)
    // s0 (Idx 2):      Vol- (1), Vol+ (3)  <-- Note: Vol0 is skipped here as it was in Part 1?
    //                  Wait, prompt image shows: s0 (Vol-pas1), s0 (Vol+pas1)
    // s0+pas1 (Idx 3): Vol0 (2), Vol- (1), Vol+ (3)

    [0, 1, 2].forEach(tIdx => {
      // Group: s0-pas1
      cols.push({ sIdx: 1, vIdx: 2, tIdx, label: 'S-' });      // S-, V0
      cols.push({ sIdx: 1, vIdx: 1, tIdx, label: 'S-, V-' });  // S-, V-
      cols.push({ sIdx: 1, vIdx: 3, tIdx, label: 'S-, V+' });  // S-, V+
      
      // Group: s0 (Pivot) - Only V- and V+ (V0 is handled in Part 1? 
      // Actually, standard pivot tables usually duplicate or split. 
      // Following the specific screenshot text order:
      // "s0-pas1 ... s0 ... s0+pas1"
      // The screenshot text pattern described in the prompt:
      // Cols 7,8 (Maturity 1 block) were S0/Vol- and S0/Vol+.
      cols.push({ sIdx: 2, vIdx: 1, tIdx, label: 'V-' });      // S0, V-
      cols.push({ sIdx: 2, vIdx: 3, tIdx, label: 'V+' });      // S0, V+

      // Group: s0+pas1
      cols.push({ sIdx: 3, vIdx: 2, tIdx, label: 'S+' });      // S+, V0
      cols.push({ sIdx: 3, vIdx: 1, tIdx, label: 'S+, V-' });  // S+, V-
      cols.push({ sIdx: 3, vIdx: 3, tIdx, label: 'S+, V+' });  // S+, V+
    });

    return cols;
  }, []);

  // 2. Pre-calculate the values for the headers to avoid lookups during render
  // We need to know the actual S0 and Vol values corresponding to indices 1, 2, 3.
  // We can find them by looking at the results where t=first and k=first.
  // The simulation generates all combinations, so we can just grab distinct sorted values.
  
  const s0Values = useMemo(() => {
    if (!results || !results.results) return [];
    const uniqueS0 = Array.from(new Set(results.results.map(r => r.s0))).sort((a: number, b: number) => a - b);
    return uniqueS0; // [0]= -2step, [1]= -1step, [2]= pivot, etc.
  }, [results]);

  const volValues = useMemo(() => {
    if (!results || !results.results) return [];
    const uniqueVol = Array.from(new Set(results.results.map(r => r.vol))).sort((a: number, b: number) => a - b);
    return uniqueVol;
  }, [results]);

  // Check valid state after hooks
  if (!results || results.results.length === 0 || s0Values.length < 5 || volValues.length < 5) return <div>Not enough simulation steps generated</div>;

  // 3. Build the table data
  // Headers
  const headerS0 = colDefs.map(c => s0Values[c.sIdx]);
  const headerVol = colDefs.map(c => volValues[c.vIdx]);
  const headerMat = colDefs.map(c => params.maturities[c.tIdx]);

  // Rows: One per Strike
  const rows = params.strikes.map((k, kIdx) => {
    return {
      strike: k,
      values: colDefs.map(c => {
        // Safety bound check
        if (c.sIdx >= s0Values.length || c.vIdx >= volValues.length || c.tIdx >= params.maturities.length) {
          return 0;
        }

        const sVal = s0Values[c.sIdx];
        const vVal = volValues[c.vIdx];
        const tVal = params.maturities[c.tIdx];
        
        // Find result
        // Note: Floating point comparison needs epsilon
        const match = results.results.find(r => 
          Math.abs(r.s0 - sVal) < 0.001 &&
          Math.abs(r.vol - vVal) < 0.0001 &&
          Math.abs(r.t - tVal) < 0.001 &&
          Math.abs(r.k - k) < 0.001
        );
        return match ? match.price : 0;
      })
    };
  });

  // Styles
  const cellBase = "px-2 py-2 text-right text-xs border-r border-b border-slate-200 dark:border-slate-700 whitespace-nowrap";
  const stickyCol = "sticky left-0 z-10 bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-200 border-r-2 border-slate-300 dark:border-slate-600";
  const headerRowBase = "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium";

  return (
    <div className="overflow-x-auto h-full border rounded-lg border-slate-200 dark:border-slate-700 shadow-sm relative">
      <table className="border-collapse min-w-max">
        <thead>
          {/* Row 1: Stock Price */}
          <tr className={headerRowBase}>
            <th className={`w-32 min-w-[120px] text-left px-3 py-2 border-b border-slate-200 dark:border-slate-700 ${stickyCol}`}>Stock Price :</th>
            {headerS0.map((val, i) => (
              <th key={i} className={cellBase + " font-semibold bg-indigo-50/50 dark:bg-indigo-900/10 text-indigo-700 dark:text-indigo-300"}>
                {fmt(val)}
              </th>
            ))}
          </tr>
          {/* Row 2: Volatility */}
          <tr className={headerRowBase}>
            <th className={`text-left px-3 py-2 border-b border-slate-200 dark:border-slate-700 ${stickyCol}`}>Volatilité</th>
            {headerVol.map((val, i) => (
              <th key={i} className={cellBase}>
                {fmtPct(val)}
              </th>
            ))}
          </tr>
          {/* Row 3: Maturity */}
          <tr className={headerRowBase}>
            <th className={`text-left px-3 py-2 border-b-2 border-slate-300 dark:border-slate-600 ${stickyCol}`}>Maturity</th>
            {headerMat.map((val, i) => (
              <th key={i} className={`${cellBase} border-b-2 border-slate-300 dark:border-slate-600`}>
                {val} Yr
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Header for Strike Column itself isn't a row in the data, but let's label the corner if we want. 
              The requirements say "Strike Price" then "Strike Price 1...16".
          */}
           <tr>
             <td className={`bg-slate-200 dark:bg-slate-700 text-left px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 ${stickyCol}`}>
               Strike Price
             </td>
             <td colSpan={headerS0.length} className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700"></td>
           </tr>

          {rows.map((row, idx) => (
            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <td className={`px-3 py-2 text-left text-xs font-medium border-b border-slate-200 dark:border-slate-700 ${stickyCol}`}>
                {fmt(row.strike)}
              </td>
              {row.values.map((val, vIdx) => (
                <td key={vIdx} className={`${cellBase} ${val === 0 ? 'text-slate-300 dark:text-slate-600' : 'text-slate-700 dark:text-slate-200'}`}>
                  {fmt(val)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};