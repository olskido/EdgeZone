import React from 'react';
import './Sidebar.css';

interface TokenHeaderProps {
    priceUsd: number;
    liquidityUsd: number;
    marketCap: number;
    volume24h: number;
    pairAge: string;
    dexId: string;
    baseToken: {
        symbol: string;
        name: string;
    };
}

const TokenHeader: React.FC<TokenHeaderProps> = ({
    priceUsd,
    liquidityUsd,
    marketCap,
    volume24h,
    pairAge,
    dexId,
    baseToken
}) => {
    const formatNumber = (num: number): string => {
        if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
        if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
        if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
        return `$${num.toFixed(2)}`;
    };

    return (
        <div className="sidebar-header">
            <div className="token-identity-row">
                <div className="token-name-large">
                    {baseToken.name} <span className="ticker">{baseToken.symbol}</span>
                </div>
                <div className="token-price-large">${priceUsd.toFixed(6)}</div>
            </div>

            <div className="meta-grid">
                <div className="meta-item">
                    <span className="meta-label">MARKET CAP</span>
                    <span className="meta-value">{formatNumber(marketCap)}</span>
                </div>
                <div className="meta-item">
                    <span className="meta-label">LIQUIDITY</span>
                    <span className="meta-value">{formatNumber(liquidityUsd)}</span>
                </div>
                <div className="meta-item">
                    <span className="meta-label">24H VOLUME</span>
                    <span className="meta-value">{formatNumber(volume24h)}</span>
                </div>
                <div className="meta-item">
                    <span className="meta-label">PAIR AGE</span>
                    <span className="meta-value">{pairAge}</span>
                </div>
                <div className="meta-item">
                    <span className="meta-label">DEX</span>
                    <span className="meta-value">{dexId}</span>
                </div>
            </div>
        </div>
    );
};

export default TokenHeader;
