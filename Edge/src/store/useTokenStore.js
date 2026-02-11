import { create } from 'zustand';
import { api } from '../services/api';

let selectTokenSeq = 0;

const useTokenStore = create((set, get) => ({
    tokens: [],
    selectedToken: null,
    loading: false,
    loadingToken: false,
    error: null,
    searchQuery: '',
    currentPage: 1,
    totalPages: 10,
    currentSort: 'price',
    limit: 20,
    trendFilter: 'trending',

    minLiquidity: 20000,
    minVolume: 200000,
    minMarketCap: 100000,

    setTokens: (tokens) => set({ tokens }),
    setFilters: (filters) => set({ ...filters, currentPage: 1 }),

    fetchTokens: async (overrides = {}) => {
        const state = get();
        const params = {
            page: overrides.page ?? state.currentPage,
            limit: overrides.limit ?? state.limit,
            sort: overrides.sort ?? state.currentSort,
            minLiquidity: state.minLiquidity,
            minVolume: state.minVolume,
            minMarketCap: state.minMarketCap,
        };

        set({ loading: true, error: null });

        try {
            const data = await api.fetchTokens(params);
            set({
                tokens: data.tokens || [],
                currentPage: data.page || params.page,
                totalPages: data.totalPages || 1,
                loading: false,
                currentSort: params.sort,
            });
        } catch (err) {
            console.error('Fetch failed:', err);
            set({ loading: false, error: err.message || 'Failed to load tokens' });
        }
    },

    // Legacy method alias for compatibility
    fetchTrendingTokens: async () => {
        return get().fetchTokens({ page: 1, sort: 'trend' });
    },

    // Paginate — fetch next page
    fetchPage: async (page) => {
        return get().fetchTokens({ page });
    },

    addTokens: (newTokens) => set((state) => ({
        tokens: [...state.tokens, ...newTokens]
    })),

    // Select a token — if it already has tokenIntelligence (from list), use it directly.
    // Otherwise call the backend enrichment route.
    selectToken: async (tokenOrSymbol) => {
        const seq = ++selectTokenSeq;

        // Check if backend is enabled (default to true if not specified)
        const backendEnabled = (import.meta.env.VITE_BACKEND_ENABLED ?? 'true') === 'true';

        const pickId = (t) => t?.id || t?.tokenId || t?.tokenIntelligence?.id || null;

        const pickSymbol = (t) =>
            t?.symbol ||
            t?.identity?.symbol ||
            t?.tokenIntelligence?.identity?.symbol ||
            '';

        if (!tokenOrSymbol) return;

        // Immediate selection (single source of truth)
        if (typeof tokenOrSymbol === 'object') {
            set({ selectedToken: tokenOrSymbol, loadingToken: false, error: null });

            // ALWAYS refetch details from backend for fresh analytics
            if (!backendEnabled) return;

            const id = pickId(tokenOrSymbol);
            if (!id) return;

            set({ loadingToken: true, error: null });

            try {
                const response = await api.getTokenDetails(id);
                const intelligence = response.tokenIntelligence || response;
                if (seq !== selectTokenSeq) return;

                set((state) => {
                    const currentId = pickId(state.selectedToken);
                    if (currentId && String(currentId) !== String(id)) return state;
                    return {
                        selectedToken: { ...state.selectedToken, tokenIntelligence: intelligence },
                        loadingToken: false,
                        error: null
                    };
                });
            } catch (err) {
                if (seq !== selectTokenSeq) return;
                console.error('Deep fetch failed:', err);
                set({ loadingToken: false, error: err?.message || 'Failed to load token details' });
            }

            return;
        }

        const symbol = String(tokenOrSymbol || '').trim();
        if (!symbol) return;

        const fromList = get().tokens.find((t) =>
            String(t?.id || '').toLowerCase() === symbol.toLowerCase() ||
            String(t?.symbol || '').toLowerCase() === symbol.toLowerCase()
        );
        if (fromList) {
            set({ selectedToken: fromList, loadingToken: false, error: null });
            if (fromList.tokenIntelligence) return;
            if (!backendEnabled) return;
        }

        if (!backendEnabled) {
            // Backend disabled: keep selection best-effort without deep enrichment
            if (!fromList) set({ selectedToken: get().selectedToken || null, loadingToken: false, error: null });
            return;
        }

        set({ loadingToken: true, error: null });

        try {
            const id = fromList ? pickId(fromList) : null;
            if (!id) {
                set({ loadingToken: false, error: null });
                return;
            }

            const response = await api.getTokenDetails(id);
            const intelligence = response.tokenIntelligence || response;
            if (seq !== selectTokenSeq) return;

            set((state) => {
                const currentSymbol = pickSymbol(state.selectedToken);
                if (currentSymbol && currentSymbol.toLowerCase() !== symbol.toLowerCase()) return state;
                return {
                    selectedToken: {
                        ...(state.selectedToken || fromList || { symbol }),
                        tokenIntelligence: intelligence
                    },
                    loadingToken: false,
                    error: null
                };
            });
        } catch (err) {
            if (seq !== selectTokenSeq) return;
            console.error('Deep fetch failed:', err);
            set({ loadingToken: false, error: err?.message || 'Failed to load token details' });
        }
    },

    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error }),
    setSearchQuery: (query) => set({ searchQuery: query, currentPage: 1 }),
    setPage: (page) => get().fetchTokens({ page }),
    setSort: (sort) => get().fetchTokens({ sort, page: 1 }),
    setTrendFilter: (filter) => set({ trendFilter: filter, currentPage: 1 }),

    updateToken: (updatedData) => set((state) => {
        const newTokens = state.tokens.map(t =>
            (t.id === updatedData.id || t.contract === updatedData.address)
                ? { ...t, ...updatedData }
                : t
        );

        const newSelected = state.selectedToken?.id === updatedData.id
            ? { ...state.selectedToken, ...updatedData }
            : state.selectedToken;

        return { tokens: newTokens, selectedToken: newSelected };
    }),
}));

export default useTokenStore;