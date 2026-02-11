import React, { useState, useEffect } from 'react';
import useTokenStore from '../../store/useTokenStore';
import './FilterBar.css';

const FilterBar = () => {
    const { minLiquidity, minVolume, minMarketCap, setFilters, fetchTokens } = useTokenStore();

    // Local state for sliders to avoid re-fetching on every drag event
    const [localFilters, setLocalFilters] = useState({
        minLiquidity,
        minVolume,
        minMarketCap
    });

    // Debounce or apply on button click? User asked for flexibility.
    // Button click is safer for API load.

    const handleChange = (key, value) => {
        setLocalFilters(prev => ({ ...prev, [key]: Number(value) }));
    };

    const handleApply = () => {
        setFilters(localFilters);
        fetchTokens({ page: 1 }); // Reset to page 1 on filter change
    };

    const formatVal = (val) => {
        if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
        return `$${val}`;
    };

    return (
        <div className="filter-bar">
            {/* Min Liquidity */}
            <div className="filter-group">
                <div className="filter-label">
                    <span>Min Liquidity</span>
                    <span className="filter-value">{formatVal(localFilters.minLiquidity)}</span>
                </div>
                <input
                    type="range"
                    className="filter-slider"
                    min="1000"
                    max="500000"
                    step="1000"
                    value={localFilters.minLiquidity}
                    onChange={(e) => handleChange('minLiquidity', e.target.value)}
                />
            </div>

            {/* Min Volume */}
            <div className="filter-group">
                <div className="filter-label">
                    <span>Min Volume (24h)</span>
                    <span className="filter-value">{formatVal(localFilters.minVolume)}</span>
                </div>
                <input
                    type="range"
                    className="filter-slider"
                    min="1000"
                    max="1000000"
                    step="5000"
                    value={localFilters.minVolume}
                    onChange={(e) => handleChange('minVolume', e.target.value)}
                />
            </div>

            {/* Min Market Cap */}
            <div className="filter-group">
                <div className="filter-label">
                    <span>Min Market Cap</span>
                    <span className="filter-value">{formatVal(localFilters.minMarketCap)}</span>
                </div>
                <input
                    type="range"
                    className="filter-slider"
                    min="1000"
                    max="5000000"
                    step="5000"
                    value={localFilters.minMarketCap}
                    onChange={(e) => handleChange('minMarketCap', e.target.value)}
                />
            </div>

            <div className="filter-actions">
                <button className="apply-btn" onClick={handleApply}>
                    APPLY FILTERS
                </button>
            </div>
        </div>
    );
};

export default FilterBar;
