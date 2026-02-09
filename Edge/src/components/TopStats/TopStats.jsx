import React from 'react';
import './TopStats.css';

const TopStats = () => {
    return (
        <div className="top-stats">
            <div className="stat-item">
                <div className="stat-icon">🔥</div>
                <span className="stat-label">BONK</span>
                <span className="stat-value positive">+312%</span>
            </div>
            <div className="stat-item">
                <span className="stat-label">WIF</span>
                <span className="stat-value positive">+190%</span>
            </div>
            <div className="stat-item">
                <span className="stat-label">PEPE2</span>
                <span className="stat-value positive">+420%</span>
            </div>
            <div className="stat-item">
                <span className="stat-label">SPUMP</span>
                <span className="stat-value positive">+21%</span>
            </div>
            <div className="stat-item">
                <span className="stat-label">BRUAR</span>
                <span className="stat-value positive">+8%</span>
            </div>
            <div className="stat-item">
                <span className="stat-value">86.33</span>
            </div>
        </div>
    );
};

export default TopStats;
