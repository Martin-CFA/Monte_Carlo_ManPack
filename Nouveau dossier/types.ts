
export interface SimulationParams {
    // Market
    r: number; // Interest rate (%)
    q: number; // Dividend yield (%)
    
    // Scenarios
    s0: number; // Spot pivot
    s0Step: number; // Spot step (%)
    vol: number; // Volatility pivot (%)
    volStep: number; // Volatility step (%)
    
    // Simulation
    nPaths: number;
    
    // Product
    maturities: number[];
    strikes: number[];
}

export interface ScenarioRow {
    s0: number;
    vol: number;
    t: number;
    k: number;
    price: number;
    stdErr: number;
}

export interface SimulationResult {
    results: ScenarioRow[];
    centralDistribution: number[]; // Terminal prices for the central scenario
    detailedPaths: number[][]; // Array of 27 arrays, each containing terminal prices for the specific scenarios
}

export interface DistributionBin {
    binStart: number;
    binEnd: number;
    count: number;
    frequency: number;
}
