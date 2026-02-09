import React from 'react';
import './Sidebar.css';

interface AIInsightProps {
    summary: string | null;
    cachedAt: Date | null;
}

const AIInsight: React.FC<AIInsightProps> = ({ summary, cachedAt }) => {
    if (!summary) {
        return (
            <div className="terminal-card">
                <div className="section-title">AI ANALYSIS</div>
                <div className="micro-copy">
                    AI analysis pending. Insights will appear once scoring engines complete first cycle.
                </div>
            </div>
        );
    }

    return (
        <div className="terminal-card" style={{ borderLeft: '3px solid var(--accent-blue)' }}>
            <div className="section-title">AI ANALYSIS</div>
            <div className="micro-copy" style={{ lineHeight: '1.6', fontStyle: 'italic' }}>
                {summary}
            </div>
            {cachedAt && (
                <div className="micro-copy" style={{ marginTop: '8px', opacity: 0.6 }}>
                    Generated {new Date(cachedAt).toLocaleTimeString()}
                </div>
            )}
        </div>
    );
};

export default AIInsight;
