import React, { useState, useEffect } from 'react';
import useTokenStore from '../../store/useTokenStore';
import { TokenIntelligenceDTO } from '../../types/intelligence';
import TokenHeader from './TokenHeader';
import MomentumPanel from './MomentumPanel';
import ConvictionPanel from './ConvictionPanel';
import ThreatPanel from './ThreatPanel';
import AlphaPanel from './AlphaPanel';
import SmartWalletPanel from './SmartWalletPanel';
import MarketStructure from './MarketStructure';
import AIInsight from './AIInsight';
import './Sidebar.css';

const Sidebar: React.FC = () => {
    const { selectedToken } = useTokenStore();
    const [intelligence, setIntelligence] = useState<TokenIntelligenceDTO | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!selectedToken) {
            setIntelligence(null);
            return;
        }

        const fetchIntelligence = async () => {
            setLoading(true);
            setError(null);

            try {
                const response = await fetch(`http://localhost:4000/token/${selectedToken.id}/intelligence`);

                if (!response.ok) {
                    throw new Error('Failed to fetch intelligence');
                }

                const data: TokenIntelligenceDTO = await response.json();
                setIntelligence(data);
            } catch (err: any) {
                console.error('Intelligence fetch error:', err);
                setError(err.message || 'Failed to load intelligence');
            } finally {
                setLoading(false);
            }
        };

        fetchIntelligence();
    }, [selectedToken]);

    if (!selectedToken) {
        return (
            <div className="sidebar">
                <div className="sidebar-empty">
                    <div>Select a token to view<br />Intelligence Analysis</div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="sidebar">
                <div className="sidebar-header">
                    <div className="skeleton skeleton-title"></div>
                    <div className="skeleton skeleton-text"></div>
                </div>
                <div className="skeleton skeleton-box"></div>
                <div className="skeleton skeleton-box"></div>
                <div className="skeleton skeleton-box"></div>
            </div>
        );
    }

    if (error || !intelligence) {
        return (
            <div className="sidebar">
                <div className="sidebar-empty error">
                    <div>Failed to load intelligence<br />{error}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="sidebar">
            <TokenHeader {...intelligence.header} />

            <AlphaPanel
                score={intelligence.alpha.score}
                numericScore={intelligence.alpha.numericScore}
                breakdown={intelligence.alpha.breakdown}
            />

            <MomentumPanel
                score={intelligence.momentum.score}
                label={intelligence.momentum.label}
                signals={intelligence.momentum.signals}
            />

            <ConvictionPanel
                score={intelligence.conviction.score}
                repeatBuyers={intelligence.conviction.repeatBuyers}
                smartWalletEntries={intelligence.conviction.smartWalletEntries}
                avgPositionSize={intelligence.conviction.avgPositionSize}
                buyPressure={intelligence.conviction.buyPressure}
            />

            <SmartWalletPanel
                clusterDetected={intelligence.smartWallets.clusterDetected}
                clusterScore={intelligence.smartWallets.clusterScore}
                wallets={intelligence.smartWallets.wallets}
                entryTiming={intelligence.smartWallets.entryTiming}
            />

            <ThreatPanel
                score={intelligence.threat.score}
                level={intelligence.threat.level}
                warnings={intelligence.threat.warnings}
            />

            <MarketStructure
                phase={intelligence.marketStructure.phase}
                trend={intelligence.marketStructure.trend}
                support={intelligence.marketStructure.support}
                resistance={intelligence.marketStructure.resistance}
                volatility={intelligence.marketStructure.volatility}
            />

            <AIInsight
                summary={intelligence.aiInsight.summary}
                cachedAt={intelligence.aiInsight.cachedAt}
            />
        </div>
    );
};

export default Sidebar;
