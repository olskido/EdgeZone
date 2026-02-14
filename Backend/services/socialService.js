import axios from 'axios';

/**
 * Fetch social signals from LunarCrush API
 * @param {Object} tokenData - Token information with symbol
 * @returns {Object} Social metrics (mentions, sentiment, spike)
 */
export async function getSocialSignals(tokenData) {
    const apiKey = process.env.LUNARCRUSH_API_KEY;

    // Fallback if no API key
    if (!apiKey) {
        console.warn('⚠️ LUNARCRUSH_API_KEY not set - skipping social signals');
        return { mentions24h: 0, sentiment: 0, spike: 0 };
    }

    const symbol = tokenData.symbol || 'UNKNOWN';

    try {
        const response = await axios.get(`https://api.lunarcrush.com/v2?data=assets&key=${apiKey}&symbol=${symbol}`);
        const asset = response.data.data?.[0];

        if (!asset) {
            console.log(`ℹ️ No LunarCrush data for ${symbol}`);
            return { mentions24h: 0, sentiment: 0, spike: 0 };
        }

        const socialData = {
            mentions24h: asset.social_mentions_24h || 0,
            sentiment: asset.sentiment_relative_24h || 0, // 0-100 scale
            spike: asset.social_volume_delta_24h || 0 // % change
        };

        console.log(`✅ LunarCrush data for ${symbol}:`, socialData);
        return socialData;

    } catch (err) {
        console.error('❌ LunarCrush API error:', err.message);
        return { mentions24h: 0, sentiment: 0, spike: 0 };
    }
}
