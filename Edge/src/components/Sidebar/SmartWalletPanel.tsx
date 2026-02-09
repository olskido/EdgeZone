import React from 'react';
import './Sidebar.css';

interface SmartWalletPanelProps {
    clusterDetected: boolean;
    clusterScore: number;
    wallets: Array<{
        address: string;
        entryPrice: number;
        entryTime: Date;
        smartScore: number;
    }>;
    entryTiming: string;
}

const SmartWalletPanel: React.FC<SmartWalletPanelProps> = ({
    clusterDetected,
    clusterScore,
    wallets,
    entryTiming
}) => {
    const shortenAddress = (addr: string) => {
        if (!addr || addr.length < 12) return addr;
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    return (
        <div className="terminal-card">
            <div className="section-title">SMART WALLET CLUSTER</div>

            {clusterDetected ? (
                <>
                    <div className="smart-wallet-badge" style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>
                        🟢 CLUSTER DETECTED
                    </div>
                    <div className="terminal-hero-sub" style={{ marginTop: '8px' }}>
                        Score: {clusterScore}/100 | Timing: {entryTiming}
                    </div>

                    <div className="terminal-subhead" style={{ marginTop: '16px' }}>Detected Wallets</div>
                    <div style={{ marginTop: '8px' }}>
                        {wallets.slice(0, 5).map((wallet, i) => (
                            <div key={i} className="detail-item" style={{ marginBottom: '8px' }}>
                                <label>{shortenAddress(wallet.address)}</label>
                                <span className="mono" style={{ fontSize: '11px' }}>
                                    Score: {wallet.smartScore} | ${wallet.entryPrice.toFixed(0)}
                                </span>
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <div className="micro-copy">
                    No coordinated smart wallet entries detected in recent activity.
                </div>
            )}
        </div>
    );
};

export default SmartWalletPanel;
