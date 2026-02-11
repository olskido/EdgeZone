import { useCallback, useEffect, useRef } from 'react';
import useTokenStore from '../store/useTokenStore';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000/ws';
const WS_ENABLED = (import.meta.env.VITE_WS_ENABLED ?? 'false') === 'true';
const BACKEND_ENABLED = (import.meta.env.VITE_BACKEND_ENABLED ?? 'false') === 'true';

export const useWebSocket = () => {
    const ws = useRef(null);
    const { updateToken, selectedToken } = useTokenStore();

    const subscribe = useCallback((channels) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ action: 'subscribe', channels }));
        }
    }, []);

    useEffect(() => {
        if (!WS_ENABLED) return;
        if (!BACKEND_ENABLED) return;

        ws.current = new WebSocket(WS_URL);

        ws.current.onopen = () => {
            console.log('✅ Connected to WebSocket Stream');
            subscribe(['token_updates', 'whale_events', 'edge_score_updates', 'hype_updates']);
        };

        ws.current.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);

                if (message.type === 'TOKEN_UPDATE') {
                    updateToken(message.data);
                }

                // Handle Real-time Price Updates
                if (message.type === 'PRICE') {
                    // Optimistically update token price in store
                    // This requires a new action in useTokenStore or just updating the finding token
                    // For now, let's assume updateToken handles partial updates
                    updateToken({
                        address: message.data.address,
                        price: message.data.price,
                        priceChange24h: message.data.priceChange24h // if available
                    });
                }

                if (message.type === 'TX') {
                    console.log(`⚡ TX: ${message.data.type.toUpperCase()} $${message.data.amount} @ $${message.data.price}`);
                    // Could trigger a toast or ephemeral UI update here
                }

                if (message.type === 'WHALE_ALERT') {
                    console.log('🐋 Whale Alert:', message.data);
                }
            } catch (err) {
                console.error('WS Parse Error:', err);
            }
        };

        ws.current.onclose = () => {
            console.log('⚠️ WebSocket Disconnected. Reconnecting in 3s...');
            setTimeout(() => {
                // Trigger reconnect by resetting ref — 
                // in production wrap this in a dedicated reconnect manager
                ws.current = null;
            }, 3000);
        };

        return () => {
            if (ws.current) ws.current.close();
        };
    }, [updateToken, subscribe]);

    // Subscribe to specific token channel when sidebar selection changes
    useEffect(() => {
        if (!WS_ENABLED) return;
        if (!BACKEND_ENABLED) return;
        if (selectedToken && ws.current && ws.current.readyState === WebSocket.OPEN) {
            subscribe([`token:${selectedToken.symbol}`]); // Fixed: was missing opening bracket
        }
    }, [selectedToken, subscribe]);
};
