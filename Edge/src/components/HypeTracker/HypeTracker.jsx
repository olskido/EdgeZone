import React from 'react';
import './HypeTracker.css';

const HypeTracker = () => {
    return (
        <div style={{ marginBottom: '40px' }}>
            <div className="section-title">
                <span>🔥 HYPE TRACKER™</span>
            </div>

            {/* STATUS BARS */}
            <div className="status-bar">
                <div className="status-bar-section status-dont-touch">DON'T TOUCH 😱</div>
                <div className="status-bar-section status-wait">WAIT</div>
                <div className="status-bar-section status-have-edge">NOW YOU HAVE EDGE 🚀</div>
                <div className="status-bar-icons">
                    <button className="icon-btn">📋</button>
                    <button className="icon-btn">⚙️</button>
                    <button className="icon-btn">🔧</button>
                    <button className="icon-btn">🔄</button>
                </div>
            </div>

            <div className="section-subtitle">Real-Time Monitoring of On-Chain Sentiment, Liquidity Acceleration & Trading Momentum</div>
        </div>
    );
};

export default HypeTracker;
