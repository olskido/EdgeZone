import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

const BACKEND_ENABLED = (import.meta.env.VITE_BACKEND_ENABLED ?? 'false') === 'true';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 35000, // Increased to 35s to accommodate backend 30s timeout
    headers: {
        'Content-Type': 'application/json'
    }
});

// Add response interceptor for better error handling
apiClient.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 503) {
            console.warn('⚠️ Database temporarily unavailable, will retry...');
        }
        return Promise.reject(error);
    }
);

export const api = {
    // Fetch token list with pagination
    fetchTokens: async ({ page = 1, limit = 50, sort = 'trend' }) => {
        if (!BACKEND_ENABLED) return { tokens: [], totalPages: 1 };
        try {
            const response = await apiClient.get('/tokens', {
                params: { page, limit, sort }
            });
            return response.data;
        } catch (error) {
            if (!error?.response) return { tokens: [], totalPages: 1 };
            console.error('API Fetch Error:', error);
            throw error;
        }
    },

    // Get deep token details — uses contract address for lookup
    // This is called when you click a token in the sidebar
    getTokenDetails: async (id) => {
        if (!BACKEND_ENABLED) return {};
        try {
            const response = await apiClient.get(`/token/${id}`);
            return response.data;
        } catch (error) {
            if (!error?.response) return {};
            console.error('API Detail Error:', error);
            throw error;
        }
    }
};
