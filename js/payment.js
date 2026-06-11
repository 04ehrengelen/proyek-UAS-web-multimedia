// js/payment.js - Logic for QRIS Payment

$(document).ready(function() {
    if (!window.checkLoginStatus()) {
        window.location.href = "index.html";
        return;
    }

    const pendingOrderStr = sessionStorage.getItem('lapak3d_pending_order');
    if (!pendingOrderStr) {
        window.location.href = "index.html";
        return;
    }

    const pendingOrder = JSON.parse(pendingOrderStr);
    $('#payment-total').text(window.formatRupiah(pendingOrder.total));

    $('#btn-confirm-payment').on('click', function() {
        const $btn = $(this);
        $btn.prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin me-2"></i> Memproses...');
        
        setTimeout(() => {
            // Save order to history
            let orders = JSON.parse(localStorage.getItem('lapak3d_orders')) || [];
            orders.push(pendingOrder);
            localStorage.setItem('lapak3d_orders', JSON.stringify(orders));

            // Update global sales
            let globalSales = JSON.parse(localStorage.getItem('lapak3d_global_sales')) || {};
            const user = window.getUser();
            
            pendingOrder.items.forEach(item => {
                if (!globalSales[item.id]) {
                    globalSales[item.id] = { buyers: [], totalAmount: 0 };
                }
                
                // Add buyer if not already bought (or track multiple purchases)
                globalSales[item.id].buyers.push({
                    username: user.username,
                    amount: item.price * item.quantity,
                    date: pendingOrder.date
                });
                
                globalSales[item.id].totalAmount += (item.price * item.quantity);
            });
            localStorage.setItem('lapak3d_global_sales', JSON.stringify(globalSales));

            // Clear pending order and cart
            sessionStorage.removeItem('lapak3d_pending_order');
            window.saveCart([]);
            window.updateCartBadge();
            
            window.showToast("Pembayaran berhasil dikonfirmasi! Terima kasih 🎉");
            
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        }, 1500); // simulate network delay
    });
});
