import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' }
});

export const api = {
    fetchTokens: async (params = {}) => {
        try {
            const response = await apiClient.get('/tokens', { params });
            console.log('Fetched tokens count:', response.data.tokens?.length || 0);
            return response.data;
        } catch (error) {
            console.error('Tokens fetch error:', error.message);
            return { tokens: [], totalPages: 1, total: 0 };
        }
    },

    getTokenDetails: async (id) => {
        try {
            const response = await apiClient.get(`/token/${id}`);
            return response.data;
        } catch (error) {
            console.error('Detail fetch error:', error.message);
            return {};
        }
    }
};