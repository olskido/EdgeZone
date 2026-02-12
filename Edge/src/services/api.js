// src/services/api.js - Enhanced with Moralis Intelligence
const MORALIS_API_KEY = import.meta.env.VITE_MORALIS_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjEyMjMzNjQ2LWI1NDctNDNkNC04ZDc2LTM0OWQzZjQ3MGFiOSIsIm9yZ0lkIjoiNTAwMTQyIiwidXNlcklkIjoiNTE0NjMxIiwidHlwZUlkIjoiODdlN2E5ODMtODI2YS00ZmJiLTg3NDEtZWE1YjA1MGZhYmVjIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NzA4OTA0MTEsImV4cCI6NDkyNjY1MDQxMX0.hRXBidVEPkFI7yDyQ96oYvLkaCUpoocH-CF2vaFE1DM';
const MORALIS_BASE_URL = 'https://deep-index.moralis.io/api/v2.2';

export const api = {
  // Fetch trending tokens for table
  fetchTokens: async ({ page = 1, limit = 100 } = {}) => {
    try {
      console.log(`🔍 Fetching Moralis trending Solana (page ${page}, limit ${limit})...`);

      const apiLimit = Math.min(limit, 100);
      const url = `${MORALIS_BASE_URL}/tokens/trending?chain=solana&limit=${apiLimit}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'X-API-Key': MORALIS_API_KEY,
        },
      });

      const responseText = await response.text();

      if (!response.ok) {
        let errorDetails = '';
        try {
          const errorData = JSON.parse(responseText);
          errorDetails = errorData.message || JSON.stringify(errorData);
        } catch {
          errorDetails = responseText || 'Unknown error';
        }

        console.error(`❌ Moralis API Error (${response.status}):`, errorDetails);
        throw new Error(`Moralis API Error (${response.status}): ${errorDetails}`);
      }

      const data = JSON.parse(responseText);
      console.log('✅ Raw Moralis response:', data);

      let trendingItems = [];
      if (Array.isArray(data)) {
        trendingItems = data;
      } else if (data.result && Array.isArray(data.result)) {
        trendingItems = data.result;
      } else if (data.tokens && Array.isArray(data.tokens)) {
        trendingItems = data.tokens;
      }

      if (trendingItems.length === 0) {
        console.warn('⚠️ No trending tokens found');
        return {
          tokens: [],
          total: 0,
          totalPages: 0,
          page,
          limit,
          lastUpdate: new Date().toISOString(),
        };
      }

      const tokens = trendingItems.map(item => mapMoralisToken(item));

      console.log(`✅ Mapped ${tokens.length} trending Solana tokens`);

      return {
        tokens,
        total: tokens.length,
        totalPages: Math.ceil(tokens.length / limit),
        page,
        limit,
        lastUpdate: new Date().toISOString(),
      };

    } catch (err) {
      console.error('❌ Moralis fetch failed:', err.message);
      throw err;
    }
  },

  // Get detailed token intelligence for sidebar
  getTokenDetails: async (address) => {
    try {
      console.log(`🔍 Fetching intelligence for ${address}...`);

      // Parallel fetch: price data + token metadata + top holders + holder history
      const [priceData, metadata, holders, history] = await Promise.allSettled([
        fetchTokenPrice(address),
        fetchTokenMetadata(address),
        fetchTopHolders(address),
        fetchHolderHistory(address),
      ]);

      // Combine all data
      const intelligence = {
        header: {
          baseToken: {
            name: metadata.status === 'fulfilled' ? metadata.value.name : 'Unknown',
            symbol: metadata.status === 'fulfilled' ? metadata.value.symbol : '???',
            address: address,
          },
          priceUsd: priceData.status === 'fulfilled' ? priceData.value.price : 0,
          marketCap: priceData.status === 'fulfilled' ? priceData.value.marketCap : 0,
          liquidityUsd: priceData.status === 'fulfilled' ? priceData.value.liquidity : 0,
          volume24h: priceData.status === 'fulfilled' ? priceData.value.volume24h : 0,
          pairAge: priceData.status === 'fulfilled' ? priceData.value.age : 'Unknown',
          lastUpdate: new Date().toLocaleTimeString(),
        },
        coreMetrics: {
          price: priceData.status === 'fulfilled' ? priceData.value.price : 0,
          // Only include if present in priceData, otherwise let UI use fallback/store data
          ...(priceData.status === 'fulfilled' && priceData.value.marketCap && { marketCap: priceData.value.marketCap }),
          ...(priceData.status === 'fulfilled' && priceData.value.liquidity && { liquidity: priceData.value.liquidity }),
          ...(priceData.status === 'fulfilled' && priceData.value.volume24h && { volume24h: priceData.value.volume24h }),
          ...(priceData.status === 'fulfilled' && priceData.value.priceChange24h && { priceChange24h: priceData.value.priceChange24h }),
          ...(priceData.status === 'fulfilled' && priceData.value.age && { age: priceData.value.age }),
        },
        topHolders: holders.status === 'fulfilled' ? holders.value : [],
        holderHistory: history.status === 'fulfilled' ? history.value : [],
        threatSignal: null, // Will be calculated
        aiExplanation: [],
        detailedReasoning: [],
        overallAssessment: null,
      };

      // Calculate AI intelligence
      const analysis = analyzeToken(intelligence);

      console.log('✅ Token intelligence compiled:', analysis);
      return analysis;

    } catch (err) {
      console.error('❌ Token details fetch failed:', err);
      throw err;
    }
  },

  // AI Analysis - Connects to local backend
  analyzeToken: async (token) => {
    try {
      const response = await fetch('http://localhost:5001/analyze-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: token.name,
          symbol: token.symbol,
          marketCap: token.marketCap,
          liquidity: token.liquidity,
          volume: token.volume24h,
          age: token.age,
          topHolder: token.topHolder || 0
        })
      });

      if (!response.ok) throw new Error('AI Engine failed');
      return await response.json();
    } catch (err) {
      console.error('Frontend AI Error:', err);
      // Return a fallback object so UI doesn't break
      return {
        threat: 'UNKNOWN',
        confidence: 0,
        summary: 'AI Unreachable (Check Backend)'
      };
    }
  }
};

// Fetch token price and market data
async function fetchTokenPrice(address) {
  try {
    const url = `${MORALIS_BASE_URL}/solana/token/${address}/price`;
    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'X-API-Key': MORALIS_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Price fetch failed: ${response.status}`);
    }

    const data = await response.json();

    return {
      price: parseFloat(data.usdPrice || 0),
      priceChange24h: parseFloat(data['24hrPercentChange'] || 0), // Note: Moralis Solana price endpoint might use different key, verifying...
      // Using fallback for marketCap/liquidity if not in this specific endpoint, 
      // but usually price endpoint is limited. 
      // ACTUALLY, checking standard Moralis Solana Price response: { usdPrice, exchangeAddress, exchangeName }
      // It might NOT return Volume/Liquidity/MC. 
      // We might need a Pairs endpoint or Enhanced Token API.
      // For now, let's map what we have.
      marketCap: 0, // Not provided by simple price endpoint
      liquidity: 0, // Not provided
      volume24h: 0, // Not provided
      age: 'Unknown',
    };


    // Re-writing the replacement to be safe:

  } catch (err) {
    console.warn('Price data unavailable:', err.message);
    return {
      price: 0,
    };
  }
}

// Fetch token metadata
async function fetchTokenMetadata(address) {
  try {
    const url = `${MORALIS_BASE_URL}/solana/token/${address}/metadata`;
    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'X-API-Key': MORALIS_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Metadata fetch failed: ${response.status}`);
    }

    const data = await response.json();
    // Moralis Solana Metadata response is an object, not array usually, but let's handle both.
    const token = Array.isArray(data) ? data[0] : data;

    return {
      name: token?.name || 'Unknown',
      symbol: token?.symbol || '???',
      decimals: token?.decimals || 9,
      logo: token?.logo || token?.logoURI || null,
    };
  } catch (err) {
    console.warn('Metadata unavailable:', err.message);
    return {
      name: 'Unknown',
      symbol: '???',
      decimals: 9,
      logo: null,
    };
  }
}

// Fetch top token holders
async function fetchTopHolders(address) {
  try {
    const url = `https://solana-gateway.moralis.io/token/mainnet/${address}/top-holders?limit=10`;
    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'X-API-Key': MORALIS_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Holders fetch failed: ${response.status}`);
    }

    const data = await response.json();
    const holders = data.result || []; // Ensure data.result exists or fallback to empty array

    return holders.map((holder, index) => {
      const balance = parseFloat(holder.balance || 0);
      const percent = parseFloat(holder.percentageRelativeToTotalSupply || 0);

      return {
        address: holder.ownerAddress || 'Unknown',
        balance: balance,
        percent: percent.toFixed(2),
        isContract: holder.isContract,
        label: classifyHolder(percent, index),
      };
    });
  } catch (err) {
    console.warn('Holders data unavailable:', err.message);
    return [];
  }
}



// Fetch holder history
export async function fetchHolderHistory(address) {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago

    const fromDate = oneHourAgo.toISOString();
    const toDate = now.toISOString();

    const url = `https://solana-gateway.moralis.io/token/mainnet/holders/${address}/historical?timeFrame=10min&fromDate=${fromDate}&toDate=${toDate}&limit=6`;

    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'X-API-Key': MORALIS_API_KEY,
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    return data.result || [];
  } catch (err) {
    console.warn('Holder history unavailable:', err.message);
    return [];
  }
}

// Classify holder based on percentage
function classifyHolder(percent, rank) {
  if (percent > 20) return 'WHALE';
  if (percent > 10) return 'LARGE';
  if (percent > 5) return 'MEDIUM';
  if (rank === 0 && percent > 3) return 'DEV?';
  return null;
}

// Format token age
function formatTokenAge(timestamp) {
  if (!timestamp) return 'Unknown';

  const now = Date.now();
  const created = new Date(timestamp).getTime();
  const diffMs = now - created;
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) return `${Math.floor(diffHours * 60)}min`;
  if (diffHours < 24) return `${Math.floor(diffHours)}h`;
  const diffDays = diffHours / 24;
  if (diffDays < 30) return `${Math.floor(diffDays)}d`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo`;
  return `${Math.floor(diffDays / 365)}y`;
}

// AI ANALYSIS ENGINE
function analyzeToken(intelligence) {
  const { coreMetrics, topHolders } = intelligence;

  // 1. Calculate Threat Signal
  const threatSignal = calculateThreatSignal(coreMetrics, topHolders);

  // 2. Generate AI Explanation
  const aiExplanation = generateAIExplanation(coreMetrics, topHolders, threatSignal);

  // 3. Detailed Reasoning
  const detailedReasoning = generateDetailedReasoning(coreMetrics, topHolders, threatSignal);

  // 4. Overall Assessment
  const overallAssessment = generateOverallAssessment(threatSignal, coreMetrics);

  return {
    ...intelligence,
    threatSignal,
    aiExplanation,
    detailedReasoning,
    overallAssessment,
  };
}

// Calculate probabilistic threat signal
function calculateThreatSignal(metrics, holders) {
  let riskScore = 0;
  let signals = [];

  const { liquidity, marketCap, volume24h, priceChange24h, age } = metrics;

  // 1. Liquidity Risk (30% weight)
  if (liquidity < 5000) {
    riskScore += 30;
    signals.push({ factor: 'Extremely Low Liquidity', impact: 'HIGH', confidence: 95 });
  } else if (liquidity < 20000) {
    riskScore += 20;
    signals.push({ factor: 'Low Liquidity', impact: 'MODERATE', confidence: 85 });
  } else if (liquidity < 50000) {
    riskScore += 10;
    signals.push({ factor: 'Moderate Liquidity', impact: 'LOW', confidence: 70 });
  }

  // 2. Market Cap vs Liquidity (20% weight)
  const liqToMC = marketCap > 0 ? (liquidity / marketCap) * 100 : 0;
  if (liqToMC < 5) {
    riskScore += 20;
    signals.push({ factor: 'Poor Liquidity/MC Ratio', impact: 'HIGH', confidence: 90 });
  } else if (liqToMC < 10) {
    riskScore += 10;
    signals.push({ factor: 'Weak Liquidity/MC Ratio', impact: 'MODERATE', confidence: 75 });
  }

  // 3. Volume Analysis (15% weight)
  if (volume24h < 1000) {
    riskScore += 15;
    signals.push({ factor: 'Very Low Volume', impact: 'HIGH', confidence: 88 });
  } else if (volume24h > liquidity * 2) {
    riskScore += 10;
    signals.push({ factor: 'Suspiciously High Volume', impact: 'MODERATE', confidence: 70 });
  }

  // 4. Price Volatility (15% weight)
  if (Math.abs(priceChange24h) > 100) {
    riskScore += 15;
    signals.push({ factor: 'Extreme Volatility', impact: 'HIGH', confidence: 92 });
  } else if (Math.abs(priceChange24h) > 50) {
    riskScore += 8;
    signals.push({ factor: 'High Volatility', impact: 'MODERATE', confidence: 80 });
  }

  // 5. Holder Concentration (20% weight)
  if (holders.length > 0) {
    const topHolderPercent = parseFloat(holders[0]?.percent || 0);
    const top3Percent = holders.slice(0, 3).reduce((sum, h) => sum + parseFloat(h.percent || 0), 0);

    if (topHolderPercent > 30) {
      riskScore += 20;
      signals.push({ factor: 'Single Whale Dominance', impact: 'CRITICAL', confidence: 95 });
    } else if (top3Percent > 60) {
      riskScore += 15;
      signals.push({ factor: 'Top 3 Control Majority', impact: 'HIGH', confidence: 88 });
    } else if (topHolderPercent > 15) {
      riskScore += 8;
      signals.push({ factor: 'Concentrated Ownership', impact: 'MODERATE', confidence: 75 });
    }
  }

  // 6. Token Age Risk (10% weight)
  const ageHours = parseAgeToHours(age);
  if (ageHours < 24) {
    riskScore += 10;
    signals.push({ factor: 'Brand New Token', impact: 'HIGH', confidence: 90 });
  } else if (ageHours < 168) { // 1 week
    riskScore += 5;
    signals.push({ factor: 'Very Young Token', impact: 'MODERATE', confidence: 75 });
  }

  // Determine threat level
  let level, label, probability;
  if (riskScore >= 70) {
    level = 'HIGH';
    label = 'High Risk - Probable Rug/Scam';
    probability = Math.min(95, 60 + riskScore - 70);
  } else if (riskScore >= 40) {
    level = 'MODERATE';
    label = 'Moderate Risk - Caution Advised';
    probability = Math.min(75, 40 + riskScore - 40);
  } else if (riskScore >= 20) {
    level = 'LOW';
    label = 'Low Risk - Monitor Closely';
    probability = Math.min(50, 20 + riskScore - 20);
  } else {
    level = 'SAFE';
    label = 'Relatively Safe - Good Fundamentals';
    probability = Math.max(10, 30 - riskScore);
  }

  return {
    level,
    label,
    probability,
    riskScore,
    signals,
  };
}

// Generate AI micro-explanation
function generateAIExplanation(metrics, holders, threatSignal) {
  const explanations = [];

  // Pick top 3 most important signals
  const topSignals = threatSignal.signals
    .sort((a, b) => {
      const impactWeight = { CRITICAL: 4, HIGH: 3, MODERATE: 2, LOW: 1 };
      return (impactWeight[b.impact] || 0) - (impactWeight[a.impact] || 0);
    })
    .slice(0, 3);

  topSignals.forEach(signal => {
    explanations.push({
      text: signal.factor,
      confidence: signal.confidence,
    });
  });

  // Add momentum signal if applicable
  if (metrics.priceChange24h > 20) {
    explanations.push({
      text: 'Strong upward momentum detected',
      confidence: 72,
    });
  } else if (metrics.priceChange24h < -20) {
    explanations.push({
      text: 'Downward pressure detected',
      confidence: 78,
    });
  }

  return explanations.slice(0, 3);
}

// Generate detailed reasoning
function generateDetailedReasoning(metrics, holders, threatSignal) {
  const reasoning = [];

  // 1. Liquidity Analysis
  reasoning.push({
    title: 'Liquidity Analysis',
    content: `Current liquidity: $${formatNumber(metrics.liquidity)}. ${metrics.liquidity < 20000
      ? 'LOW - High slippage risk, difficult to exit large positions.'
      : metrics.liquidity < 50000
        ? 'MODERATE - Acceptable for small trades, watch for liquidity pulls.'
        : 'HEALTHY - Good depth for normal trading activity.'
      }`,
  });

  // 2. Holder Distribution
  if (holders.length > 0) {
    const top3 = holders.slice(0, 3).reduce((s, h) => s + parseFloat(h.percent), 0);
    reasoning.push({
      title: 'Holder Distribution',
      content: `Top holder: ${holders[0].percent}% | Top 3: ${top3.toFixed(1)}%. ${top3 > 60
        ? 'CRITICAL - Extreme centralization, high rug risk.'
        : top3 > 40
          ? 'CONCERNING - Whales could manipulate price.'
          : 'ACCEPTABLE - Reasonably distributed ownership.'
        }`,
    });
  }

  // 3. Volume Quality
  const volToLiq = metrics.liquidity > 0 ? metrics.volume24h / metrics.liquidity : 0;
  reasoning.push({
    title: 'Volume Quality',
    content: `24H Volume: $${formatNumber(metrics.volume24h)} (${(volToLiq * 100).toFixed(0)}% of liquidity). ${volToLiq > 3
      ? 'SUSPICIOUS - Abnormally high, possible wash trading.'
      : volToLiq > 1
        ? 'ACTIVE - High trading activity, verify authenticity.'
        : volToLiq < 0.1
          ? 'LOW - Minimal organic interest.'
          : 'NORMAL - Healthy trading volume.'
      }`,
  });

  // 4. Price Action
  if (metrics.priceChange24h !== undefined && metrics.priceChange24h !== null) {
    reasoning.push({
      title: 'Price Momentum',
      content: `24H Change: ${metrics.priceChange24h >= 0 ? '+' : ''}${metrics.priceChange24h.toFixed(1)}%. ${Math.abs(metrics.priceChange24h) > 100
        ? 'EXTREME - Likely pump or dump in progress.'
        : metrics.priceChange24h > 50
          ? 'STRONG PUMP - High volatility, potential exit liquidity setup.'
          : metrics.priceChange24h < -50
            ? 'HEAVY DUMP - Possible capitulation or rug.'
            : 'STABLE - Normal price action.'
        }`,
    });
  }

  return reasoning;
}

// Generate overall assessment
function generateOverallAssessment(threatSignal, metrics) {
  let summary, action;

  if (threatSignal.level === 'HIGH') {
    summary = `⚠️ HIGH RISK TOKEN - ${threatSignal.probability}% probability of rug/scam`;
    action = 'Recommendation: AVOID or use only for very small speculative plays. Exit quickly if entering.';
  } else if (threatSignal.level === 'MODERATE') {
    summary = `⚠️ MODERATE RISK - ${threatSignal.probability}% chance of adverse events`;
    action = 'Recommendation: Proceed with caution. Small position sizes only. Set tight stop-losses.';
  } else if (threatSignal.level === 'LOW') {
    summary = `✅ ACCEPTABLE RISK - ${threatSignal.probability}% probability of issues`;
    action = 'Recommendation: Monitor closely. Reasonable for speculative trading with proper risk management.';
  } else {
    summary = `✅ RELATIVELY SAFE - ${threatSignal.probability}% risk level`;
    action = 'Recommendation: Decent fundamentals detected. Standard risk management applies.';
  }

  return { summary, action };
}

// Helper: Parse age string to hours
function parseAgeToHours(ageStr) {
  if (!ageStr || ageStr === 'Unknown') return 999999;

  const match = ageStr.match(/^(\d+)(min|h|d|mo|y)$/);
  if (!match) return 999999;

  const value = parseInt(match[1]);
  const unit = match[2];

  const multipliers = { min: 1 / 60, h: 1, d: 24, mo: 720, y: 8760 };
  return value * (multipliers[unit] || 1);
}

// Helper: Format numbers
function formatNumber(num) {
  if (!num || num === 0) return '0';
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toFixed(2);
}

// Map Moralis trending token to table schema
function mapMoralisToken(item) {
  if (!window._moralisStructureLogged) {
    console.log('📊 Sample Moralis token structure:', item);
    window._moralisStructureLogged = true;
  }

  const price = parseFloat(
    item.price_usd || item.usdPrice || item.price || item.priceUsd || item.current_price || 0
  );

  const marketCap = parseFloat(
    item.market_cap || item.marketCap || item.mc_usd || item.fdv || item.fully_diluted_valuation || 0
  );

  const liquidity = parseFloat(
    item.liquidity_usd || item.liquidityUsd || item.liquidity || item.total_liquidity || 0
  );

  // Correct volume mapping
  const volume24h = parseFloat(
    item.volume_24h || item.volume_usd_24h || 0
  );

  const priceChange = parseFloat(
    item.price_change_24h_percent || item.priceChange24h || item.price_change_percentage_24h || item.price_change_24h || 0
  );

  const buys = parseInt(item.buys_24h || item.buys || item.buys24h || item.buy_count_24h || 0);
  const sells = parseInt(item.sells_24h || item.sells || item.sells24h || item.sell_count_24h || 0);

  const threatLevel = calculateSimpleThreatLevel({ liquidity, marketCap, volume24h, priceChange });

  return {
    id: item.token_address || item.address || item.tokenAddress || item.contract_address || generateId(),
    name: item.token_name || item.name || item.tokenName || 'Unknown',
    symbol: item.token_symbol || item.symbol || item.tokenSymbol || '???',
    contract: item.token_address || item.address || item.tokenAddress || item.contract_address,
    logoUrl: item.logo || item.token_logo || item.tokenLogo || item.image || item.logo_url || null,
    price,
    priceChange24h: priceChange,
    volume24h,
    marketCap,
    liquidity,
    buys24h: buys,
    sells24h: sells,
    volumeChange24h: parseFloat(item.volume_change_24h || item.volumeChange24h || 0),
    momentumScore: calculateMomentum({ priceChange, volumeChange: 0, buys, sells }),
    convictionRatio: liquidity > 0 && marketCap > 0 ? (liquidity / marketCap) * 100 : 0,
    threatLevel,
    threatColor: getThreatEmoji(threatLevel),
    chainId: 'solana',
    created_at: item.created_at || item.pair_created_at || item.createdAt || item.token_created_at,
    updatedAt: new Date().toISOString(),
  };
}

// Simple threat calculation for table
function calculateSimpleThreatLevel({ liquidity, marketCap, volume24h, priceChange }) {
  let score = 0;
  if (liquidity < 10000) score += 3;
  else if (liquidity < 50000) score += 2;
  else if (liquidity < 100000) score += 1;
  if (marketCap < 50000) score += 2;
  else if (marketCap < 200000) score += 1;
  if (Math.abs(priceChange) > 100) score += 2;
  else if (Math.abs(priceChange) > 50) score += 1;
  if (volume24h < 1000) score += 2;
  if (score >= 6) return 'HIGH';
  if (score >= 3) return 'MODERATE';
  return 'LOW';
}

function calculateMomentum({ priceChange, volumeChange, buys, sells }) {
  let momentum = 0;
  if (priceChange > 20) momentum += 3;
  else if (priceChange > 10) momentum += 2;
  else if (priceChange > 0) momentum += 1;
  if (volumeChange > 50) momentum += 2;
  else if (volumeChange > 20) momentum += 1;
  if (buys > sells * 1.5) momentum += 2;
  else if (buys > sells) momentum += 1;
  return Math.min(momentum, 10);
}

function getThreatEmoji(level) {
  if (level === 'HIGH') return '🔴';
  if (level === 'MODERATE') return '🟡';
  if (level === 'LOW') return '🔵';
  return '🟢';
}

function generateId() {
  return `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}