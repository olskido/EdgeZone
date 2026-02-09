import React from 'react';
import './Sidebar.css';

interface MomentumPanelProps {
    score: number;
    label: 'RED' | 'BLUE' | 'GREEN' | 'EXPLOSIVE';
    signals: string[];
}

const MomentumPanel: React.FC<MomentumPanelProps> = ({ score, label, signals }) => {
    const getLabelColor = () => {
        switch (label) {
            case 'EXPLOSIVE': return '#10b981';
            case 'GREEN': return '#22c55e';
            case 'BLUE': return '#3b82f6';
            case 'RED': return '#ef4444';
            default: return '#71717a';
        }
    };

    return (
        <div className="terminal-card">
            <div className="section-title">MOMENTUM ENGINE</div>
            <div className="phase-line">
                CURRENT PHASE: <span className="phase-strong" style={{ color: getLabelColor() }}>
                    {label}
                </span>
                <span style={{ marginLeft: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Score: {score}/100
                </span>
            </div>
            <div className="terminal-subhead" style={{ marginTop: '12px' }}>Signals</div>
            <ul className="terminal-bullets">
                {signals.map((signal, i) => (
                    <li key={i}>{signal}</li>
                ))}
            </ul>
        </div>
    );
};

export default MomentumPanel;
