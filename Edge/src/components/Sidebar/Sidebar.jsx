import React, { useState, useEffect } from 'react';
import useTokenStore from '../../store/useTokenStore';
import './Sidebar.css';
import './trends.css';

// Color mapping for tiers
const getScoreColor = (score) => {
    if (score >= 76) return '#22c55e'; // GREEN
    if (score >= 56) return '#3b82f6'; // BLUE
    if (score >= 31) return '#f59e0b'; // YELLOW
    return '#ef4444'; // RED
};

const getEdgeLevelColor = (level) => {
    const colors = {
        'ALPHA': '#22c55e', // Green
        'EDGE': '#3b82f6',  // Blue
        'NEUTRAL': '#f59e0b', // Yellow
        'RISKY': '#ef4444',   // Red (Avoid/Danger)
        'AVOID': '#ef4444'    // Red
    };
    return colors[level] || '#71717a';
};

const getPatternIcon = (pattern) => {
    const icons = {
        'ACCUMULATOR': '📈', 'DIAMOND_HANDS': '💎', 'PAPER_HANDS': '🧻',
        'SELLS_AFTER_2X': '💰', 'WHALE': '🐋', 'NEUTRAL': '⚪'
    };
    return icons[pattern] || '⚪';
};

const getDevLabelColor = (label) => {
    const colors = {
        'ALPHA_DEV': '#22c55e', 'TRUSTED': '#3b82f6', 'UNKNOWN': '#71717a',
        'SUSPICIOUS': '#f97316', 'SERIAL_RUGGER': '#ef4444'
    };
    return colors[label] || '#71717a';
};

const Sidebar = () => {
    const { selectedToken, loadingToken } = useTokenStore();
    const [intelligence, setIntelligence] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        if (!selectedToken) { setIntelligence(null); return; }
        const fetchIntelligence = async () => {
            setLoading(true);
            setError(null);
            try {
                const tokenId = selectedToken.id || selectedToken.contract;
                const response = await fetch(`http://localhost:4000/token/${tokenId}/intelligence`);
                if (!response.ok) throw new Error(`API error: ${response.status}`);
                const data = await response.json();
                setIntelligence(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchIntelligence();
    }, [selectedToken]);

    if (!selectedToken) {
        return (
            <div className="sidebar">
                <div className="sidebar-empty">
                    <div>Select a token to view<br />Intelligence Analysis</div>
                </div>
            </div>
        );
    }

    if (loading || loadingToken) {
        return (
            <div className="sidebar">
                <div className="sidebar-header">
                    <div className="skeleton skeleton-title"></div>
                </div>
                <div className="skeleton skeleton-box"></div>
            </div>
        );
    }

    if (error || !intelligence) {
        return (
            <div className="sidebar">
                <div className="sidebar-empty error">
                    <div>Failed to load intelligence<br />{error}</div>
                </div>
            </div>
        );
    }

    const formatNumber = (num) => {
        if (!num && num !== 0) return '$0';
        if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
        if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
        if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
        return `$${num.toFixed?.(2) || '0'}`;
    };

    const d = intelligence;
    const edgeColor = getEdgeLevelColor(d.edgeScore?.level);

    return (
        <div className="sidebar">
            {/* Token Header */}
            <div className="sidebar-header">
                <div className="token-identity-row">
                    <div className="token-name-large">
                        {d.header?.baseToken?.name}
                        <span className="ticker">{d.header?.baseToken?.symbol}</span>
                    </div>
                    <div className="token-price-large">
                        ${d.header?.priceUsd?.toFixed?.(8) || '0'}
                    </div>
                </div>
                <div className="meta-grid">
                    <div className="meta-item">
                        <span className="meta-label">MC</span>
                        <span className="meta-value">{formatNumber(d.header?.marketCap)}</span>
                    </div>
                    <div className="meta-item">
                        <span className="meta-label">LIQ</span>
                        <span className="meta-value">{formatNumber(d.header?.liquidityUsd)}</span>
                    </div>
                    <div className="meta-item">
                        <span className="meta-label">24H VOL</span>
                        <span className="meta-value">{formatNumber(d.header?.volume24h)}</span>
                    </div>
                    <div className="meta-item">
                        <span className="meta-label">AGE</span>
                        <span className="meta-value">{d.header?.pairAge || 'N/A'}</span>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="tab-nav">
                <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
                <button className={`tab-btn ${activeTab === 'market' ? 'active' : ''}`} onClick={() => setActiveTab('market')}>Market</button>
                <button className={`tab-btn ${activeTab === 'trends' ? 'active' : ''}`} onClick={() => setActiveTab('trends')}>Trends</button>
                <button className={`tab-btn ${activeTab === 'dev' ? 'active' : ''}`} onClick={() => setActiveTab('dev')}>Dev</button>
            </div>

            {/* EDGE SCORE - Hero Card */}
            <div className="terminal-card edge-card" style={{ borderLeft: `6px solid ${edgeColor}` }}>
                <div className="section-title">
                    🎯 EDGE SCORE
                    <span className="edge-level" style={{ color: edgeColor }}>{d.edgeScore?.level}</span>
                </div>
                <div className="edge-hero" style={{ color: edgeColor }}>
                    {d.edgeScore?.score || 0}
                    <span className="edge-max">/100</span>
                </div>

                <div className="edge-breakdown">
                    <div className="edge-component">
                        <span className="comp-label">Safety</span>
                        <span className="comp-value">{d.edgeScore?.breakdown?.safety?.contribution || 0}</span>
                    </div>
                    <div className="edge-component">
                        <span className="comp-label">Narrative</span>
                        <span className="comp-value">{d.edgeScore?.breakdown?.narrative?.contribution || 0}</span>
                    </div>
                    <div className="edge-component">
                        <span className="comp-label">SmartFlow</span>
                        <span className="comp-value">{d.edgeScore?.breakdown?.smartFlow?.contribution || 0}</span>
                    </div>
                    <div className="edge-component">
                        <span className="comp-label">Integrity</span>
                        <span className="comp-value">{d.edgeScore?.breakdown?.marketIntegrity?.contribution || 0}</span>
                    </div>
                </div>

                {/* Recommendation */}
                <div className="recommendation-box" style={{ borderColor: edgeColor }}>
                    <div className="rec-action" style={{ color: edgeColor }}>
                        {d.edgeScore?.recommendation?.action?.replace('_', ' ')}
                    </div>
                    <div className="rec-reason">{d.edgeScore?.recommendation?.reason}</div>
                    <div className="rec-confidence">Confidence: {d.edgeScore?.recommendation?.confidence}%</div>
                </div>
            </div>

            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
                <>
                    {/* AI Sentiment (Moved from Degen) */}
                    <div className="terminal-card">
                        <div className="section-title">🧠 AI SENTIMENT</div>
                        <div className={`sentiment-badge sentiment-${d.degenIntel?.sentiment?.overall?.toLowerCase()}`}>
                            {d.degenIntel?.sentiment?.overall}
                        </div>
                        <div className="sentiment-insight">
                            {d.degenIntel?.sentiment?.keyInsight}
                        </div>
                        <div className="sentiment-action">
                            💡 {d.degenIntel?.sentiment?.suggestedAction}
                        </div>
                    </div>

                    {/* Narrative Heatmap (Moved from Degen) */}
                    <div className="terminal-card">
                        <div className="section-title">
                            🔥 NARRATIVE ROTATION
                        </div>
                        <div className="current-sector">
                            Sector: <span className="sector-name">{d.degenIntel?.narrative?.currentSector}</span>
                            {d.degenIntel?.narrative?.trending && <span className="trending-badge">🔥 HOT</span>}
                        </div>
                    </div>

                    {/* Risk & Bullish Factors */}
                    {(d.edgeScore?.riskFactors?.length > 0 || d.edgeScore?.bullishFactors?.length > 0) && (
                        <div className="terminal-card factors-card">
                            {d.edgeScore?.bullishFactors?.length > 0 && (
                                <div className="factors-section bullish">
                                    <div className="factors-title">🟢 Signals</div>
                                    {d.edgeScore.bullishFactors.map((f, i) => (
                                        <div key={i} className="factor-item">{f}</div>
                                    ))}
                                </div>
                            )}
                            {d.edgeScore?.riskFactors?.length > 0 && (
                                <div className="factors-section risk">
                                    <div className="factors-title">🔴 Risks</div>
                                    {d.edgeScore.riskFactors.map((f, i) => (
                                        <div key={i} className="factor-item">{f}</div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* MARKET TAB */}
            {activeTab === 'market' && (
                <>
                    {/* TOP WALLETS (New) */}
                    <div className="terminal-card">
                        <div className="section-title">🐋 TOP WALLETS</div>
                        <div className="wallet-list">
                            {d.holderPatterns?.patterns?.length > 0 ? (
                                d.holderPatterns.patterns.map((w, i) => (
                                    <div key={i} className="wallet-item">
                                        <span className="wallet-rank">#{w.rank}</span>
                                        <span className="wallet-addr">{w.address}</span>
                                        <span className="wallet-icon" title={w.pattern}>
                                            {getPatternIcon(w.pattern)}
                                        </span>
                                        <span className={`wallet-sentiment ${w.sentiment?.toLowerCase()}`}>
                                            {w.pattern?.replace('_', ' ')}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <div className="empty-wallets">No significant wallet patterns detected</div>
                            )}
                        </div>
                    </div>

                    {/* Smart Flow (Moved from Degen) */}
                    <div className="terminal-card" style={{ borderLeft: `3px solid ${getScoreColor(d.degenIntel?.smartFlow?.score || 0)}` }}>
                        <div className="section-title">💎 SMART MONEY FLOW</div>
                        <div className="smart-score">{d.degenIntel?.smartFlow?.score || 0}/100</div>
                        <div className="smart-stats">
                            <div className="smart-stat positive">
                                <span className="stat-icon">🟢</span>
                                <span>{d.degenIntel?.smartFlow?.recentEntries || 0} Entries</span>
                            </div>
                            <div className="smart-stat negative">
                                <span className="stat-icon">🔴</span>
                                <span>{d.degenIntel?.smartFlow?.recentExits || 0} Exits</span>
                            </div>
                            <div className="smart-stat">
                                <span className="stat-icon">💰</span>
                                <span>{formatNumber(d.degenIntel?.smartFlow?.netFlow || 0)}</span>
                            </div>
                        </div>
                        {d.degenIntel?.smartFlow?.alert && (
                            <div className="smart-alert">{d.degenIntel.smartFlow.alert}</div>
                        )}
                    </div>

                    {/* Market Integrity Score */}
                    <div className="terminal-card" style={{ borderLeft: `3px solid ${getScoreColor(d.marketIntegrity?.overallScore || 0)}` }}>
                        <div className="section-title">🛡️ MARKET INTEGRITY</div>
                        <div className="integrity-score">{d.marketIntegrity?.overallScore || 0}/100</div>
                        <div className="signal-list">
                            {d.marketIntegrity?.signals?.map((s, i) => (
                                <div key={i} className="signal-item">{s}</div>
                            ))}
                        </div>
                    </div>

                    {/* Wash Trading */}
                    <div className={`terminal-card wash-${d.marketIntegrity?.washTrading?.color?.toLowerCase()}`}>
                        <div className="section-title">💧 WASH TRADING</div>
                        <div className="wash-stats">
                            <div className="wash-stat">
                                <span className="wash-label">Fake Volume</span>
                                <span className="wash-value" style={{ color: d.marketIntegrity?.washTrading?.detected ? '#ef4444' : '#22c55e' }}>
                                    {d.marketIntegrity?.washTrading?.washVolumePercent?.toFixed(1) || 0}%
                                </span>
                            </div>
                            <div className="wash-stat">
                                <span className="wash-label">Real Volume</span>
                                <span className="wash-value">{formatNumber(d.marketIntegrity?.washTrading?.realVolume)}</span>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* TRENDS TAB */}
            {activeTab === 'trends' && (
                <>
                    {/* HYPE METER */}
                    <div className="terminal-card" style={{ borderLeft: `3px solid ${getScoreColor(d.socialIntel?.hypeScore || 0)}` }}>
                        <div className="section-title">📡 HYPE RADAR</div>
                        <div className="hype-score-display">
                            <span className="hype-value">{d.socialIntel?.hypeScore || 0}</span>
                            <span className="hype-max">/100</span>
                        </div>
                        <div className="hype-narrative">
                            NARRATIVE: <span className="narrative-tag">{d.socialIntel?.narrative || 'Unknown'}</span>
                        </div>
                    </div>

                    {/* SOCIAL VOLUME */}
                    <div className="terminal-card">
                        <div className="section-title">🗣️ SOCIAL VOLUME</div>
                        <div className="social-stats">
                            <div className="stat-row">
                                <span className="stat-label">Mentions 24h</span>
                                <span className="stat-value">{formatNumber(d.socialIntel?.socialVolume || 0)}</span>
                            </div>
                            <div className="stat-row">
                                <span className="stat-label">Acceleration</span>
                                <span className={`stat-value ${d.socialIntel?.acceleration > 0 ? 'positive' : 'negative'}`}>
                                    {d.socialIntel?.acceleration > 0 ? '+' : ''}{d.socialIntel?.acceleration || 0}%
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* TOP INFLUENCERS */}
                    <div className="terminal-card">
                        <div className="section-title">📢 TOP KEY OPINION LEADERS</div>
                        <div className="influencer-list">
                            {d.socialIntel?.topInfluencers?.length > 0 ? (
                                d.socialIntel.topInfluencers.map((inf, i) => (
                                    <div key={i} className="influencer-item">
                                        <span className="influencer-rank">#{i + 1}</span>
                                        <span className="influencer-name">{inf}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="empty-state">No major KOLs detected yet</div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* DEV PROFILE TAB */}
            {activeTab === 'dev' && (
                <>
                    {/* Dev Reputation */}
                    <div className="terminal-card" style={{ borderLeft: `3px solid ${getDevLabelColor(d.devProfile?.reputation?.label)}` }}>
                        <div className="section-title">👤 DEV HISTORY</div>
                        <div className="dev-label" style={{ color: getDevLabelColor(d.devProfile?.reputation?.label) }}>
                            {d.devProfile?.reputation?.label?.replace('_', ' ')}
                        </div>
                        <div className="dev-stats">
                            <div className="dev-stat">
                                <span className="stat-num">{d.devProfile?.reputation?.previousProjects || 0}</span>
                                <span className="stat-label">Projects</span>
                            </div>
                            <div className="dev-stat success">
                                <span className="stat-num">{d.devProfile?.reputation?.successfulProjects || 0}</span>
                                <span className="stat-label">Successful</span>
                            </div>
                            <div className="dev-stat danger">
                                <span className="stat-num">{d.devProfile?.reputation?.ruggedProjects || 0}</span>
                                <span className="stat-label">Rugged</span>
                            </div>
                        </div>
                    </div>

                    {/* Drain Alert */}
                    <div className={`terminal-card ${d.devProfile?.drainAlert?.triggered ? 'alert-critical' : ''}`}>
                        <div className="section-title">⚠️ DRAIN DETECTION</div>
                        {d.devProfile?.drainAlert?.triggered ? (
                            <div className="drain-alert">
                                <span className="drain-icon">⛔</span>
                                <span>Dev sold {d.devProfile.drainAlert.devSoldPercent.toFixed(0)}% in {d.devProfile.drainAlert.timeSinceLaunch}min</span>
                            </div>
                        ) : (
                            <div className="drain-safe">✅ No drain activity detected</div>
                        )}
                    </div>
                </>
            )}

            {/* Safety Panel - Always Visible */}
            <div className={`terminal-card threat-${d.threat?.level?.toLowerCase() || 'green'}`}>
                <div className="section-title">🛡️ SAFETY</div>
                <div className="threat-display">
                    <span className="threat-level">{d.threat?.level || 'GREEN'}</span>
                    <span className="safety-score">{d.threat?.safetyScore || 100}/100</span>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
