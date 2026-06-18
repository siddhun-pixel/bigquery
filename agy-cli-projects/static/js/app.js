// State Management
let releaseNotes = [];
let activeTypeFilter = 'all';
let sortOrder = 'newest'; // 'newest' | 'oldest'
let searchQuery = '';

// DOM Elements
const feedTimeline = document.getElementById('feed-timeline');
const loader = document.getElementById('feed-loader');
const errorAlert = document.getElementById('feed-error');
const errorMessage = document.getElementById('error-message');
const noResults = document.getElementById('no-results');

const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');

const typeFiltersContainer = document.getElementById('type-filters-container');
const sortNewestBtn = document.getElementById('sort-newest');
const sortOldestBtn = document.getElementById('sort-oldest');
const refreshBtn = document.getElementById('refresh-btn');
const retryBtn = document.getElementById('retry-btn');
const cacheTimeInfo = document.getElementById('cache-time-info');

const totalDaysVal = document.getElementById('total-days');
const totalUpdatesVal = document.getElementById('total-updates');

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
    fetchReleaseNotes();
    setupEventListeners();
});

// Event Listeners setup
function setupEventListeners() {
    // Search input
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim().toLowerCase();
        clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
        renderFeed();
    });

    // Clear search button
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        searchInput.focus();
        renderFeed();
    });

    // Type filters
    typeFiltersContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.type-filter-btn');
        if (!btn) return;

        // Toggle active class
        document.querySelectorAll('.type-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        activeTypeFilter = btn.dataset.type;
        renderFeed();
    });

    // Sort buttons
    sortNewestBtn.addEventListener('click', () => {
        if (sortOrder === 'newest') return;
        sortNewestBtn.classList.add('active');
        sortOldestBtn.classList.remove('active');
        sortOrder = 'newest';
        renderFeed();
    });

    sortOldestBtn.addEventListener('click', () => {
        if (sortOrder === 'oldest') return;
        sortOldestBtn.classList.add('active');
        sortNewestBtn.classList.remove('active');
        sortOrder = 'oldest';
        renderFeed();
    });

    // Refresh action
    refreshBtn.addEventListener('click', () => {
        fetchReleaseNotes(true);
    });

    // Retry on error
    retryBtn.addEventListener('click', () => {
        fetchReleaseNotes();
    });

    // Tweet button click handler via delegation
    feedTimeline.addEventListener('click', (e) => {
        const btn = e.target.closest('.tweet-btn');
        if (!btn) return;

        const date = btn.dataset.date;
        const type = btn.dataset.type;
        const link = btn.dataset.link;
        const noteItem = btn.closest('.note-item');
        const contentText = noteItem.querySelector('.note-content').textContent.trim();

        shareOnTwitter(date, type, contentText, link);
    });
}

// Fetch Release Notes from API
async function fetchReleaseNotes(forceRefresh = false) {
    showLoader(true);
    showError(false);
    
    if (forceRefresh) {
        refreshBtn.classList.add('spinning');
    }

    try {
        const url = `/api/release-notes${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }

        releaseNotes = data.notes || [];
        updateCacheStatus(data.cached_at);
        updateDashboardStats();
        renderFeed();
        
    } catch (err) {
        console.error('Error fetching release notes:', err);
        errorMessage.textContent = err.message || 'Could not parse Google Cloud feed XML.';
        showError(true);
    } finally {
        showLoader(false);
        refreshBtn.classList.remove('spinning');
    }
}

// Update Cache Info Text
function updateCacheStatus(epochSeconds) {
    if (!epochSeconds) {
        cacheTimeInfo.textContent = 'Updated: Unknown';
        return;
    }
    const date = new Date(epochSeconds * 1000);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    cacheTimeInfo.textContent = `Cached at ${timeStr}`;
}

// Update Dashboard Statistics
function updateDashboardStats() {
    totalDaysVal.textContent = releaseNotes.length;
    
    let totalUpdates = 0;
    releaseNotes.forEach(entry => {
        totalUpdates += (entry.notes || []).length;
    });
    totalUpdatesVal.textContent = totalUpdates;
}

// Render Feed Content
function renderFeed() {
    feedTimeline.innerHTML = '';
    
    // Process data: filter & sort
    let processedEntries = JSON.parse(JSON.stringify(releaseNotes)); // Deep clone

    // Apply Filter & Search on internal items of entries
    processedEntries = processedEntries.map(entry => {
        // Filter the sub-notes
        let filteredNotes = entry.notes || [];
        
        if (activeTypeFilter !== 'all') {
            filteredNotes = filteredNotes.filter(n => n.type.toLowerCase() === activeTypeFilter.toLowerCase());
        }
        
        if (searchQuery) {
            filteredNotes = filteredNotes.filter(n => {
                const typeMatch = n.type.toLowerCase().includes(searchQuery);
                const contentMatch = n.html_content.toLowerCase().includes(searchQuery);
                const dateMatch = entry.date.toLowerCase().includes(searchQuery);
                return typeMatch || contentMatch || dateMatch;
            });
        }
        
        entry.notes = filteredNotes;
        return entry;
    });

    // Remove entries that have no sub-notes after filter
    processedEntries = processedEntries.filter(entry => entry.notes && entry.notes.length > 0);

    // Apply Sort Order to parent dates
    if (sortOrder === 'newest') {
        processedEntries.sort((a, b) => new Date(b.updated || b.date) - new Date(a.updated || a.date));
    } else {
        processedEntries.sort((a, b) => new Date(a.updated || a.date) - new Date(b.updated || b.date));
    }

    // Toggle No Results warning
    if (processedEntries.length === 0) {
        feedTimeline.style.display = 'none';
        noResults.style.display = 'flex';
        return;
    }

    noResults.style.display = 'none';
    feedTimeline.style.display = 'flex';

    // Build timeline DOM
    processedEntries.forEach(entry => {
        const card = document.createElement('article');
        card.className = 'timeline-card';
        
        // Card Header
        let linkHtml = '';
        if (entry.link) {
            linkHtml = `
                <a href="${entry.link}" target="_blank" class="card-link" title="Open source release notes">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                </a>
            `;
        }

        let notesHtml = '';
        entry.notes.forEach(note => {
            const badgeClass = getBadgeClass(note.type);
            const iconSvg = getIconSvg(note.type);
            
            notesHtml += `
                <div class="note-item">
                    <div class="note-type-row">
                        <span class="note-badge ${badgeClass}">
                            ${iconSvg}
                            ${note.type}
                        </span>
                        <button class="tweet-btn" data-date="${entry.date}" data-type="${note.type}" data-link="${entry.link}" title="Share on Twitter / X">
                            <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                            </svg>
                            Tweet
                        </button>
                    </div>
                    <div class="note-content">
                        ${note.html_content}
                    </div>
                </div>
            `;
        });

        card.innerHTML = `
            <div class="card-header">
                <h2 class="card-date">${entry.date}</h2>
                ${linkHtml}
            </div>
            <div class="card-notes">
                ${notesHtml}
            </div>
        `;

        feedTimeline.appendChild(card);
    });
}

// Helpers
function getBadgeClass(type) {
    switch (type.toLowerCase()) {
        case 'feature': return 'badge-feature';
        case 'announcement': return 'badge-announcement';
        case 'issue': return 'badge-issue';
        case 'deprecation': return 'badge-deprecation';
        default: return 'badge-general';
    }
}

function getIconSvg(type) {
    const defaultProps = 'width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
    
    switch (type.toLowerCase()) {
        case 'feature':
            return `<svg ${defaultProps}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
        case 'announcement':
            return `<svg ${defaultProps}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`;
        case 'issue':
            return `<svg ${defaultProps}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
        case 'deprecation':
            return `<svg ${defaultProps}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
        default:
            return `<svg ${defaultProps}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }
}

function shareOnTwitter(date, type, content, link) {
    const prefix = `GCP BigQuery ${type} (${date}): `;
    const suffix = link ? `\n\nLink: ${link}` : '';
    
    // Max characters: 280.
    const availableLength = 280 - prefix.length - suffix.length - 10;
    
    let tweetText = content;
    // Replace whitespace/newlines for clean tweet layout
    tweetText = tweetText.replace(/\s+/g, ' ');
    
    if (tweetText.length > availableLength) {
        tweetText = tweetText.substring(0, availableLength - 3) + '...';
    }
    
    const text = `${prefix}${tweetText}${suffix}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, '_blank');
}

function showLoader(show) {
    loader.style.display = show ? 'flex' : 'none';
}

function showError(show) {
    errorAlert.style.display = show ? 'flex' : 'none';
}
