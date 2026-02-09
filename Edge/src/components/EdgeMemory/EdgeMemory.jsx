import React, { useState } from 'react';
import useTokenStore from '../../store/useTokenStore';
import './EdgeMemory.css';

const FALLBACK_MEMORY_ITEMS = [
    {
        symbol: "BONK",
        hypeState: "Peaking",
        hypeScore: 92,
        hypeReasons: ["Smart wallet", "Social spike"],
        hypeMemoryState: "PumpFollowed",
        lastHypeDetectedAt: "$12M",
        peakMarketCap: "$34M",
        smartMoneyBehaviorDuringHype: "Accumulated",
        topHolderBehaviorDuringHype: "Held",
        whaleActivityDuringHype: "Buying",
        name: "Bonk",
        price: "$0.000045"
    },
    {
        symbol: "WIF",
        hypeState: "Accelerating",
        hypeScore: 88,
        hypeReasons: ["Volume up"],
        hypeMemoryState: "PumpFollowed",
        lastHypeDetectedAt: "$4M",
        peakMarketCap: "$2B",
        smartMoneyBehaviorDuringHype: "Aggressive",
        topHolderBehaviorDuringHype: "Held",
        whaleActivityDuringHype: "Buying",
        name: "dogwifhat",
        price: "$2.45"
    }
];

const EdgeMemory = () => {
    const { selectToken } = useTokenStore();
    const [hoveredHype, setHoveredHype] = useState(null);
    const [hoveredMemory, setHoveredMemory] = useState(null);
    const [memoryItems] = useState(FALLBACK_MEMORY_ITEMS);

    const onTokenSelect = (token) => {
        selectToken(token); // Use global store action
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
        // Future: setExpandedPanel(token.id);
    };

    return (
        <div style={{ marginBottom: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div className="section-title">
                    🔥 EDGE MEMORY™ TRACK YOUR EDGE HISTORY OVER TIME
                </div>
                <div className="accuracy-display">
                    📊 EDGE Accuracy Today: <span className="accuracy-value">81%</span>
                </div>
            </div>

            <div className="table-section">
                <div className="edge-memory-tabs">
                    <button className="edge-memory-tab active">Today</button>
                    <button className="edge-memory-tab">7d</button>
                    <button className="edge-memory-tab">30d</button>
                    <button className="edge-memory-tab">All-Time High Gain</button>
                    <button className="edge-memory-tab">Detected (29m ago)</button>
                </div>

                <div className="memory-table-header">
                    <div>Token ↓</div>
                    <div>Market Cap Start / Peak ↓</div>
                    <div>All-Time High Gain ↓</div>
                    <div>HYPE TRACKER™ ↓</div>
                    <div>HYPE MEMORY™ ↓</div>
                    <div></div>
                </div>

                {memoryItems.map((token, index) => {
                    const hypeDisplay = getHypeStateDisplay(token.hypeState);
                    const memoryDisplay = getMemoryStateDisplay(token.hypeMemoryState, token.hypeMemoryPercentage);
                    const glowClass = getGlowIntensity(token.hypeScore);

                    return (
                        <div
                            key={index}
                            className="memory-table-row"
                            onClick={() => onTokenSelect(token)}
                            style={{ cursor: 'pointer' }}
                        >
                            <div>
                                {index === 0 ? "🔥" : index === 1 ? "🟡" : index === 2 ? "💜" : "🤖"} {token.name}
                            </div>
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
                                {index === 0 ? '29m ago' : index === 1 ? '38m ago' : '3hr ago'}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default EdgeMemory;
