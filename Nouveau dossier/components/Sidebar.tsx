import React, { useEffect, useState } from 'react';
import { SimulationParams } from '../types';
import { Settings, TrendingUp, BarChart2, Layers } from 'lucide-react';

interface SidebarProps {
  params: SimulationParams;
  setParams: React.Dispatch<React.SetStateAction<SimulationParams>>;
  isSimulating: boolean;
}

// Component to handle number inputs with comma separators for display
const FormattedNumberInput = ({ 
  value, 
  onChange, 
  disabled, 
  className,
}: {
  value: number;
  onChange: (val: number) => void;
  disabled: boolean;
  className: string;
}) => {
  // Local state for display string
  const [display, setDisplay] = useState(value?.toLocaleString('en-US') || '');

  // Sync prop changes to local state (e.g. initial load or reset)
  useEffect(() => {
    // Only update if underlying value matches what we expect, to allow for some drift during typing
    const raw = parseFloat(display.replace(/,/g, ''));
    if (raw !== value) {
        setDisplay(value?.toLocaleString('en-US', { maximumFractionDigits: 10 }) || '');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Basic validation: digits, commas, dots allowed
    if (/^[0-9,.]*$/.test(val)) {
        setDisplay(val);
        // Parse and emit
        const raw = parseFloat(val.replace(/,/g, ''));
        if (!isNaN(raw)) {
            onChange(raw);
        }
    }
  };

  const handleBlur = () => {
      const raw = parseFloat(display.replace(/,/g, ''));
      if (!isNaN(raw)) {
          setDisplay(raw.toLocaleString('en-US', { maximumFractionDigits: 10 }));
      }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={disabled}
      className={className}
    />
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ params, setParams, isSimulating }) => {
  
  const updateParam = (field: keyof SimulationParams, value: number) => {
    setParams(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateMaturity = (index: number, val: number) => {
      setParams(prev => {
          const newMat = [...prev.maturities];
          // Ensure array has enough slots
          while(newMat.length <= index) newMat.push(0);
          newMat[index] = val;
          return { ...prev, maturities: newMat };
      });
  };

  const [strikesText, setStrikesText] = useState(params.strikes.join('\n'));

  // Sync strikes text when params change externally (e.g. init)
  useEffect(() => {
    const currentParsed = strikesText.split(/[\n\t,;]+/).map(s => parseFloat(s)).filter(n=>!isNaN(n));
    if (JSON.stringify(currentParsed) !== JSON.stringify(params.strikes)) {
         setStrikesText(params.strikes.join('\n'));
    }
  }, [params.strikes]);

  const handleStrikesBlur = () => {
      const parts = strikesText.split(/[\n\t,;]+/)
        .map(s => s.trim())
        .filter(s => s !== '');
      const numbers = parts.map(p => parseFloat(p)).filter(n => !isNaN(n));
      
      setParams(prev => ({ ...prev, strikes: numbers }));
  };

  const commonInputClass = "w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow disabled:opacity-60";
  const whiteInputClass = "w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow disabled:opacity-60";

  return (
    <aside className="w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full shadow-xl z-20 overflow-y-auto transition-colors duration-200">
      <div className="p-6 border-b border-slate-100 dark:border-slate-800">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          Configuration
        </h2>
      </div>

      <div className="p-6 space-y-8">
        
        {/* Market Data */}
        <section>
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Market Data
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Free Rate (%)</label>
              <FormattedNumberInput 
                value={params.r}
                onChange={(v) => updateParam('r', v)}
                disabled={isSimulating}
                className={commonInputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Dividend Yield (%)</label>
              <FormattedNumberInput 
                value={params.q}
                onChange={(v) => updateParam('q', v)}
                disabled={isSimulating}
                className={commonInputClass}
              />
            </div>
          </div>
        </section>

        {/* Scenarios */}
        <section>
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4" /> Scenarios (5x5 Matrix)
          </h3>
          
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 block mb-2">Spot Price (S0)</span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Pivot</label>
                  <FormattedNumberInput 
                    value={params.s0}
                    onChange={(v) => updateParam('s0', v)}
                    disabled={isSimulating}
                    className={whiteInputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Step (%)</label>
                  <FormattedNumberInput 
                    value={params.s0Step}
                    onChange={(v) => updateParam('s0Step', v)}
                    disabled={isSimulating}
                    className={whiteInputClass}
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 block mb-2">Volatility (σ)</span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Pivot (%)</label>
                  <FormattedNumberInput 
                    value={params.vol}
                    onChange={(v) => updateParam('vol', v)}
                    disabled={isSimulating}
                    className={whiteInputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Step (%)</label>
                  <FormattedNumberInput 
                    value={params.volStep}
                    onChange={(v) => updateParam('volStep', v)}
                    disabled={isSimulating}
                    className={whiteInputClass}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Product & Sim */}
        <section>
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4" /> Simulation Config
          </h3>
          
          <div className="space-y-4">
             <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Paths (N)</label>
              <FormattedNumberInput 
                value={params.nPaths}
                onChange={(v) => updateParam('nPaths', v)}
                disabled={isSimulating}
                className={commonInputClass}
              />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Recommended: 10,000 - 200,000</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Maturities (Y)</label>
              <div className="grid grid-cols-3 gap-2">
                 {[0, 1, 2].map((i) => (
                    <input
                      key={i}
                      type="number"
                      step="0.1"
                      disabled={isSimulating}
                      value={params.maturities[i] || ''}
                      onChange={(e) => updateMaturity(i, parseFloat(e.target.value))}
                      className={commonInputClass}
                      placeholder={`Mat ${i+1}`}
                    />
                 ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Strikes</label>
              <textarea 
                disabled={isSimulating}
                value={strikesText}
                onChange={(e) => setStrikesText(e.target.value)}
                onBlur={handleStrikesBlur}
                className={`${commonInputClass} h-32 font-mono text-xs`}
                placeholder="Paste strikes here (Excel column)..."
              />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Paste multiple cells from Excel</p>
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
};