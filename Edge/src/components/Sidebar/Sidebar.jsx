// src/components/Sidebar/Sidebar.jsx - AI-Powered Intelligence Panel
import React, { useState, useEffect, useRef } from 'react';
import useTokenStore from '../../store/useTokenStore';
import './Sidebar.css';
import { api } from '../../services/api';

// 🔥 CENTRALIZED THREAT COLORS (Single Source of Truth)
const threatColors = {
    'HIGH': '#ef4444',     // Red
    'EXTREME': '#dc2626',  // Dark Red
    'MODERATE': '#f59e0b', // Yellow/Orange
    'LOW': '#3b82f6',      // Blue (Safe)
    'SAFE': '#22c55e',     // Green
    'analyzing': '#94a3b8' // Gray
};

const Sidebar = ({ isMobile, onBack }) => {
    const { selectedToken, loadingToken } = useTokenStore();
    const [intelligence, setIntelligence] = useState(null);
    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [confidence, setConfidence] = useState(100);
    const intervalRef = useRef(null);
    const debounceRef = useRef(null);

    // Fetch intelligence when token selected
    useEffect(() => {
        if (!selectedToken) {
            setIntelligence(null);
            return;
        }

        const fetchSidebarData = async () => {
            setLoading(true);
            setError(null);
            setAiLoading(false); // Reset AI state

            try {
                // 1. Immediate: Get Real Data (Moralis) via API
                const tokenId = selectedToken.contract || selectedToken.id;
                const baseData = await api.getTokenDetails(tokenId);

                // Merge fetched data with existing store data (to preserve MC/Liq if API misses it)
                const mergedIntelligence = {
                    ...baseData,
                    header: {
                        ...baseData.header,
                        baseToken: {
                            ...baseData.header.baseToken,
                            name: baseData.header.baseToken.name !== 'Unknown' ? baseData.header.baseToken.name : selectedToken.name,
                            symbol: baseData.header.baseToken.symbol !== '???' ? baseData.header.baseToken.symbol : selectedToken.symbol,
                        }
                    },
                    coreMetrics: {
                        ...selectedToken, // Start with store data (has MC, Liq, Vol)
                        ...baseData.coreMetrics, // Overlay with whatever the API found (e.g. fresh Price)
                    }
                };

                setIntelligence(mergedIntelligence);
                setLastUpdate(Date.now());
                setConfidence(100);

                // 2. Scheduled: AI Analysis (Debounced 2s)
                if (debounceRef.current) clearTimeout(debounceRef.current);

                debounceRef.current = setTimeout(async () => {
                    setAiLoading(true);
                    try {
                        // Prepare payload using the BEST data we have
                        const aiPayload = {
                            name: mergedIntelligence.header.baseToken.name,
                            symbol: mergedIntelligence.header.baseToken.symbol,
                            marketCap: mergedIntelligence.coreMetrics.marketCap,
                            liquidity: mergedIntelligence.coreMetrics.liquidity,
                            volume: mergedIntelligence.coreMetrics.volume24h,
                            age: mergedIntelligence.coreMetrics.age,
                            topHolder: mergedIntelligence.topHolders[0]?.percent || 0
                        };

                        const aiResult = await api.analyzeToken(aiPayload);

                        setIntelligence(prev => ({
                            ...prev,
                            threatSignal: {
                                level: aiResult.threat,
                                probability: aiResult.confidence,
                                label: aiResult.summary
                            },
                            overallAssessment: {
                                summary: aiResult.summary,
                                action: getActionFromThreat(aiResult.threat)
                            },
                            aiExplanation: aiResult.aiExplanation || [], // Use backend provided explanations if any
                            detailedReasoning: aiResult.detailedReasoning || []
                        }));
                        setConfidence(aiResult.confidence);
                    } catch (aiErr) {
                        console.warn("AI Analysis skipped:", aiErr);
                    } finally {
                        setAiLoading(false);
                    }
                }, 2000); // 2 Second Debounce

            } catch (err) {
                console.error('Sidebar Data Failed:', err);
                setError("Failed to load token data");
            } finally {
                setLoading(false);
            }
        };

        fetchSidebarData();

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [selectedToken]);

    // Confidence decay over time (decreases 1% every 3 seconds)
    useEffect(() => {
        if (!lastUpdate) return;

        intervalRef.current = setInterval(() => {
            setConfidence((prev) => {
                const timeSince = (Date.now() - lastUpdate) / 1000;
                const decay = Math.floor(timeSince / 3);
                return Math.max(0, 100 - decay);
            });
        }, 1000);

        return () => clearInterval(intervalRef.current);
    }, [lastUpdate]);

    if (!selectedToken) {
        return (
            <div className="sidebar">
                <div className="sidebar-empty">
                    <div className="empty-icon">🎯</div>
                    <div>Select a token to view<br />AI Intelligence Analysis</div>
                </div>
            </div>
        );
    }

    if (loading || loadingToken) {
        return (
            <div className="sidebar">
                <div className="sidebar-header compact">
                    <div className="skeleton skeleton-title"></div>
                </div>
                <div className="sidebar-loading">
                    <div className="loading-spinner">🔄</div>
                    <div>Fetching on-chain data...</div>
                </div>
            </div>
        );
    }

    if (error || !intelligence) {
        return (
            <div className="sidebar">
                <div className="sidebar-empty error">
                    <div className="error-icon">⚠️</div>
                    <div>Failed to load intelligence<br />{error || 'Unknown error'}</div>
                </div>
            </div>
        );
    }

    const formatNumber = (num, digits = 2) => {
        if (!num && num !== 0) return '$0';
        if (num >= 1e9) return `$${(num / 1e9).toFixed(digits)}B`;
        if (num >= 1e6) return `$${(num / 1e6).toFixed(digits)}M`;
        if (num >= 1e3) return `$${(num / 1e3).toFixed(digits)}K`;
        return `$${num.toFixed?.(digits) || '0'}`;
    };

    const formatPercent = (val) => {
        const n = parseFloat(val || 0);
        return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
    };

    const d = intelligence;
    // Default signal if AI is still loading
    const defaultSignal = { level: 'Analyzing...', probability: 50, label: 'AI Processing...' };
    const signal = d.threatSignal || defaultSignal;
    const threatColor = d.threatSignal ? getThreatColor(signal.level) : '#94a3b8'; // Grey if analyzing
    const confidenceColor = getConfidenceColor(confidence);

    const handleRefresh = async () => {
        if (!selectedToken) return;
        const tokenId = selectedToken.contract || selectedToken.id;

        // Don't set loading(true) here to preserve UI state
        // just let aiLoading indicate progress
        try {
            // Fetch fresh data
            const baseData = await api.getTokenDetails(tokenId);

            // MERGE Logic (Critical to prevent zeroing out)
            setIntelligence(prev => {
                const prevMetrics = prev?.coreMetrics || selectedToken;
                return {
                    ...prev,
                    ...baseData,
                    header: {
                        ...baseData.header,
                        baseToken: {
                            ...baseData.header.baseToken,
                            name: baseData.header.baseToken.name !== 'Unknown' ? baseData.header.baseToken.name : (prev?.header?.baseToken?.name || selectedToken.name),
                            symbol: baseData.header.baseToken.symbol !== '???' ? baseData.header.baseToken.symbol : (prev?.header?.baseToken?.symbol || selectedToken.symbol),
                        }
                    },
                    coreMetrics: {
                        ...prevMetrics, // Keep existing rich data
                        ...baseData.coreMetrics, // Update with fresh API data
                        // Ensure we don't overwrite valid data with 0/undefined if API fails
                        marketCap: baseData.coreMetrics.marketCap || prevMetrics.marketCap,
                        liquidity: baseData.coreMetrics.liquidity || prevMetrics.liquidity,
                        volume24h: baseData.coreMetrics.volume24h || prevMetrics.volume24h,
                    },
                    // 🔥 PRESERVE AI DATA (Don't overwrite with empty arrays from API)
                    aiExplanation: (baseData.aiExplanation?.length > 0 ? baseData.aiExplanation : prev.aiExplanation) || [],
                    detailedReasoning: (baseData.detailedReasoning?.length > 0 ? baseData.detailedReasoning : prev.detailedReasoning) || [],
                    threatSignal: (baseData.threatSignal ? baseData.threatSignal : prev.threatSignal)
                };
            });

            setLastUpdate(Date.now());
            setConfidence(100);

            // Trigger AI Manually
            setAiLoading(true);
            // Re-construct payload from the MERGED state we just calculated? 
            // Better to use a timeout or just wait for the effect?
            // Actually, let's just trigger it directly here to be instant.

            const mergedMetrics = {
                ...selectedToken,
                ...baseData.coreMetrics
            };

            const aiPayload = {
                name: baseData.header.baseToken.name !== 'Unknown' ? baseData.header.baseToken.name : selectedToken.name,
                symbol: baseData.header.baseToken.symbol,
                marketCap: mergedMetrics.marketCap,
                liquidity: mergedMetrics.liquidity,
                volume: mergedMetrics.volume24h,
                age: mergedMetrics.age,
                topHolder: baseData.topHolders?.[0]?.percent || 0
            };

            api.analyzeToken(aiPayload).then(aiResult => {
                setIntelligence(prev => ({
                    ...prev,
                    threatSignal: {
                        level: aiResult.threat,
                        probability: aiResult.confidence,
                        label: aiResult.summary
                    },
                    overallAssessment: {
                        summary: aiResult.summary,
                        action: getActionFromThreat(aiResult.threat)
                    },
                    aiExplanation: aiResult.aiExplanation || [],
                    detailedReasoning: aiResult.detailedReasoning || []
                }));
                setConfidence(aiResult.confidence);
            }).finally(() => setAiLoading(false));

        } catch (err) {
            setError(err.message);
            setLoading(false);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        // Visual feedback
        const btn = document.getElementById('copy-btn-sidebar');
        if (btn) {
            const original = btn.innerHTML;
            btn.innerHTML = '✅';
            setTimeout(() => btn.innerHTML = original, 1000);
        }
    };

    return (
        <div className="sidebar single-page">
            {/* Header: Token Identity */}
            <div className="sidebar-header compact">
                <div className="token-identity-row">
                    {/* Mobile Back Button */}
                    {isMobile && onBack && (
                        <button
                            onClick={onBack}
                            className="mobile-back-btn"
                            style={{
                                background: 'rgba(255,255,255,0.1)',
                                border: '1px solid var(--border-color)',
                                color: '#e4e4e7',
                                fontSize: '0.9rem',
                                marginRight: '12px',
                                cursor: 'pointer',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <span>←</span> Back
                        </button>
                    )}
                    <div className="token-name-large">
                        {d.header?.baseToken?.name} <span className="ticker">({d.header?.baseToken?.symbol})</span>
                    </div>
                </div>

                {/* Confidence Indicator */}
                <div className="confidence-badge" style={{ color: confidenceColor }}>
                    Data Confidence: {confidence}%
                    {confidence < 80 && <span className="decay-warning"> ⚠️ Decaying</span>}
                </div>
            </div>

            {/* Manual Intelligence Trigger REMOVED (Consolidated to footer) */}


            {/* 1. THREAT SIGNAL - Most Important */}
            <div
                className="terminal-card threat-card"
                style={{
                    borderColor: threatColor,
                    borderLeft: `6px solid ${threatColor}`,
                    background: `${threatColor}08`
                }}
            >
                <div className="section-title">🚨 THREAT SIGNAL</div>
                <div className="threat-status" style={{ color: threatColor }}>
                    <span className="threat-emoji">{getThreatEmoji(signal.level)}</span>
                    <span className="threat-level">{signal.level} RISK</span>
                </div>
                <div className="threat-label">{signal.label}</div>
                <div className="threat-prob">
                    Risk Probability: <strong>{signal.probability}%</strong>
                </div>

                {/* Visual Risk Bar */}
                <div className="risk-bar-container">
                    <div
                        className="risk-bar-fill"
                        style={{
                            width: `${signal.probability}%`,
                            background: threatColor
                        }}
                    ></div>
                </div>
            </div>

            {/* 2. CORE METRICS (Real-Time) */}
            <div className="terminal-card">
                <div className="section-title">stats CORE METRICS (REAL-TIME)</div>
                <div className="metrics-list">
                    <div className="metric-row">
                        <span className="m-label">Price:</span>
                        <span className="m-value prop-font">${d.coreMetrics?.price?.toFixed(8) || '0.00'}</span>
                    </div>
                    {/* Replaced 24h Change/Vol with Contract Address */}
                    <div className="metric-row">
                        <span className="m-label">Contract:</span>
                        <span className="m-value mono" style={{ fontSize: '0.8rem' }}>
                            {d.header?.baseToken?.address?.slice(0, 4)}...{d.header?.baseToken?.address?.slice(-4)}
                            <button
                                id="copy-btn-sidebar"
                                className="copy-btn"
                                onClick={() => copyToClipboard(d.header?.baseToken?.address)}
                                title="Copy Address"
                            >
                                📋
                            </button>
                        </span>
                    </div>
                    <div className="metric-row">
                        <span className="m-label">Market Cap:</span>
                        <span className="m-value prop-font">{formatNumber(d.coreMetrics?.marketCap)}</span>
                    </div>
                    <div className="metric-row">
                        <span className="m-label">Liquidity:</span>
                        <span className="m-value prop-font">{formatNumber(d.coreMetrics?.liquidity)}</span>
                    </div>

                    <div className="metric-row">
                        <span className="m-label">Liq/MC Ratio:</span>
                        <span className="m-value">
                            {d.coreMetrics?.marketCap > 0
                                ? ((d.coreMetrics.liquidity / d.coreMetrics.marketCap) * 100).toFixed(2)
                                : '0'
                            }%
                        </span>
                    </div>
                </div>
                <div className="last-update">
                    Last Update: {d.header?.lastUpdate || 'Just now'}
                    {confidence < 90 && <span> • Confidence decaying...</span>}
                </div>
            </div>

            {/* 3. AI MICRO-EXPLANATION */}
            <div className="terminal-card">
                <div className="section-title">
                    🤖 AI ANALYSIS
                    {aiLoading && <span className="spinner-small" style={{ marginLeft: 'auto' }}>🔄</span>}
                </div>
                {d.aiExplanation && d.aiExplanation.length > 0 ? (
                    <ul className="ai-bullets">
                        {d.aiExplanation.map((item, i) => (
                            <li key={i}>
                                <strong>{item.text}</strong>
                                <span className="confidence"> ({item.confidence}% confidence)</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="placeholder-text">Waiting for analysis...</div>
                )}
            </div>

            {/* 4. TOP HOLDERS (WHALE TRACKER) */}
            <div className="terminal-card">
                <div className="section-title">🐋 TOP HOLDERS (WHALE TRACKER)</div>
                <div className="holder-list">
                    {d.topHolders && d.topHolders.length > 0 ? (
                        d.topHolders.map((h, i) => (
                            <div key={i} className="holder-item">
                                <span className="h-rank">{i + 1}.</span>
                                <span className="h-addr">
                                    {h.address.slice(0, 6)}...{h.address.slice(-4)}
                                </span>
                                <span className="h-percent">{h.percent}%</span>
                                {h.trend === 'down' && <span className="h-trend down">↓</span>}
                                {h.trend === 'up' && <span className="h-trend up">↑</span>}
                                {h.label && (
                                    <span
                                        className="h-label"
                                        style={{
                                            color: h.label === 'WHALE' ? '#ef4444' :
                                                h.label === 'LARGE' ? '#f97316' :
                                                    h.label === 'DEV?' ? '#dc2626' : '#71717a'
                                        }}
                                    >
                                        {h.label}
                                    </span>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="placeholder-text">Holders data loading...</div>
                    )}
                </div>

                {/* Holder Concentration Warning */}
                {d.topHolders && d.topHolders.length >= 3 && (
                    <div className="holder-warning">
                        {(() => {
                            const top3 = d.topHolders.slice(0, 3).reduce((s, h) => s + parseFloat(h.percent), 0);
                            if (top3 > 60) {
                                return (
                                    <div className="warning-high">
                                        ⚠️ CRITICAL: Top 3 hold {top3.toFixed(1)}% - Extreme rug risk
                                    </div>
                                );
                            } else if (top3 > 40) {
                                return (
                                    <div className="warning-medium">
                                        ⚠️ WARNING: Top 3 hold {top3.toFixed(1)}% - High manipulation risk
                                    </div>
                                );
                            }
                            return null;
                        })()}
                    </div>
                )}
            </div>

            {/* 5. DETAILED REASONING */}
            <div className="terminal-card">
                <div className="section-title">🔍 DETAILED REASONING</div>
                <div className="reasoning-list">
                    {d.detailedReasoning && d.detailedReasoning.length > 0 ? (
                        d.detailedReasoning.map((r, i) => (
                            <div key={i} className="reasoning-item">
                                <div className="r-title">{i + 1}. {r.title}</div>
                                <div className="r-content">{r.content}</div>
                            </div>
                        ))
                    ) : (
                        <div className="placeholder-text">Generating detailed report...</div>
                    )}
                </div>
            </div>

            {/* 6. THREAT SIGNALS BREAKDOWN */}
            {signal.signals && signal.signals.length > 0 && (
                <div className="terminal-card">
                    <div className="section-title">⚡ ACTIVE THREAT SIGNALS</div>
                    <div className="signals-list">
                        {signal.signals.map((sig, i) => (
                            <div key={i} className="signal-item">
                                <div className="sig-header">
                                    <span className="sig-factor">{sig.factor}</span>
                                    <span
                                        className="sig-impact"
                                        style={{
                                            color: sig.impact === 'CRITICAL' ? '#dc2626' :
                                                sig.impact === 'HIGH' ? '#ef4444' :
                                                    sig.impact === 'MODERATE' ? '#f59e0b' : '#3b82f6'
                                        }}
                                    >
                                        {sig.impact}
                                    </span>
                                </div>
                                <div className="sig-confidence">
                                    Confidence: {sig.confidence}%
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 7. OVERALL ASSESSMENT */}
            {d.overallAssessment && (
                <div
                    className="terminal-card assessment-card"
                    style={{
                        borderColor: threatColor,
                        borderLeft: `4px solid ${threatColor}`
                    }}
                >
                    <div className="section-title" style={{ color: threatColor }}>📋 OVERALL ASSESSMENT</div>
                    <div className="assess-summary">{d.overallAssessment.summary}</div>
                    <div className="assess-action" style={{ color: threatColor }}>{d.overallAssessment.action}</div>
                </div>
            )}

            {/* Refresh Button */}
            <div className="sidebar-footer">
                <button
                    className="refresh-btn"
                    onClick={handleRefresh}
                    disabled={loading || aiLoading}
                >
                    {aiLoading ? '🔄 Analyzing...' : '✨ Run Risk Analysis'}
                </button>
            </div>
        </div>
    );
};

// Helper functions
function getThreatColor(level) {
    return threatColors[level] || threatColors.analyzing;
}

function getThreatEmoji(level) {
    if (level === 'HIGH') return '🔴';
    if (level === 'MODERATE') return '🟡';
    if (level === 'LOW') return '🔵';
    return '🟢';
}

function getConfidenceColor(confidence) {
    if (confidence >= 90) return '#22c55e';
    if (confidence >= 70) return '#3b82f6';
    if (confidence >= 50) return '#f59e0b';
    return '#ef4444';
}

function getActionFromThreat(threat) {
    if (threat === 'EXTREME' || threat === 'HIGH') return '⛔ RECOMMENDATION: AVOID / EXIT IMMEDIATELY';
    if (threat === 'MODERATE') return '⚠️ RECOMMENDATION: Exercise Caution (Small Size)';
    return '✅ RECOMMENDATION: Looks tradable (DYOR)';
}

// Helper to format age
function formatAge(timestamp) {
    if (!timestamp) return 'Unknown';
    const diff = Date.now() - new Date(timestamp).getTime();
    const hours = diff / (1000 * 60 * 60);
    if (hours < 1) return '< 1h';
    if (hours < 24) return `${Math.floor(hours)}h`;
    return `${Math.floor(hours / 24)}d`;
}

export default Sidebar;