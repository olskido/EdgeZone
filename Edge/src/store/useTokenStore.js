// src/store/useTokenStore.js
import { create } from 'zustand';
import { api } from '../services/api'; // your direct fetch file

const useTokenStore = create((set, get) => ({
    // State
    tokens: [],
    selectedToken: null,
    loading: false,
    loadingToken: false,
    error: null,
    searchQuery: '',
    lastFetchTime: null,

    // Actions
    fetchTokens: async () => {
        set({ loading: true, error: null });

        try {
            const data = await api.fetchTokens({ limit: 100 }); // fetch up to 100 for table
            set({
                tokens: data.tokens || [],
                loading: false,
                lastFetchTime: new Date().toISOString(),
                error: null,
            });
            console.log(`[Store] Loaded ${data.tokens.length} tokens at ${new Date().toLocaleTimeString()}`);
        } catch (err) {
            console.error('[Store] Fetch failed:', err);
            set({
                loading: false,
                error: err.message || 'Failed to load tokens',
            });
        }
    },

    selectToken: async (token) => {
        if (!token) return;

        set({
            selectedToken: token,
            loadingToken: true,
            error: null,
        });

        try {
            // Fetch token details (Birdeye single token or DexScreener pair)
            const details = await api.getTokenDetails(token.contract || token.id);

            set({
                selectedToken: {
                    ...token,
                    ...details,
                },
                loadingToken: false,
            });
        } catch (err) {
            console.error('[Store] Detail fetch failed:', err);
            set({
                loadingToken: false,
                error: 'Failed to load token details',
            });
        }
    },

    // Optional optimistic update (e.g. manual price refresh)
    updateToken: (updatedData) => set((state) => {
        const address = updatedData.contract || updatedData.id;

        const newTokens = state.tokens.map(t =>
            (t.contract || t.id) === address ? { ...t, ...updatedData } : t
        );

        const newSelected = (state.selectedToken?.contract || state.selectedToken?.id) === address
            ? { ...state.selectedToken, ...updatedData }
            : state.selectedToken;

        return { tokens: newTokens, selectedToken: newSelected };
    }),

    setSearchQuery: (query) => set({ searchQuery: query }),

    clearSelection: () => set({ selectedToken: null, loadingToken: false }),
}));

export default useTokenStore;