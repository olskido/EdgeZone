import React from 'react';
import './RiskLegend.css';

const RiskLegend = () => {
    return (
        <div className="risk-legend">
            <div className="legend-item">
                <div className="legend-color safe"></div>
                <span>Safe</span>
            </div>
            <div className="legend-item">
                <div className="legend-color low"></div>
                <span>Low Risk</span>
            </div>
            <div className="legend-item">
                <div className="legend-color moderate"></div>
                <span>Moderate</span>
            </div>
            <div className="legend-item">
                <div className="legend-color high"></div>
                <span>High Risk</span>
            </div>
            <div className="legend-item">
                <div className="legend-color extreme"></div>
                <span>Extreme</span>
            </div>
        </div>
    );
};

export default RiskLegend;
