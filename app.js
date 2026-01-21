// Business Twinsies - Main Application
(function() {
    'use strict';

    // DOM Elements
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search');
    const suggestionsContainer = document.getElementById('search-suggestions');
    const comparisonResult = document.getElementById('comparison-result');
    const categorySearch = document.getElementById('category-search');
    const categoriesList = document.getElementById('categories-list');
    const categoryResults = document.getElementById('category-results');
    const categoryTitle = document.getElementById('category-title');
    const categoryBusinesses = document.getElementById('category-businesses');
    const backToCategoriesBtn = document.getElementById('back-to-categories');
    const similarityFilter = document.getElementById('similarity-filter');
    const similarityValue = document.getElementById('similarity-value');
    const navButtons = document.querySelectorAll('.nav-btn');
    const hamburger = document.querySelector('.hamburger');
    const mobileNav = document.querySelector('.mobile-nav');

    // State
    let currentSuggestionIndex = -1;
    let currentSuggestions = [];
    let maxSimilarity = 3;

    // Build search index for fast lookups
    const searchIndex = buildSearchIndex();

    // Initialize
    function init() {
        renderCategories();
        setupEventListeners();
    }

    // Build search index with both NYC and London companies
    function buildSearchIndex() {
        const index = [];
        
        BUSINESS_DATA.forEach((pair, idx) => {
            // Add NYC company
            index.push({
                name: pair.nyc_company,
                city: 'nyc',
                flag: '🇺🇸',
                category: pair.category,
                pairIndex: idx,
                searchName: pair.nyc_company.toLowerCase()
            });
            
            // Add London company
            index.push({
                name: pair.london_company,
                city: 'london',
                flag: '🇬🇧',
                category: pair.category,
                pairIndex: idx,
                searchName: pair.london_company.toLowerCase()
            });
        });
        
        return index;
    }

    // Fuzzy search implementation
    function fuzzySearch(query, limit = 10) {
        if (!query || query.length < 2) return [];
        
        const queryLower = query.toLowerCase();
        const queryWords = queryLower.split(/\s+/);
        
        const results = [];
        const seen = new Set();
        
        for (const item of searchIndex) {
            // Skip duplicates (same company might appear in multiple pairs)
            const key = `${item.name}-${item.city}`;
            if (seen.has(key)) continue;
            
            const score = calculateMatchScore(item.searchName, queryLower, queryWords);
            
            if (score > 0) {
                seen.add(key);
                results.push({
                    ...item,
                    score,
                    pair: BUSINESS_DATA[item.pairIndex]
                });
            }
        }
        
        // Sort by score (higher is better), then by name length (shorter preferred)
        results.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.name.length - b.name.length;
        });
        
        return results.slice(0, limit);
    }

    // Calculate match score for fuzzy search
    function calculateMatchScore(target, query, queryWords) {
        let score = 0;
        
        // Exact match (highest priority)
        if (target === query) {
            score += 100;
        }
        // Starts with query
        else if (target.startsWith(query)) {
            score += 50;
        }
        // Contains query as substring
        else if (target.includes(query)) {
            score += 30;
        }
        // All words match somewhere
        else {
            let allWordsMatch = true;
            let wordScore = 0;
            
            for (const word of queryWords) {
                if (word.length < 2) continue;
                
                if (target.includes(word)) {
                    wordScore += 10;
                    // Bonus for word at start
                    if (target.startsWith(word)) {
                        wordScore += 5;
                    }
                } else {
                    // Try fuzzy character matching
                    const fuzzyScore = fuzzyCharMatch(target, word);
                    if (fuzzyScore > 0.6) {
                        wordScore += fuzzyScore * 5;
                    } else {
                        allWordsMatch = false;
                    }
                }
            }
            
            if (allWordsMatch && wordScore > 0) {
                score += wordScore;
            }
        }
        
        return score;
    }

    // Fuzzy character matching (simple Levenshtein-like)
    function fuzzyCharMatch(target, query) {
        if (query.length > target.length) return 0;
        
        let matches = 0;
        let lastIndex = -1;
        
        for (const char of query) {
            const index = target.indexOf(char, lastIndex + 1);
            if (index > -1) {
                matches++;
                lastIndex = index;
            }
        }
        
        return matches / query.length;
    }

    // Highlight matching text
    function highlightMatch(text, query) {
        if (!query) return escapeHtml(text);
        
        const queryLower = query.toLowerCase();
        const textLower = text.toLowerCase();
        const index = textLower.indexOf(queryLower);
        
        if (index === -1) {
            // Try highlighting individual words
            const words = query.split(/\s+/);
            let result = text;
            
            for (const word of words) {
                if (word.length < 2) continue;
                const wordIndex = result.toLowerCase().indexOf(word.toLowerCase());
                if (wordIndex > -1) {
                    const before = result.slice(0, wordIndex);
                    const match = result.slice(wordIndex, wordIndex + word.length);
                    const after = result.slice(wordIndex + word.length);
                    result = escapeHtml(before) + '<mark>' + escapeHtml(match) + '</mark>' + escapeHtml(after);
                    break;
                }
            }
            
            return result === text ? escapeHtml(text) : result;
        }
        
        const before = text.slice(0, index);
        const match = text.slice(index, index + query.length);
        const after = text.slice(index + query.length);
        
        return escapeHtml(before) + '<mark>' + escapeHtml(match) + '</mark>' + escapeHtml(after);
    }

    // Escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Format currency
    function formatCurrency(value) {
        if (value >= 1000000000) {
            return '$' + (value / 1000000000).toFixed(1) + 'B';
        }
        if (value >= 1000000) {
            return '$' + (value / 1000000).toFixed(1) + 'M';
        }
        if (value >= 1000) {
            return '$' + (value / 1000).toFixed(0) + 'K';
        }
        return '$' + value.toLocaleString();
    }

    // Format number with commas
    function formatNumber(value) {
        return value.toLocaleString();
    }

    // Render suggestions
    function renderSuggestions(results, query) {
        if (results.length === 0) {
            suggestionsContainer.classList.add('hidden');
            return;
        }

        currentSuggestions = results;
        currentSuggestionIndex = -1;

        const resultsHtml = results.map((item, index) => `
            <div class="suggestion-item" data-index="${index}">
                <span class="suggestion-flag">${item.flag}</span>
                <div class="suggestion-content">
                    <div class="suggestion-name">${highlightMatch(item.name, query)}</div>
                    <div class="suggestion-category">${escapeHtml(item.category)}</div>
                </div>
                <span class="suggestion-score">${item.pair.similarity_score.toFixed(2)}</span>
            </div>
        `).join('');

        const reminderHtml = `
            <div class="suggestion-reminder">
                The data only includes companies registered in London or NYC as of 2023 with at least 10 employees.
            </div>
        `;

        suggestionsContainer.innerHTML = resultsHtml + reminderHtml;
        suggestionsContainer.classList.remove('hidden');

        // Add click handlers
        suggestionsContainer.querySelectorAll('.suggestion-item').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.dataset.index);
                selectSuggestion(idx);
            });
        });
    }

    // Select suggestion
    function selectSuggestion(index) {
        const item = currentSuggestions[index];
        if (!item) return;

        searchInput.value = item.name;
        clearSearchBtn.classList.remove('hidden');
        suggestionsContainer.classList.add('hidden');
        
        renderComparison(item.pair, item.city);
    }

    // Render comparison view
    function renderComparison(pair, selectedCity) {
        const nycFirst = selectedCity === 'nyc';
        
        const html = `
            <div class="comparison-header">
                <div class="comparison-title">Business Doppelgänger Match</div>
                <div class="comparison-category">${escapeHtml(pair.category)}</div>
            </div>
            <div class="comparison-grid">
                <div class="company-card ${nycFirst ? 'nyc' : 'london'}">
                    <div class="card-header">
                        <span class="card-flag">${nycFirst ? '🇺🇸' : '🇬🇧'}</span>
                        <div>
                            <div class="card-city">${nycFirst ? 'New York City' : 'London'}</div>
                            <div class="card-company">${escapeHtml(nycFirst ? pair.nyc_company : pair.london_company)}</div>
                        </div>
                    </div>
                    <div class="card-stats">
                        <div class="stat-row">
                            <span class="stat-label">Revenue</span>
                            <span class="stat-value">${formatCurrency(nycFirst ? pair.nyc_revenue : pair.london_revenue)}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Employees</span>
                            <span class="stat-value">${formatNumber(nycFirst ? pair.nyc_employees : pair.london_employees)}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Founded</span>
                            <span class="stat-value">${nycFirst ? pair.nyc_founding_year : pair.london_founding_year}</span>
                        </div>
                    </div>
                </div>
                
                <div class="comparison-connector">
                    <div class="connector-icon">↔</div>
                    <div class="similarity-badge">
                        <span class="similarity-label">Similarity</span>
                        <span class="similarity-value">${pair.similarity_score.toFixed(2)}</span>
                    </div>
                </div>
                
                <div class="company-card ${nycFirst ? 'london' : 'nyc'}">
                    <div class="card-header">
                        <span class="card-flag">${nycFirst ? '🇬🇧' : '🇺🇸'}</span>
                        <div>
                            <div class="card-city">${nycFirst ? 'London' : 'New York City'}</div>
                            <div class="card-company">${escapeHtml(nycFirst ? pair.london_company : pair.nyc_company)}</div>
                        </div>
                    </div>
                    <div class="card-stats">
                        <div class="stat-row">
                            <span class="stat-label">Revenue</span>
                            <span class="stat-value">${formatCurrency(nycFirst ? pair.london_revenue : pair.nyc_revenue)}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Employees</span>
                            <span class="stat-value">${formatNumber(nycFirst ? pair.london_employees : pair.nyc_employees)}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Founded</span>
                            <span class="stat-value">${nycFirst ? pair.london_founding_year : pair.nyc_founding_year}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        comparisonResult.innerHTML = html;
        comparisonResult.classList.remove('hidden');
        
        // Scroll to comparison
        comparisonResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Render categories
    function renderCategories(filter = '') {
        const filterLower = filter.toLowerCase();
        
        const categoryCounts = {};
        BUSINESS_DATA.forEach(pair => {
            if (!categoryCounts[pair.category]) {
                categoryCounts[pair.category] = 0;
            }
            categoryCounts[pair.category]++;
        });

        const filtered = CATEGORIES.filter(cat => 
            cat.toLowerCase().includes(filterLower)
        );

        if (filtered.length === 0) {
            categoriesList.innerHTML = `
                <div class="no-results">
                    <div class="no-results-icon">🔍</div>
                    <div class="no-results-text">No categories found matching "${escapeHtml(filter)}"</div>
                </div>
            `;
            return;
        }

        const html = filtered.map(category => `
            <div class="category-card" data-category="${escapeHtml(category)}">
                <span class="category-name">${escapeHtml(category)}</span>
                <span class="category-count">${categoryCounts[category] || 0}</span>
            </div>
        `).join('');

        categoriesList.innerHTML = html;

        // Add click handlers
        categoriesList.querySelectorAll('.category-card').forEach(el => {
            el.addEventListener('click', () => {
                showCategoryResults(el.dataset.category);
            });
        });
    }

    // Show category results
    function showCategoryResults(category) {
        const businesses = BUSINESS_DATA.filter(pair => 
            pair.category === category && pair.similarity_score <= maxSimilarity
        ).sort((a, b) => a.similarity_score - b.similarity_score);

        categoryTitle.textContent = category;

        if (businesses.length === 0) {
            categoryBusinesses.innerHTML = `
                <div class="no-results">
                    <div class="no-results-icon">📊</div>
                    <div class="no-results-text">No businesses found with similarity ≤ ${maxSimilarity}</div>
                </div>
            `;
        } else {
            const html = businesses.map((pair, idx) => `
                <div class="business-row" data-index="${idx}">
                    <div class="business-name">
                        <span>🇺🇸</span>
                        <span>${escapeHtml(pair.nyc_company)}</span>
                    </div>
                    <span class="business-arrow">↔</span>
                    <div class="business-name">
                        <span>🇬🇧</span>
                        <span>${escapeHtml(pair.london_company)}</span>
                    </div>
                    <span class="business-score">${pair.similarity_score.toFixed(2)}</span>
                </div>
            `).join('');

            categoryBusinesses.innerHTML = html;

            // Add click handlers
            categoryBusinesses.querySelectorAll('.business-row').forEach((el, idx) => {
                el.addEventListener('click', () => {
                    // Switch to search view and show comparison
                    switchView('search');
                    searchInput.value = businesses[idx].nyc_company;
                    clearSearchBtn.classList.remove('hidden');
                    renderComparison(businesses[idx], 'nyc');
                });
            });
        }

        categoriesList.style.display = 'none';
        categoryResults.classList.remove('hidden');
    }

    // Switch view
    function switchView(view) {
        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
        document.getElementById(`${view}-view`).classList.add('active');
        
        // Update both desktop and mobile nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });

        // Reset category view state
        if (view === 'browse') {
            categoriesList.style.display = 'grid';
            categoryResults.classList.add('hidden');
        }
    }

    // Setup event listeners
    function setupEventListeners() {
        // Search input
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            
            if (query.length > 0) {
                clearSearchBtn.classList.remove('hidden');
            } else {
                clearSearchBtn.classList.add('hidden');
                suggestionsContainer.classList.add('hidden');
                comparisonResult.classList.add('hidden');
            }

            if (query.length >= 2) {
                const results = fuzzySearch(query);
                renderSuggestions(results, query);
            } else {
                suggestionsContainer.classList.add('hidden');
            }
        });

        // Clear search
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearSearchBtn.classList.add('hidden');
            suggestionsContainer.classList.add('hidden');
            comparisonResult.classList.add('hidden');
            searchInput.focus();
        });

        // Keyboard navigation
        searchInput.addEventListener('keydown', (e) => {
            if (!currentSuggestions.length) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                currentSuggestionIndex = Math.min(currentSuggestionIndex + 1, currentSuggestions.length - 1);
                updateSuggestionHighlight();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                currentSuggestionIndex = Math.max(currentSuggestionIndex - 1, 0);
                updateSuggestionHighlight();
            } else if (e.key === 'Enter' && currentSuggestionIndex >= 0) {
                e.preventDefault();
                selectSuggestion(currentSuggestionIndex);
            } else if (e.key === 'Escape') {
                suggestionsContainer.classList.add('hidden');
            }
        });

        // Close suggestions on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                suggestionsContainer.classList.add('hidden');
            }
        });

        // Category search
        categorySearch.addEventListener('input', (e) => {
            renderCategories(e.target.value.trim());
        });

        // Back to categories
        backToCategoriesBtn.addEventListener('click', () => {
            categoriesList.style.display = 'grid';
            categoryResults.classList.add('hidden');
        });

        // Similarity filter
        similarityFilter.addEventListener('input', (e) => {
            maxSimilarity = parseFloat(e.target.value);
            similarityValue.textContent = maxSimilarity.toFixed(1);
        });

        // Nav buttons
        navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                switchView(btn.dataset.view);
                // Close mobile menu after selection
                if (mobileNav && hamburger) {
                    mobileNav.classList.remove('open');
                    hamburger.classList.remove('active');
                    hamburger.setAttribute('aria-expanded', 'false');
                }
            });
        });

        // Hamburger menu toggle
        if (hamburger && mobileNav) {
            hamburger.addEventListener('click', () => {
                const isOpen = mobileNav.classList.toggle('open');
                hamburger.classList.toggle('active');
                hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            });

            // Close mobile menu when clicking outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.hamburger') && !e.target.closest('.mobile-nav')) {
                    mobileNav.classList.remove('open');
                    hamburger.classList.remove('active');
                    hamburger.setAttribute('aria-expanded', 'false');
                }
            });
        }
    }

    // Update suggestion highlight
    function updateSuggestionHighlight() {
        const items = suggestionsContainer.querySelectorAll('.suggestion-item');
        items.forEach((item, idx) => {
            item.classList.toggle('active', idx === currentSuggestionIndex);
        });

        // Scroll into view
        if (currentSuggestionIndex >= 0 && items[currentSuggestionIndex]) {
            items[currentSuggestionIndex].scrollIntoView({ block: 'nearest' });
        }
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
