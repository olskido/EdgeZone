import React from 'react';
import './Sidebar.css';

interface AlphaPanelProps {
    score: 'LOW' | 'MODERATE' | 'HIGH' | 'ELITE';
    numericScore: number;
    breakdown: Record<string, number>;
}

const AlphaPanel: React.FC<AlphaPanelProps> = ({ score, numericScore, breakdown }) => {
    const getScoreColor = () => {
        switch (score) {
            case 'ELITE': return '#10b981';
            case 'HIGH': return '#22c55e';
            case 'MODERATE': return '#f59e0b';
            case 'LOW': return '#ef4444';
            default: return '#71717a';
        }
    };

    return (
        <div className="terminal-card" style={{ borderLeft: `3px solid ${getScoreColor()}` }}>
            <div className="section-title">ALPHA SCORE</div>
            <div className="terminal-hero-title" style={{ color: getScoreColor() }}>
                {score}
            </div>
            <div className="terminal-hero-sub">
                Composite Score: {numericScore}/100
            </div>

            <div className="terminal-subhead" style={{ marginTop: '16px' }}>Score Breakdown</div>
            <div className="detail-grid">
                <div className="detail-item">
                    <label>MOMENTUM</label>
                    <span className="mono">{breakdown.momentum}</span>
                </div>
                <div className="detail-item">
                    <label>CONVICTION</label>
                    <span className="mono">{breakdown.conviction}</span>
                </div>
                <div className="detail-item">
                    <label>CLUSTER</label>
                    <span className="mono">{breakdown.cluster}</span>
                </div>
                <div className="detail-item">
                    <label>SAFETY</label>
                    <span className="mono">{breakdown.threatInverse}</span>
                </div>
            </div>
            <div className="micro-copy" style={{ marginTop: '12px' }}>
                Meta-score aggregating all intelligence signals
            </div>
        </div>
    );
};

export default AlphaPanel;
