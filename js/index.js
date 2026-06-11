// index.js - Logic for Landing Page

let allProducts = [];

function renderProducts(products) {
    const $grid = $('#product-grid');
    $grid.empty();

    if (products.length === 0) {
        $grid.html(`
            <div style="grid-column: 1 / -1;" class="text-center text-muted py-5">
                <i class="fa-solid fa-box-open mb-3" style="font-size: 4rem; opacity: 0.5;"></i>
                <h4 class="fw-bold">Tidak ada aset ditemukan</h4>
                <p>Coba ubah kata kunci pencarian atau filter tipe/kategori.</p>
            </div>
        `);
        return;
    }

    products.forEach(product => {
        let badgeClass = '', badgeText = '';
        let actionHtml = '';
        let priceHtml = '';
        
        if (product.type === 'free') {
            badgeClass = 'badge-free'; 
            badgeText = 'FREE';
            priceHtml = `<span class="product-price price-free">Gratis</span>`;
            actionHtml = `<a href="detail.html?id=${product.id}" class="btn btn-sm btn-outline-success w-100 mt-3 rounded-3 fw-bold py-2">Ambil Gratis</a>`;
        } else if (product.type === 'paid') {
            badgeClass = 'badge-paid'; 
            badgeText = 'PREMIUM';
            priceHtml = `<span class="product-price price-paid">${formatRupiah(product.price)}</span>`;
            actionHtml = `<button onclick="addToCart({id:${product.id}, name:'${product.name.replace(/'/g, "\\'")}', price:${product.price}, thumbnail:'${product.thumbnail}'}); event.stopPropagation();" class="btn btn-sm btn-primary-custom w-100 mt-3 rounded-3 fw-bold py-2"><i class="fa-solid fa-cart-plus me-1"></i> Keranjang</button>`;
        } else if (product.type === 'auction') {
            badgeClass = 'badge-auction'; 
            badgeText = 'LELANG';
            
            // Ambil harga tawaran tertinggi yang ter-update dari localStorage (jika ada)
            const bidsData = window.getBids();
            const currentBidData = bidsData[product.id];
            const displayBid = currentBidData ? currentBidData.currentBid : product.currentBid;

            priceHtml = `
                <div class="d-flex flex-column text-end">
                    <span class="fs-7 text-muted lh-1 mb-1">Bid Tertinggi</span>
                    <span class="product-price price-auction lh-1">${formatRupiah(displayBid)}</span>
                </div>
            `;
            actionHtml = `
                <div class="d-flex flex-column mt-3">
                    <div class="countdown-timer text-center small text-warning mb-2 fw-bold" id="countdown-${product.id}">Menghitung...</div>
                    <a href="detail.html?id=${product.id}" class="btn btn-sm btn-outline-warning w-100 rounded-3 fw-bold py-2"><i class="fa-solid fa-gavel me-1"></i> Ikut Lelang</a>
                </div>
            `;
        }

        const formatsArray = product.format || product.formats || [];
        const tagsHtml = formatsArray.map(f => `<span class="badge bg-secondary me-1 bg-opacity-25 text-light border border-secondary" style="font-size:0.7rem;">${f}</span>`).join('');

        const cardHtml = `
            <div class="product-card cursor-pointer" onclick="window.location.href='detail.html?id=${product.id}'" style="cursor: pointer;">
                <div class="product-thumbnail-wrapper">
                    <span class="product-type-badge ${badgeClass}">${badgeText}</span>
                    <img src="${product.thumbnail || 'assets/thumbnails/placeholder.jpg'}" onerror="this.src='assets/thumbnails/placeholder.jpg'" alt="${product.name}" class="product-thumbnail">
                </div>
                <div class="product-card-body">
                    <h3 class="product-title text-truncate" title="${product.name}">${product.name}</h3>
                    <div class="product-creator"><i class="fa-solid fa-user-circle me-1 text-primary-custom"></i> ${product.creator}</div>
                    
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <div class="product-rating">
                            <i class="fa-solid fa-star"></i> <span class="fw-bold text-white">${product.rating}</span> <span class="reviews">(${product.reviews})</span>
                        </div>
                        <div class="text-muted" style="font-size:0.8rem;"><i class="fa-solid fa-shapes me-1"></i>${product.polycount}</div>
                    </div>
                    
                    <div class="mb-3">
                        ${tagsHtml}
                    </div>

                    <div class="product-footer mt-auto">
                        <div class="w-100 d-flex justify-content-between align-items-end">
                            ${product.type !== 'auction' ? '<span class="d-block fs-7 text-muted lh-1 mb-1">Harga</span>' : '<div></div>'}
                            ${priceHtml}
                        </div>
                    </div>
                    <div onclick="event.stopPropagation()">
                        ${actionHtml}
                    </div>
                </div>
            </div>
        `;
        
        $grid.append(cardHtml);

        if (product.type === 'auction') {
            renderCountdown(product.auctionEndTime, `#countdown-${product.id}`);
            setInterval(() => {
                renderCountdown(product.auctionEndTime, `#countdown-${product.id}`);
            }, 1000);
        }
    });
}

function renderCountdown(endTimeStr, selector) {
    const time = getTimeRemaining(endTimeStr);
    const $el = $(selector);
    
    if (time.expired) {
        $el.html('<i class="fa-solid fa-circle-exclamation me-1"></i> Lelang Berakhir').removeClass("text-warning").addClass("text-danger");
    } else {
        $el.html(`<i class="fa-regular fa-clock me-1"></i> ${time.days}h ${time.hours}j ${time.minutes}m ${time.seconds}s`);
    }
}

function applyFilters() {
    const searchVal = $('#search-input').val().toLowerCase();
    const catVal = $('#filter-kategori').val();
    const typeVal = $('.filter-tipe-btn.active').data('tipe');
    const sortVal = $('#filter-sort').val();

    let filtered = allProducts.filter(p => {
        const nameStr = p.name || '';
        const creatorStr = p.creator || '';
        const tagsStr = Array.isArray(p.tags) ? p.tags.join(' ') : '';
        const matchSearch = nameStr.toLowerCase().includes(searchVal) || 
                            creatorStr.toLowerCase().includes(searchVal) || 
                            tagsStr.toLowerCase().includes(searchVal);
        const matchCat = (catVal === 'Semua') || (p.category === catVal);
        const matchType = (typeVal === 'Semua') || (p.type === typeVal);
        return matchSearch && matchCat && matchType;
    });

    if (sortVal === 'termurah') {
        filtered.sort((a, b) => {
            const priceA = a.type === 'auction' ? a.currentBid : a.price;
            const priceB = b.type === 'auction' ? b.currentBid : b.price;
            return priceA - priceB;
        });
    } else if (sortVal === 'termahal') {
        filtered.sort((a, b) => {
            const priceA = a.type === 'auction' ? a.currentBid : a.price;
            const priceB = b.type === 'auction' ? b.currentBid : b.price;
            return priceB - priceA;
        });
    } else if (sortVal === 'nama-asc') {
        filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    renderProducts(filtered);
}

$(document).ready(function() {
    loadProductsFromJSON(function(products) {
        allProducts = products;
        renderProducts(products);
    });

    // Debounce timer for search
    let searchTimeout;
    $('#search-input').on('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(applyFilters, 300);
    });

    $('#search-input').on('keypress', function(e) {
        if (e.which === 13) { // Enter key
            e.preventDefault();
            clearTimeout(searchTimeout);
            applyFilters();
        }
    });

    // Event listener for category & sort
    $('#filter-kategori, #filter-sort').on('change', applyFilters);

    // Event listener for type buttons
    $('.filter-tipe-btn').on('click', function() {
        $('.filter-tipe-btn').removeClass('active');
        $(this).addClass('active');
        applyFilters();
    });

    // Real-time sync antar tab untuk data bid di beranda
    window.addEventListener('storage', function(e) {
        if (e.key === 'lapak3d_bids') {
            applyFilters(); // Re-render katalog dengan data bid terbaru
        }

        if (e.key === 'lapak3d_products') {
            loadProductsFromJSON(function(products) {
                allProducts = products;
                applyFilters();
            });
        }
    });
});
