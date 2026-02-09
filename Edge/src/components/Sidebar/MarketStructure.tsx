import React from 'react';
import './Sidebar.css';

interface MarketStructureProps {
    phase: string;
    trend: string;
    support: number | null;
    resistance: number | null;
    volatility: string;
}

const MarketStructure: React.FC<MarketStructureProps> = ({
    phase,
    trend,
    support,
    resistance,
    volatility
}) => {
    const getTrendColor = () => {
        switch (trend) {
            case 'BULLISH': return '#22c55e';
            case 'BEARISH': return '#ef4444';
            default: return '#71717a';
        }
    };

    return (
        <div className="terminal-card">
            <div className="section-title">MARKET STRUCTURE</div>

            <div className="detail-grid">
                <div className="detail-item">
                    <label>PHASE</label>
                    <span className="mono">{phase}</span>
                </div>
                <div className="detail-item">
                    <label>TREND</label>
                    <span className="mono" style={{ color: getTrendColor() }}>{trend}</span>
                </div>
                <div className="detail-item">
                    <label>VOLATILITY</label>
                    <span className="mono">{volatility}</span>
                </div>
            </div>

            {(support || resistance) && (
                <div className="detail-grid" style={{ marginTop: '12px' }}>
                    {support && (
                        <div className="detail-item">
                            <label>SUPPORT</label>
                            <span className="mono">${support.toFixed(6)}</span>
                        </div>
                    )}
                    {resistance && (
                        <div className="detail-item">
                            <label>RESISTANCE</label>
                            <span className="mono">${resistance.toFixed(6)}</span>
                        </div>
                    )}
                </div>
            )}

            <div className="micro-copy" style={{ marginTop: '12px' }}>
                Derived from price behavior and volume analysis
            </div>
        </div>
    );
};

export default MarketStructure;
