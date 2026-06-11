// js/cart.js - Logic for Shopping Cart

function renderCart() {
    const cart = window.getCart();
    const $container = $('#cart-items');
    $container.empty();
    
    // State kosong
    if (cart.length === 0) {
        $container.html(`
            <div class="text-center py-5 rounded-4" style="background-color: var(--bg-card); border: 1px dashed var(--border);">
                <i class="fa-solid fa-cart-arrow-down text-muted mb-3" style="font-size: 5rem; opacity: 0.3;"></i>
                <h4 class="fw-bold text-white mb-2">Keranjang belanja kosong</h4>
                <p class="text-muted mb-4">Sepertinya kamu belum menambahkan aset 3D apapun ke sini.</p>
                <a href="index.html#filter" class="btn btn-primary-custom px-4 py-2 rounded-pill fw-bold hover-lift"><i class="fa-solid fa-bag-shopping me-2"></i> Mulai Belanja</a>
            </div>
        `);
        
        $('#summary-subtotal, #summary-total').text('Rp 0');
        $('#btn-checkout').prop('disabled', true);
        return;
    }
    
    // Ada isinya
    $('#btn-checkout').prop('disabled', false);
    let subtotal = 0;
    
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        
        const html = `
            <div class="d-flex flex-column flex-md-row align-items-center p-3 rounded-4 shadow-sm" style="background-color: var(--bg-card); border: 1px solid var(--border);">
                <img src="${item.thumbnail || 'assets/thumbnails/placeholder.jpg'}" onerror="this.src='assets/thumbnails/placeholder.jpg'" alt="${item.name}" class="rounded-3 me-md-4 mb-3 mb-md-0" style="width: 100px; height: 100px; object-fit: cover; border: 1px solid rgba(255,255,255,0.1);">
                
                <div class="flex-grow-1 w-100 text-center text-md-start">
                    <h5 class="fw-bold mb-1 text-truncate pe-md-3">${item.name}</h5>
                    <div class="text-muted fs-7 mb-2">${item.price === 0 ? '<span class="text-success fw-bold">Gratis</span>' : window.formatRupiah(item.price) + ' <span class="fs-7 opacity-75">/ item</span>'}</div>
                </div>
                
                <div class="d-flex align-items-center justify-content-between w-100 w-md-auto mt-3 mt-md-0">
                    <div class="d-flex align-items-center bg-primary bg-opacity-10 rounded-pill px-2 py-1 border border-primary border-opacity-25 me-md-4">
                        <button class="btn btn-sm text-primary-light btn-qty-minus hover-lift" data-id="${item.id}" style="border:none;"><i class="fa-solid fa-minus"></i></button>
                        <span class="fw-bold mx-3 text-white">${item.quantity}</span>
                        <button class="btn btn-sm text-primary-light btn-qty-plus hover-lift" data-id="${item.id}" style="border:none;"><i class="fa-solid fa-plus"></i></button>
                    </div>
                    
                    <div class="text-end me-md-4 ms-auto ms-md-0" style="min-width: 120px;">
                        <div class="text-muted fs-7">Subtotal</div>
                        <div class="fw-bold text-white fs-5">${itemTotal === 0 ? '<span class="text-success">Gratis</span>' : window.formatRupiah(itemTotal)}</div>
                    </div>
                    
                    <button class="btn btn-outline-danger border-0 rounded-circle btn-remove ms-3 hover-lift" data-id="${item.id}" title="Hapus Item" style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;"><i class="fa-regular fa-trash-can fs-5"></i></button>
                </div>
            </div>
        `;
        $container.append(html);
    });
    
    const formattedTotal = window.formatRupiah(subtotal);
    $('#summary-subtotal, #summary-total').text(formattedTotal);
}

$(document).ready(function() {
    // Initial Render
    renderCart();
    
    // Event Delegations untuk tombol dinamis
    $('#cart-items').on('click', '.btn-qty-plus', function() {
        const id = $(this).data('id');
        const cart = window.getCart();
        const item = cart.find(i => i.id == id);
        if (item) {
            window.updateCartQuantity(id, item.quantity + 1);
            renderCart();
        }
    });
    
    $('#cart-items').on('click', '.btn-qty-minus', function() {
        const id = $(this).data('id');
        const cart = window.getCart();
        const item = cart.find(i => i.id == id);
        if (item) {
            window.updateCartQuantity(id, item.quantity - 1);
            renderCart();
        }
    });
    
    $('#cart-items').on('click', '.btn-remove', function() {
        if (confirm('Apakah Anda yakin ingin menghapus aset ini dari keranjang?')) {
            const id = $(this).data('id');
            window.removeFromCart(id);
            renderCart();
        }
    });
    
    // Checkout Process
    $('#btn-checkout').on('click', function() {
        if (!window.checkLoginStatus()) {
            window.showToast("Silakan login terlebih dahulu untuk melanjutkan checkout", true);
            if (window.loginSimulation()) {
                // Jika berhasil login, biarkan user klik tombol checkout lagi untuk konfirmasi
                return;
            } else {
                return;
            }
        }
        
        const cart = window.getCart();
        if (cart.length === 0) return;
        
        const totalAmount = window.getCartTotal();

        // Buat order object
        const order = {
            id: 'ORD-' + Date.now(),
            date: new Date().toISOString(),
            items: cart,
            total: totalAmount
        };

        if (totalAmount > 0) {
            // Save as pending and go to payment
            sessionStorage.setItem('lapak3d_pending_order', JSON.stringify(order));
            window.location.href = 'payment.html';
        } else {
            // Disable tombol biar gak double click
            const $btn = $(this);
            $btn.prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin me-2"></i> Memproses...');
            
            // Simpan ke local storage khusus orders
            let orders = JSON.parse(localStorage.getItem('lapak3d_orders')) || [];
            orders.push(order);
            localStorage.setItem('lapak3d_orders', JSON.stringify(orders));
            
            // Bersihkan keranjang
            window.saveCart([]);
            window.updateCartBadge();
            
            window.showToast("Klaim item gratis berhasil! 🎉");
            
            // Redirect setelah pesan dibaca
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        }
    });
});
