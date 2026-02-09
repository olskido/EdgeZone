import React, { useState } from 'react';
import useTokenStore from '../../store/useTokenStore';
import './EdgeZoneHistory.css';

const FALLBACK_HISTORY_ITEMS = [
    {
        symbol: "MYRO",
        hypeState: "Cooling",
        hypeScore: 45,
        hypeReasons: ["Social quiet"],
        hypeMemoryState: "FailedHype",
        lastHypeDetectedAt: "$22M",
        peakMarketCap: "$25M",
        smartMoneyBehaviorDuringHype: "Sold",
        topHolderBehaviorDuringHype: "Sold",
        whaleActivityDuringHype: "Redistributing",
        name: "Myro",
        price: "$0.12"
    }
];

const EdgeZoneHistory = () => {
    const { selectToken } = useTokenStore();
    const [hoveredHype, setHoveredHype] = useState(null);
    const [hoveredMemory, setHoveredMemory] = useState(null);
    const [historyItems] = useState(FALLBACK_HISTORY_ITEMS);

    const onTokenSelect = (token) => {
        selectToken(token);
    };

    const getHypeStateDisplay = (state) => {
        const states = {
            Igniting: { emoji: '🚀', text: 'Igniting', class: 'igniting' },
            Accelerating: { emoji: '🔥', text: 'Accelerating', class: 'accelerating' },
            Peaking: { emoji: '⚡', text: 'Peaking', class: 'peaking' },
            Sustaining: { emoji: '👀', text: 'Sustaining', class: 'sustaining' },
            Cooling: { emoji: '❄', text: 'Cooling', class: 'cooling' },
            Dead: { emoji: '💀', text: 'Dead', class: 'dead' }
        };
        return states[state] || states.Sustaining;
    };

    const getMemoryStateDisplay = (state, percentage) => {
        const states = {
            PumpFollowed: { emoji: '✔', text: `Pump Followed ${percentage || ''}`, class: 'success' },
            PartialMove: { emoji: '⚠', text: `Partial Move ${percentage || ''}`, class: 'partial' },
            FailedHype: { emoji: '✖', text: 'Failed Hype', class: 'failed' },
            RugAfterHype: { emoji: '💣', text: 'Rug After Hype', class: 'rug' },
            ReAccumulating: { emoji: '↻', text: 'Re-Accumulating', class: 'reaccumulating' },
            NoPriorHype: { emoji: '', text: 'No prior hype cycle', class: 'none' }
        };
        return states[state] || states.NoPriorHype;
    };

    const getGlowIntensity = (score) => {
        if (score >= 80) return 'glow-strong';
        if (score >= 50) return 'glow-medium';
        if (score >= 20) return 'glow-low';
        return '';
    };

    const handleExpandIntelligence = (e, token, type) => {
        e.stopPropagation();
        console.log(`Expand ${type} intelligence panel for ${token.name}`);
    };

    return (
        <div style={{ marginBottom: '40px' }}>
            <div className="section-title">
                🔥 EDGE ZONE™ TRACK YOUR EDGE HISTORY OVER TIME
            </div>

            <div className="table-section">
                <div className="history-table-header">
                    <div>Token ↓</div>
                    <div>Market Cap Start / Peak</div>
                    <div>All-Time High Gain ↓</div>
                    <div>HYPE TRACKER™ ↓</div>
                    <div>HYPE MEMORY™ ↓</div>
                    <div>Edge Sessions ↓</div>
                    <div>Performance ↓</div>
                    <div></div>
                </div>

                {historyItems.map((token, index) => {
                    const hypeDisplay = getHypeStateDisplay(token.hypeState);
                    const memoryDisplay = getMemoryStateDisplay(token.hypeMemoryState, token.hypeMemoryPercentage);
                    const glowClass = getGlowIntensity(token.hypeScore);

                    return (
                        <div
                            key={index}
                            onClick={() => onTokenSelect(token)}
                            className="history-table-row"
                        >
                            <div>{index === 0 ? "🔥" : "🟡"} {token.name}</div>
                            <div>{token.marketCap} 🔥 {token.peakMarketCap || 'N/A'}</div>
                            <div style={{ color: '#ff6b35', fontWeight: 600 }}>
                                {token.hypeMemoryPercentage || 'N/A'}
                            </div>

                            {/* HYPE TRACKER™ Column */}
                            <div
                                className="hype-column"
                                onMouseEnter={() => setHoveredHype(index)}
                                onMouseLeave={() => setHoveredHype(null)}
                                onClick={(e) => handleExpandIntelligence(e, token, 'tracker')}
                            >
                                <span className={`hype-tracker-badge ${hypeDisplay.class} ${glowClass}`}>
                                    {hypeDisplay.emoji} {hypeDisplay.text}
                                </span>
                                {hoveredHype === index && (
                                    <div className="hype-tooltip">
                                        <div className="tooltip-title">Hype {hypeDisplay.text} due to:</div>
                                        <ul>
                                            {token.hypeReasons.map((reason, i) => (
                                                <li key={i}>• {reason}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            {/* HYPE MEMORY™ Column */}
                            <div
                                className="hype-column"
                                onMouseEnter={() => setHoveredMemory(index)}
                                onMouseLeave={() => setHoveredMemory(null)}
                                onClick={(e) => handleExpandIntelligence(e, token, 'memory')}
                            >
                                <span className={`hype-memory-badge ${memoryDisplay.class}`}>
                                    {memoryDisplay.emoji} {memoryDisplay.text}
                                </span>
                                {hoveredMemory === index && token.hypeMemoryState !== 'NoPriorHype' && (
                                    <div className="hype-tooltip">
                                        <div className="tooltip-title">Last Hype Cycle:</div>
                                        <div className="tooltip-detail">Detected at {token.lastHypeDetectedAt}</div>
                                        <div className="tooltip-detail">Peaked at {token.peakMarketCap}</div>
                                        <div className="tooltip-detail">{token.smartMoneyBehaviorDuringHype}</div>
                                        <div className="tooltip-detail">{token.topHolderBehaviorDuringHype}</div>
                                        <div className="tooltip-detail">{token.whaleActivityDuringHype}</div>
                                    </div>
                                )}
                            </div>

                            <div style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
                                {index === 0 ? '29m ago' : '3hrs ago'}
                            </div>
                            <div style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
                                {index === 0 ? '+578%' : '+972%'}
                            </div>
                            <div style={{ fontSize: '11px', backgroundColor: 'rgba(51, 51, 51, 0.5)', padding: '4px 8px', borderRadius: '4px' }}>
                                🔒 64%
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default EdgeZoneHistory;
