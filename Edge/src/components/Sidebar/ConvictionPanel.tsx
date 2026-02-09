import React from 'react';
import './Sidebar.css';

interface ConvictionPanelProps {
    score: number;
    repeatBuyers: number;
    smartWalletEntries: number;
    avgPositionSize: number;
    buyPressure: number;
}

const ConvictionPanel: React.FC<ConvictionPanelProps> = ({
    score,
    repeatBuyers,
    smartWalletEntries,
    avgPositionSize,
    buyPressure
}) => {
    return (
        <div className="terminal-card">
            <div className="section-title">CONVICTION SCORE</div>
            <div className="conviction-big">
                {score} / 100
            </div>
            <div className="micro-copy">Buyer seriousness based on wallet behavior and position sizing.</div>

            <div className="detail-grid" style={{ marginTop: '16px' }}>
                <div className="detail-item">
                    <label>REPEAT BUYERS</label>
                    <span className="mono">{repeatBuyers}</span>
                </div>
                <div className="detail-item">
                    <label>SMART WALLETS</label>
                    <span className="mono">{smartWalletEntries}</span>
                </div>
                <div className="detail-item">
                    <label>AVG POSITION</label>
                    <span className="mono">${avgPositionSize.toFixed(0)}</span>
                </div>
                <div className="detail-item">
                    <label>BUY PRESSURE</label>
                    <span className="mono">{buyPressure.toFixed(1)}%</span>
                </div>
            </div>
        </div>
    );
};

export default ConvictionPanel;
