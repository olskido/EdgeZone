import React from 'react';
import './Footer.css';

const Footer = () => {
    return (
        <footer>
            <div className="footer-content">
                <div className="footer-grid">
                    {/* Project Summary Column */}
                    <div className="footer-column summary-col">
                        <h3>EDGE ZONE™</h3>
                        <p className="footer-summary">
                            The ultimate high-performance crypto intelligence terminal.
                            Aggregating real-time Solana data with AI-driven risk
                            assessment to give you the competitive edge.
                        </p>
                    </div>

                    {/* Features Column */}
                    <div className="footer-column">
                        <h3>PLATFORM</h3>
                        <div className="footer-links">
                            <a href="#" className="footer-link">📈 Hype Tracker</a>
                            <a href="#" className="footer-link">💾 EDGE Memory</a>
                            <a href="#" className="footer-link">📚 Documentation</a>
                        </div>
                    </div>

                    {/* Social/Redirect Column */}
                    <div className="footer-column">
                        <h3>CONNECT</h3>
                        <div className="social-grid">
                            <a href="https://x.com/olskido" target="_blank" rel="noreferrer" className="social-btn">
                                <img src="/src/assets/footer_icons/x.png" alt="X" />
                            </a>
                            <a href="https://t.me/olskido" target="_blank" rel="noreferrer" className="social-btn">
                                <img src="/src/assets/footer_icons/telegram.png" alt="Telegram" />
                            </a>
                            <a href="https://pump.fun" target="_blank" rel="noreferrer" className="social-btn">
                                <img src="/src/assets/footer_icons/pump.png" alt="Pump.fun" />
                            </a>
                        </div>
                    </div>
                </div>

                <div className="footer-bottom">
                    <div>© 2026 EDGE ZONE™. Built for the Solana Ecosystem.</div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;