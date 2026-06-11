// js/my-bids.js - Logic for My Bids page

$(document).ready(function() {
    // 1. Redirect Guard
    if (!window.checkLoginStatus()) {
        window.location.href = "index.html";
        return;
    }

    const user = window.getUser();
    let allProducts = [];
    
    // 2. Tentukan status tawaran (Aktif, Menang, Kalah)
    function determineStatus(bid, product) {
        const timeRemaining = window.getTimeRemaining(product.auctionEndTime);
        
        // Cari tawaran tertinggi milik user
        let myHighest = 0;
        bid.history.forEach(b => {
            if (b.user === user.username && b.amount > myHighest) {
                myHighest = b.amount;
            }
        });
        
        // Jika lelang belum berakhir
        if (!timeRemaining.expired) {
            return "active";
        }
        
        // Jika lelang sudah berakhir
        if (myHighest === bid.currentBid) {
            return "win"; // User adalah bidder tertinggi
        } else {
            return "lose"; // Kalah saing
        }
    }

    // 3. Render kartu riwayat lelang
    function renderBids(filter = "all") {
        const bidsData = window.getBids();
        const $container = $('#bids-list');
        $container.empty();
        
        let hasBids = false;
        
        allProducts.forEach(product => {
            if (product.type !== 'auction' || !bidsData[product.id]) return;
            
            const bidInfo = bidsData[product.id];
            
            // Cari tawaran tertinggi user untuk produk ini
            let myHighest = 0;
            bidInfo.history.forEach(b => {
                if (b.user === user.username && b.amount > myHighest) {
                    myHighest = b.amount;
                }
            });
            
            // Skip jika user tidak pernah menawar produk ini
            if (myHighest === 0) return;
            
            const status = determineStatus(bidInfo, product);
            
            // Aplikasikan filter UI
            if (filter !== "all" && status !== filter) return;
            
            hasBids = true;
            
            let statusIcon = '';
            let statusText = '';
            let statusClass = '';
            let actionHtml = '';
            
            if (status === 'active') {
                statusIcon = '<i class="fa-solid fa-hourglass-half me-1"></i>';
                statusText = 'Aktif';
                statusClass = 'text-warning border-warning bg-warning bg-opacity-10';
                
                const time = window.getTimeRemaining(product.auctionEndTime);
                const timeStr = `${time.days}h ${time.hours}j ${time.minutes}m ${time.seconds}s`;
                
                actionHtml = `
                    <div class="text-md-end mb-3 mb-md-0 me-md-4">
                        <div class="text-muted fs-7">Sisa Waktu</div>
                        <div class="fw-bold text-warning font-monospace bid-countdown" data-endtime="${product.auctionEndTime}">${timeStr}</div>
                    </div>
                    <a href="detail.html?id=${product.id}" class="btn btn-warning fw-bold hover-lift shadow-sm rounded-pill px-4 text-dark"><i class="fa-solid fa-arrow-trend-up me-2"></i> Naikkan Tawaran</a>
                `;
            } else if (status === 'win') {
                statusIcon = '<i class="fa-solid fa-trophy me-1"></i>';
                statusText = 'Menang';
                statusClass = 'text-success border-success bg-success bg-opacity-10';
                
                const claimKey = 'lapak3d_claimed_' + product.id;
                const isClaimed = localStorage.getItem(claimKey) === 'true';
                
                if (isClaimed) {
                    actionHtml = `<button class="btn btn-outline-secondary fw-bold text-muted rounded-pill px-4 border-secondary" disabled><i class="fa-solid fa-check me-2"></i> Sudah Diklaim</button>`;
                } else {
                    actionHtml = `<button class="btn btn-success fw-bold hover-lift shadow-sm rounded-pill px-4 btn-claim" data-id="${product.id}" data-amount="${bidInfo.currentBid}"><i class="fa-solid fa-gift me-2"></i> Klaim ke Keranjang</button>`;
                }
            } else if (status === 'lose') {
                statusIcon = '<i class="fa-solid fa-xmark me-1"></i>';
                statusText = 'Kalah';
                statusClass = 'text-danger border-danger bg-danger bg-opacity-10';
                
                actionHtml = `<a href="detail.html?id=${product.id}" class="btn btn-outline-secondary text-white fw-bold hover-lift shadow-sm border-secondary rounded-pill px-4">Lihat Aset</a>`;
            }
            
            const isHighest = myHighest === bidInfo.currentBid;
            const myBidStatus = isHighest ? '<span class="text-success fw-bold ms-2 fs-7">(Tertinggi)</span>' : '<span class="text-danger ms-2 fs-7">(Disalip)</span>';
            
            const html = `
                <div class="d-flex flex-column flex-md-row p-4 rounded-4 shadow-sm align-items-md-center" style="background-color: var(--bg-card); border: 1px solid var(--border);">
                    <div class="mb-3 mb-md-0 me-md-4 position-relative">
                        <span class="badge ${statusClass} border position-absolute top-0 start-0 m-2 px-2 py-1 shadow-sm">${statusIcon} ${statusText}</span>
                        <img src="${product.thumbnail}" onerror="this.src='assets/thumbnails/placeholder.jpg'" alt="${product.name}" class="rounded-3 border border-secondary border-opacity-50" style="width: 140px; height: 140px; object-fit: cover;">
                    </div>
                    
                    <div class="flex-grow-1">
                        <div class="text-muted fs-7 mb-1"><i class="fa-solid fa-tag me-1"></i> ${product.category}</div>
                        <h4 class="fw-bold text-white mb-3 text-truncate" style="max-width: 350px;"><a href="detail.html?id=${product.id}" class="text-white text-decoration-none hover-text-primary">${product.name}</a></h4>
                        
                        <div class="row g-2 align-items-center">
                            <div class="col-6 col-sm-5">
                                <div class="text-muted fs-7 mb-1">Tawaran Saya</div>
                                <div class="fw-bolder fs-5">${window.formatRupiah(myHighest)}</div>
                                <div style="margin-top: -3px;">${status === 'active' ? myBidStatus : ''}</div>
                            </div>
                            <div class="col-6 col-sm-5 border-start border-secondary ps-3" style="border-color: rgba(51, 65, 85, 0.5) !important;">
                                <div class="text-muted fs-7 mb-1">Bid Tertinggi Saat Ini</div>
                                <div class="fw-bolder fs-5 text-primary-light">${window.formatRupiah(bidInfo.currentBid)}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="d-flex flex-column flex-md-row align-items-md-center justify-content-md-end mt-4 mt-md-0 border-top border-md-0 border-secondary pt-3 pt-md-0 w-md-auto text-md-end" style="border-color: rgba(51, 65, 85, 0.5) !important;">
                        ${actionHtml}
                    </div>
                </div>
            `;
            $container.append(html);
        });
        
        if (!hasBids) {
            $container.html(`
                <div class="text-center py-5 rounded-4 shadow-sm" style="background-color: var(--bg-card); border: 1px dashed var(--border);">
                    <i class="fa-solid fa-gavel text-muted mb-3" style="font-size: 4rem; opacity: 0.3;"></i>
                    <h5 class="fw-bold text-white mb-2">Tidak ada riwayat tawaran</h5>
                    <p class="text-muted mb-4">Kamu belum pernah mengajukan tawaran untuk filter yang dipilih.</p>
                    <a href="index.html#filter" class="btn btn-outline-warning text-warning px-4 py-2 rounded-pill fw-bold hover-lift">Cari Aset Lelang</a>
                </div>
            `);
        }
    }

    // 4. Update timer dinamis tanpa re-render keseluruhan UI
    function updateTimers() {
        $('.bid-countdown').each(function() {
            const endTime = $(this).data('endtime');
            const time = window.getTimeRemaining(endTime);
            if (time.expired) {
                // Jika tiba-tiba expired, render ulang supaya status Aktif berubah ke Menang/Kalah
                const currentFilter = $('.filter-bid-btn.active').data('filter');
                renderBids(currentFilter);
            } else {
                const timeStr = `${time.days}h ${time.hours}j ${time.minutes}m ${time.seconds}s`;
                $(this).text(timeStr);
            }
        });
    }

    // 5. Inisialisasi
    window.loadProductsFromJSON(function(products) {
        allProducts = products;
        renderBids("all");
        
        // Loop update countdown setiap detik
        setInterval(updateTimers, 1000);
    });

    // 6. Tombol Filter
    $('.filter-bid-btn').on('click', function() {
        $('.filter-bid-btn').removeClass('active');
        $(this).addClass('active');
        const filter = $(this).data('filter');
        renderBids(filter);
    });

    // Real-time sync antar tab untuk riwayat bid (my-bids)
    window.addEventListener('storage', function(e) {
        if (e.key === 'lapak3d_bids') {
            const currentFilter = $('.filter-bid-btn.active').data('filter') || "all";
            renderBids(currentFilter);
        }
    });
    
    // 7. Event Klaim Pemenang
    $('#bids-list').on('click', '.btn-claim', function() {
        const id = $(this).data('id');
        const amount = $(this).data('amount');
        const product = window.getProductById(allProducts, id);
        
        if (product) {
            // Tembakkan confetti
            if (typeof confetti === 'function') {
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#8b5cf6', '#10b981', '#f59e0b', '#ffffff']
                });
            }

            const claimKey = 'lapak3d_claimed_' + product.id;
            window.addToCart(product, amount);
            localStorage.setItem(claimKey, 'true');
            
            window.showToast("Luar biasa! Aset berhasil diklaim. Mengarahkan ke keranjang...");
            
            const $btn = $(this);
            $btn.prop('disabled', true).removeClass('btn-success').addClass('btn-secondary border-secondary text-muted').html('<i class="fa-solid fa-spinner fa-spin me-2"></i> Memproses...');
            
            setTimeout(() => {
                window.location.href = 'cart.html';
            }, 2500); // Waktu diubah jadi 2.5s supaya confetti terlihat
        }
    });
});
