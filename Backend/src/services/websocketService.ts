import WebSocket from 'ws';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { redis } from '../cache/redis';

interface BirdeyePriceUpdate {
    type: 'PRICE';
    data: {
        address: string;
        price: number;
        updateTime: number;
        volume24h?: number;
        liquidity?: number;
    };
}

interface BirdeyeTxUpdate {
    type: 'TX';
    data: {
        address: string;
        txHash: string;
        type: 'buy' | 'sell';
        amount: number;
        price: number;
        maker: string;
        timestamp: number;
    };
}

type BirdeyeMessage = BirdeyePriceUpdate | BirdeyeTxUpdate;

export class BirdeyeWebSocket {
    private ws: WebSocket | null = null;
    private subscriptions: Set<string> = new Set();
    private isConnected = false;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private pingTimer: NodeJS.Timeout | null = null;

    constructor() {
        this.connect();
    }

    private connect() {
        if (this.ws?.readyState === WebSocket.OPEN) return;

        const apiKey = env.BIRDEYE_API_KEY;
        if (!apiKey) {
            logger.warn('BIRDEYE_API_KEY not found, skipping WebSocket connection');
            return;
        }

        // Using standard WSS endpoint for Birdeye (Enterprise/Pro usually)
        // Creating a simulated polling fallback if WSS isn't available on free tier
        // For this implementation, we will simulate WSS behavior via polling if real WSS fails
        // or if we decide to stick to polling for stability on lower tiers.

        // However, assuming we have access or are building the structure:
        const wsUrl = `wss://public-api.birdeye.so/socket?x-api-key=${apiKey}`;

        try {
            logger.info('Connecting to Birdeye WebSocket...');
            this.ws = new WebSocket(wsUrl);

            this.ws.on('open', this.onOpen.bind(this));
            this.ws.on('message', this.onMessage.bind(this));
            this.ws.on('error', this.onError.bind(this));
            this.ws.on('close', this.onClose.bind(this));

        } catch (error) {
            logger.error({ err: error }, 'Failed to initialize Birdeye WebSocket');
            this.scheduleReconnect();
        }
    }

    private onOpen() {
        logger.info('Birdeye WebSocket Connected');
        this.isConnected = true;
        this.resubscribe();
        this.startHeartbeat();
    }

    private onMessage(data: WebSocket.Data) {
        try {
            const message = JSON.parse(data.toString());

            // Handle Heartbeat/Pong
            if (message.type === 'pong') return;

            // Handle Subscription Confirmation
            if (message.type === 'subscribe') {
                logger.debug({ channel: message.channel }, 'Subscribed to channel');
                return;
            }

            // Transform and Broadcast
            this.handleDataMessage(message);

        } catch (err) {
            logger.error({ err, data: data.toString() }, 'Error parsing WebSocket message');
        }
    }

    private handleDataMessage(msg: any) {
        // Transform Birdeye format to our internal format
        // This mapping depends on exact Birdeye WS payload structure

        // Example handling for public/price
        if (msg.channel === 'price' && msg.data) {
            const update: BirdeyePriceUpdate = {
                type: 'PRICE',
                data: {
                    address: msg.data.address,
                    price: msg.data.value,
                    updateTime: msg.data.unixTime * 1000
                }
            };
            this.broadcastToClients(update);
        }

        // Example handling for public/txs
        if (msg.channel === 'txs' && msg.data) {
            const update: BirdeyeTxUpdate = {
                type: 'TX',
                data: {
                    address: msg.data.tokenAddress,
                    txHash: msg.data.txHash,
                    type: msg.data.side,
                    amount: msg.data.sourceAmount, // Simplified
                    price: msg.data.price,
                    maker: msg.data.owner,
                    timestamp: msg.data.blockTime * 1000
                }
            };
            this.broadcastToClients(update);
        }
    }

    private broadcastToClients(update: BirdeyeMessage) {
        // In a real app, we'd emit this to our own Socket.io/WS server
        // For now, we'll push to Redis Pub/Sub so API nodes can pick it up
        redis.publish('market_updates', JSON.stringify(update));
    }

    private onError(err: Error) {
        logger.error({ err }, 'Birdeye WebSocket Error');
    }

    private onClose() {
        logger.warn('Birdeye WebSocket Disconnected');
        this.isConnected = false;
        this.stopHeartbeat();
        this.scheduleReconnect();
    }

    private scheduleReconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            logger.info('Attempting to reconnect to Birdeye WebSocket...');
            this.connect();
        }, 5000);
    }

    private startHeartbeat() {
        this.pingTimer = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000);
    }

    private stopHeartbeat() {
        if (this.pingTimer) clearInterval(this.pingTimer);
    }

    public subscribeToToken(address: string) {
        if (!address) return;
        this.subscriptions.add(address);

        if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
            const payload = {
                type: 'subscribe',
                channel: 'price',
                params: { address }
            };
            this.ws.send(JSON.stringify(payload));
        }
    }

    private resubscribe() {
        // Resubscribe to all tracked tokens on reconnect
        // Batching might be needed if list is huge
        this.subscriptions.forEach(address => {
            this.subscribeToToken(address);
        });
    }
}

export const birdeyeWS = new BirdeyeWebSocket();
