import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Heatmap } from './components/Heatmap';
import { DistributionChart } from './components/DistributionChart';
import { ResultTable } from './components/ResultTable';
import { SimulationParams, SimulationResult } from './types';
import { runFullSimulation, generateGeometricScenarios, generateArithmeticScenarios } from './services/monteCarlo';
import { Download, Play, Activity, Grid3X3, BarChart3, Moon, Sun, SlidersHorizontal, Table as TableIcon, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

const App: React.FC = () => {
  const [params, setParams] = useState<SimulationParams>({
    s0: 50000,
    s0Step: 2.5,
    vol: 20,
    volStep: 1.0,
    r: 3, 
    q: 0, 
    nPaths: 200000,
    maturities: [4.0, 5.0, 6.0], 
    strikes: [50000, 52000],
  });

  const [isSimulating, setIsSimulating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [results, setResults] = useState<SimulationResult | null>(null);
  const [activeTab, setActiveTab] = useState<'heatmap' | 'distribution' | 'table'>('heatmap');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [binCount, setBinCount] = useState<number>(50); // Default granularity
  
  // Apply dark mode class to html element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Selection state for visualization
  const [selectedMaturity, setSelectedMaturity] = useState<number>(0);
  const [selectedStrike, setSelectedStrike] = useState<number>(0);

  const handleRunSimulation = useCallback(async () => {
    setIsSimulating(true);
    // Use setTimeout to allow UI to render the loading state before heavy calculation blocks the thread
    setTimeout(() => {
      try {
        const simResults = runFullSimulation(params);
        setResults(simResults);
        if (simResults.results.length > 0) {
            // Set defaults for dropdowns
            setSelectedMaturity(params.maturities[0]);
            setSelectedStrike(params.strikes[0]);
        }
      } catch (error) {
        console.error("Simulation failed", error);
        alert("Simulation failed. Please check your inputs.");
      } finally {
        setIsSimulating(false);
      }
    }, 100);
  }, [params]);

  const handleExportExcel = useCallback(() => {
    if (!results) return;
    
    setIsExporting(true);

    // Defer execution to let React render the loading state
    setTimeout(() => {
        try {
            // --- Prepare Column Metadata (Replicating ResultTable logic) ---
            // We need 27 columns + 1 label column.
            // Logic: 0-2 (Pivot T1-T3), then blocks of 8 for each T.
            const colDefs: { sIdx: number; vIdx: number; tIdx: number }[] = [];
            
            // Part 1
            [0, 1, 2].forEach(tIdx => colDefs.push({ sIdx: 2, vIdx: 2, tIdx }));
            // Part 2
            [0, 1, 2].forEach(tIdx => {
            colDefs.push({ sIdx: 1, vIdx: 2, tIdx });
            colDefs.push({ sIdx: 1, vIdx: 1, tIdx });
            colDefs.push({ sIdx: 1, vIdx: 3, tIdx });
            colDefs.push({ sIdx: 2, vIdx: 1, tIdx });
            colDefs.push({ sIdx: 2, vIdx: 3, tIdx });
            colDefs.push({ sIdx: 3, vIdx: 2, tIdx });
            colDefs.push({ sIdx: 3, vIdx: 1, tIdx });
            colDefs.push({ sIdx: 3, vIdx: 3, tIdx });
            });

            // Re-generate axis values
            const s0Values = generateGeometricScenarios(params.s0, params.s0Step);
            const volValues = generateArithmeticScenarios(params.vol/100, params.volStep);
            
            // Build Header Rows (used for both sheets)
            const headerRow1 = ["Stock Price :", ...colDefs.map(c => s0Values[c.sIdx])];
            const headerRow2 = ["Volatilité", ...colDefs.map(c => volValues[c.vIdx])];
            const headerRow3 = ["Maturity", ...colDefs.map(c => params.maturities[c.tIdx])];

            // --- SHEET 1: Detailed Scenarios Matrix ---
            const sheet1Data: (string | number)[][] = [
                headerRow1,
                headerRow2,
                headerRow3,
                ["Strike Price"] // Empty cells for the rest
            ];

            // Add pricing rows
            params.strikes.forEach(strike => {
                const row: (string | number)[] = [strike];
                colDefs.forEach(c => {
                    const sVal = s0Values[c.sIdx];
                    const vVal = volValues[c.vIdx];
                    const tVal = params.maturities[c.tIdx];

                    const match = results.results.find(r => 
                        Math.abs(r.s0 - sVal) < 0.001 &&
                        Math.abs(r.vol - vVal) < 0.0001 &&
                        Math.abs(r.t - tVal) < 0.001 &&
                        Math.abs(r.k - strike) < 0.001
                    );
                    row.push(match ? match.price : 0);
                });
                sheet1Data.push(row);
            });

            // --- SHEET 2: Simulated Paths (200k last entries) ---
            // Row 4 start: Col A = Index (1..200k), Col B.. = Paths
            const sheet2Data: (string | number)[][] = [
                headerRow1,
                headerRow2,
                headerRow3
            ];

            // Determine number of rows to export (Last 200,000)
            const totalPaths = params.nPaths;
            const exportCount = Math.min(totalPaths, 200000);
            const startIndex = totalPaths - exportCount;

            // Transpose detailedPaths into rows
            // This is computationally intensive. We'll do it in chunks if needed, but for 200k rows it might freeze UI briefly.
            // Optimization: Pre-allocate array size? Javascript arrays are dynamic.
            
            // Warning: Creating 200,000 rows array might be heavy (~50MB+ data).
            // We iterate row by row.
            for (let i = 0; i < exportCount; i++) {
                const pathIdx = startIndex + i;
                const row: (number | string)[] = [i + 1]; // Index 1-based
                
                // Push value for each column 0..26
                for (let c = 0; c < colDefs.length; c++) {
                    // Safety check
                    if (results.detailedPaths[c] && results.detailedPaths[c].length > pathIdx) {
                        row.push(results.detailedPaths[c][pathIdx]);
                    } else {
                        row.push("");
                    }
                }
                sheet2Data.push(row);
            }

            // Create Workbook
            const wb = XLSX.utils.book_new();
            
            const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
            XLSX.utils.book_append_sheet(wb, ws1, "Detailed Scenarios");
            
            const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
            XLSX.utils.book_append_sheet(wb, ws2, "Simulated Paths");

            XLSX.writeFile(wb, "MonteCarlo_Analysis.xlsx");
        } catch (error) {
            console.error("Export failed", error);
            alert("Export failed. The dataset might be too large.");
        } finally {
            setIsExporting(false);
        }
    }, 100);

  }, [results, params]);

  // Filter results for the heatmap based on selection
  const currentHeatmapData = useMemo(() => {
    if (!results) return [];
    return results.results.filter(
      r => r.t === selectedMaturity && r.k === selectedStrike
    );
  }, [results, selectedMaturity, selectedStrike]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      {/* Sidebar */}
      <Sidebar params={params} setParams={setParams} isSimulating={isSimulating} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-6 flex justify-between items-center sticky top-0 z-10 transition-colors duration-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Activity className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              Monte Carlo Option Pricer
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Stochastic financial modeling dashboard</p>
          </div>
          
          <div className="flex gap-3 items-center">
             <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
              title="Toggle Dark Mode"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <button
              onClick={handleRunSimulation}
              disabled={isSimulating}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-white transition-all shadow-lg shadow-indigo-200 dark:shadow-none ${
                isSimulating 
                  ? 'bg-indigo-400 dark:bg-indigo-600 cursor-wait' 
                  : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 dark:bg-indigo-600 dark:hover:bg-indigo-500'
              }`}
            >
              {isSimulating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Run Simulation
                </>
              )}
            </button>

            {results && (
              <button
                onClick={handleExportExcel}
                disabled={isExporting}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors ${isExporting ? 'cursor-wait opacity-80' : ''}`}
              >
                {isExporting ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Exporting...
                    </>
                ) : (
                    <>
                        <Download className="w-4 h-4" />
                        Export Excel
                    </>
                )}
              </button>
            )}
          </div>
        </header>

        <main className="p-6 flex-1 bg-slate-50/50 dark:bg-slate-950">
          {!results ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/50 transition-colors">
              <Activity className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">Ready to Simulate</p>
              <p className="text-sm">Configure parameters in the sidebar and click Run.</p>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Tabs */}
              <div className="flex space-x-1 bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-xl w-fit transition-colors">
                <button
                  onClick={() => setActiveTab('heatmap')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'heatmap' 
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <Grid3X3 className="w-4 h-4" />
                  Pricing Matrix
                </button>
                <button
                  onClick={() => setActiveTab('distribution')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'distribution' 
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Price Distribution
                </button>
                <button
                  onClick={() => setActiveTab('table')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'table' 
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <TableIcon className="w-4 h-4" />
                  Detailed Scenarios
                </button>
              </div>

              {/* Tab Content */}
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 min-h-[500px] transition-colors">
                {activeTab === 'heatmap' && (
                  <div className="space-y-6">
                    <div className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 transition-colors">
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Maturity (Years)</label>
                        <select 
                          value={selectedMaturity}
                          onChange={(e) => setSelectedMaturity(Number(e.target.value))}
                          className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                        >
                          {params.maturities.map(m => (
                            <option key={m} value={m}>{m} Years</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Strike Price (K)</label>
                        <select 
                          value={selectedStrike}
                          onChange={(e) => setSelectedStrike(Number(e.target.value))}
                          className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                        >
                          {params.strikes.map(k => (
                            <option key={k} value={k}>{k.toLocaleString()}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    <Heatmap 
                      data={currentHeatmapData} 
                      s0Pivot={params.s0}
                      volPivot={params.vol / 100}
                      isDarkMode={isDarkMode}
                    />
                  </div>
                )}

                {activeTab === 'distribution' && (
                  <div className="h-full">
                    <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Terminal Price Distribution ($S_T$)</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                          Distribution for the Central Scenario (Spot: {params.s0.toLocaleString()}, Vol: {params.vol}%) at first maturity/strike.
                        </p>
                      </div>
                      
                      {/* Granularity Control */}
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700 min-w-[200px]">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            Granularity
                          </label>
                          <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded">
                            {binCount} Bins
                          </span>
                        </div>
                        <input 
                          type="range" 
                          min="10" 
                          max="150" 
                          step="5"
                          value={binCount} 
                          onChange={(e) => setBinCount(Number(e.target.value))}
                          className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                      </div>
                    </div>
                    
                    <div className="h-[400px] w-full">
                      <DistributionChart 
                        data={results.centralDistribution} 
                        currentSpot={params.s0} 
                        isDarkMode={isDarkMode}
                        binCount={binCount}
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'table' && (
                  <div className="h-full overflow-hidden">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Detailed Scenarios Matrix</h3>
                    <ResultTable 
                      results={results}
                      params={params}
                      isDarkMode={isDarkMode}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;