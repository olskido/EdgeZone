import React from 'react';
import './Sidebar.css';

interface ThreatPanelProps {
    score: number;
    level: 'GREEN' | 'YELLOW' | 'RED';
    warnings: string[];
}

const ThreatPanel: React.FC<ThreatPanelProps> = ({ score, level, warnings }) => {
    return (
        <div className={`terminal-card threat-card threat-${level.toLowerCase()}`}>
            <div className="section-title">THREAT RADAR</div>
            <div className="threat-title">
                Manipulation Risk: {level}
                <span style={{ marginLeft: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    ({score}/100)
                </span>
            </div>
            {warnings.length > 0 ? (
                <ul className="terminal-bullets">
                    {warnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                    ))}
                </ul>
            ) : (
                <div className="micro-copy">No risk rules were triggered from available data.</div>
            )}
        </div>
    );
};

export default ThreatPanel;
