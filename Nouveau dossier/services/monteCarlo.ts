import { SimulationParams, SimulationResult, ScenarioRow } from '../types';

// Box-Muller Transform for Standard Normal Distribution
function gaussianRandom(): number {
  let u = 0, v = 0;
  while(u === 0) u = Math.random(); 
  while(v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Generate Geometric Scenarios (for Spot Price)
// Logic: Percentage change relative to the pivot.
// Formula: [P*(1-s)^2, P*(1-s), P, P*(1+s), P*(1+s)^2]
export const generateGeometricScenarios = (pivot: number, stepPercent: number): number[] => {
  const step = stepPercent / 100;
  return [
    pivot * Math.pow(1 - step, 2),
    pivot * (1 - step),
    pivot,
    pivot * (1 + step),
    pivot * Math.pow(1 + step, 2)
  ];
};

// Generate Arithmetic Scenarios (for Volatility)
// Logic: Absolute percentage point change.
// Formula: [P-2s, P-s, P, P+s, P+2s]
export const generateArithmeticScenarios = (pivot: number, stepPercent: number): number[] => {
  const step = stepPercent / 100;
  return [
    pivot - 2 * step,
    pivot - step,
    pivot,
    pivot + step,
    pivot + 2 * step
  ];
};

// Helper to identify if the current scenario (indices) is one of the 27 Detailed Columns
// Returns index 0-26 if match, -1 otherwise.
// Mapping Logic matches ResultTable.tsx
const getDetailedColumnIndex = (sIdx: number, vIdx: number, tIdx: number): number => {
    // Part 1: Central Scenario for T1, T2, T3 (Cols 0, 1, 2)
    // sIdx=2, vIdx=2
    if (sIdx === 2 && vIdx === 2) {
        return tIdx; // 0, 1, 2
    }

    // Part 2: Blocks for each Maturity
    // Base offset starts after Part 1 (index 3) + block offset (8 per maturity)
    const baseOffset = 3 + (tIdx * 8);

    // Group s0-pas1 (sIdx=1)
    if (sIdx === 1) {
        if (vIdx === 2) return baseOffset + 0; // S-, V0
        if (vIdx === 1) return baseOffset + 1; // S-, V-
        if (vIdx === 3) return baseOffset + 2; // S-, V+
    }
    
    // Group s0 Pivot (sIdx=2) - Note: V0 (2,2) is handled in Part 1.
    if (sIdx === 2) {
        if (vIdx === 1) return baseOffset + 3; // S0, V-
        if (vIdx === 3) return baseOffset + 4; // S0, V+
    }

    // Group s0+pas1 (sIdx=3)
    if (sIdx === 3) {
        if (vIdx === 2) return baseOffset + 5; // S+, V0
        if (vIdx === 1) return baseOffset + 6; // S+, V-
        if (vIdx === 3) return baseOffset + 7; // S+, V+
    }

    return -1;
};

export const runFullSimulation = (params: SimulationParams): SimulationResult => {
  const { r, q, s0, s0Step, vol, volStep, nPaths, maturities, strikes } = params;
  
  // 1. Generate Axes
  // Spot uses Geometric (relative % change)
  const s0List = generateGeometricScenarios(s0, s0Step);
  
  // Volatility uses Arithmetic (absolute point change)
  const volList = generateArithmeticScenarios(vol / 100, volStep);

  const results: ScenarioRow[] = [];
  let centralDistribution: number[] = [];
  
  // Initialize detailedPaths array (27 slots)
  const detailedPaths: number[][] = new Array(27).fill(null).map(() => []);

  // Pre-calculate constants
  const rDec = r / 100;
  const qDec = q / 100;

  // Central indices for distribution chart
  const centralS0Index = 2; // Index 2 is the pivot
  const centralVolIndex = 2; // Index 2 is the pivot
  const targetDistT = maturities[0]; // First maturity for chart
  
  // 2. Iterate Scenarios
  for (let i = 0; i < s0List.length; i++) {
    const currentS0 = s0List[i];
    
    for (let j = 0; j < volList.length; j++) {
      const currentVol = volList[j];
      
      // For each Maturity
      for (let tIdx = 0; tIdx < maturities.length; tIdx++) {
        const t = maturities[tIdx];
        
        // Simulation Core for this (S0, Vol, T) tuple
        const drift = (rDec - qDec - 0.5 * currentVol * currentVol) * t;
        const diffusion = currentVol * Math.sqrt(t);
        const discountFactor = Math.exp(-rDec * t);
        
        const terminalPrices = new Float64Array(nPaths);
        
        for (let p = 0; p < nPaths; p++) {
          const z = gaussianRandom();
          terminalPrices[p] = currentS0 * Math.exp(drift + diffusion * z);
        }

        // Store distribution if this is the central scenario for the Chart
        if (i === centralS0Index && j === centralVolIndex && t === targetDistT) {
            centralDistribution = Array.from(terminalPrices);
        }

        // Check if this scenario needs to be stored for "Detailed Scenarios" export
        // Note: We create a copy because Float64Array is reused/garbage collected, and we need persistent data
        const detailedIdx = getDetailedColumnIndex(i, j, tIdx);
        if (detailedIdx !== -1) {
            // Store as regular array for easier handling later (although Float64Array is more memory efficient)
            // Using Array.from for compatibility with standard array methods in export
            detailedPaths[detailedIdx] = Array.from(terminalPrices);
        }

        // Pricing for each Strike
        for (const k of strikes) {
          let sumPayoff = 0;
          // Loop through terminal prices
          for (let p = 0; p < nPaths; p++) {
            const st = terminalPrices[p];
            const payoff = Math.max(st - k, 0);
            sumPayoff += payoff;
          }

          const avgPayoff = sumPayoff / nPaths;
          const price = discountFactor * avgPayoff;

          results.push({
            s0: currentS0,
            vol: currentVol,
            t: t,
            k: k,
            price: price,
            stdErr: 0 // Placeholder
          });
        }
      }
    }
  }

  return {
    results,
    centralDistribution,
    detailedPaths
  };
};