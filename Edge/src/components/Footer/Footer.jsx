import React from 'react';
import './Footer.css';

const Footer = () => {
    return (
        <footer>
            <div className="footer-content">
                <div className="footer-grid">
                    <div className="footer-column">
                        <h3>FEATURES</h3>
                        <div className="footer-links">
                            <a href="#" className="footer-link">🔍 Reporter</a>
                            <a href="#" className="footer-link">📈 Hype Tracker</a>
                            <a href="#" className="footer-link">💾 EDGE Memory</a>
                        </div>
                    </div>
                    <div className="footer-column">
                        <h3>RESOURCES</h3>
                        <div className="footer-links">
                            <a href="#" className="footer-link">📊 Stats</a>
                            <a href="#" className="footer-link">📰 Hype Tracker</a>
                            <a href="#" className="footer-link">📚 Documentation</a>
                        </div>
                    </div>
                    <div className="footer-column">
                        <h3>LEGAL</h3>
                        <div className="footer-links">
                            <a href="#" className="footer-link">🔐 Privacy Policy</a>
                            <a href="#" className="footer-link">📋 Terms of Service</a>
                        </div>
                    </div>
                    <div className="footer-column">
                        <h3>LEGAL</h3>
                        <div className="footer-links">
                            <a href="#" className="footer-link">🔐 Privacy Policy</a>
                            <a href="#" className="footer-link">📋 Terms of Service</a>
                        </div>
                    </div>
                </div>

                <div className="footer-bottom">
                    <div>© 2024 EDGE ZONE™. All rights reserved.</div>
                    <div className="social-links">
                        <a href="#" className="social-link">𝕏</a>
                        <a href="#" className="social-link">🐦</a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
