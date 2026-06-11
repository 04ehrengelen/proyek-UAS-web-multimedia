// main.js - Global utilities and state management for Lapak 3D

// ===================== SESSION MANAGEMENT =====================
// Sistem Heartbeat: membedakan "navigasi halaman" vs "browser benar-benar ditutup".
// - sessionStorage per-tab: hanya bersih saat tab ditutup (BUKAN saat navigasi).
// - localStorage heartbeat: diperbarui setiap 30 detik.
// - Jika heartbeat sudah lebih dari 90 detik lalu = tidak ada tab yang aktif → sesi baru → reset bid.
function initLapakSession() {
    const HEARTBEAT_STALE_MS = 90 * 1000; // 90 detik tanpa heartbeat = sesi berakhir

    // Cek apakah tab ini sudah aktif (misal: user navigasi dalam tab yang sama)
    const tabAlreadyActive = sessionStorage.getItem('lapak3d_tab_active');

    if (tabAlreadyActive) {
        // Hanya refresh heartbeat, JANGAN reset bid
        localStorage.setItem('lapak3d_heartbeat', Date.now().toString());
        return;
    }

    // Tab baru atau browser baru dibuka
    const lastHeartbeat = parseInt(localStorage.getItem('lapak3d_heartbeat') || '0');
    const now = Date.now();

    if (now - lastHeartbeat > HEARTBEAT_STALE_MS) {
        // Heartbeat kedaluwarsa → tidak ada tab yang terbuka sebelumnya → mulai sesi baru
        localStorage.removeItem('lapak3d_bids');
        localStorage.removeItem('lapak3d_global_auction_time');
        console.log('[Lapak3D] Sesi baru dimulai. Semua bid di-reset.');
    } else {
        // Heartbeat masih baru → ada tab lain yang aktif → bergabung ke sesi yang ada
        console.log('[Lapak3D] Bergabung ke sesi yang ada (heartbeat masih segar).');
    }

    // Tandai tab ini sebagai aktif di sessionStorage
    sessionStorage.setItem('lapak3d_tab_active', 'true');
    localStorage.setItem('lapak3d_heartbeat', now.toString());

    // Perbarui heartbeat setiap 30 detik selama tab terbuka
    setInterval(function () {
        localStorage.setItem('lapak3d_heartbeat', Date.now().toString());
    }, 30000);
}

// ===================== UPLOAD STORAGE (LIVE SERVER FRIENDLY) =====================
const LAPAK3D_DB_NAME = 'lapak3d_upload_db';
const LAPAK3D_DB_VERSION = 1;
const LAPAK3D_UPLOAD_STORE = 'uploadedFiles';

function openUploadDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(LAPAK3D_DB_NAME, LAPAK3D_DB_VERSION);

        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(LAPAK3D_UPLOAD_STORE)) {
                db.createObjectStore(LAPAK3D_UPLOAD_STORE);
            }
        };

        request.onsuccess = function() {
            resolve(request.result);
        };

        request.onerror = function() {
            reject(request.error);
        };
    });
}

async function saveUploadBlob(key, file) {
    const db = await openUploadDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(LAPAK3D_UPLOAD_STORE, 'readwrite');
        tx.objectStore(LAPAK3D_UPLOAD_STORE).put(file, key);
        tx.oncomplete = resolve;
        tx.onerror = function() {
            reject(tx.error);
        };
    });
}

async function getUploadBlobUrl(key) {
    if (!key) return null;

    try {
        const db = await openUploadDB();
        const file = await new Promise((resolve, reject) => {
            const tx = db.transaction(LAPAK3D_UPLOAD_STORE, 'readonly');
            const request = tx.objectStore(LAPAK3D_UPLOAD_STORE).get(key);
            request.onsuccess = function() {
                resolve(request.result || null);
            };
            request.onerror = function() {
                reject(request.error);
            };
        });

        return file ? URL.createObjectURL(file) : null;
    } catch (err) {
        console.error('[Lapak3D] Gagal membaca file upload dari IndexedDB:', err);
        return null;
    }
}

async function deleteUploadBlob(key) {
    if (!key) return;

    try {
        const db = await openUploadDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(LAPAK3D_UPLOAD_STORE, 'readwrite');
            tx.objectStore(LAPAK3D_UPLOAD_STORE).delete(key);
            tx.oncomplete = resolve;
            tx.onerror = function() {
                reject(tx.error);
            };
        });
    } catch (err) {
        console.error('[Lapak3D] Gagal menghapus file upload dari IndexedDB:', err);
    }
}

async function clearUploadDB() {
    try {
        const db = await openUploadDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(LAPAK3D_UPLOAD_STORE, 'readwrite');
            const store = tx.objectStore(LAPAK3D_UPLOAD_STORE);
            const request = store.clear();
            request.onsuccess = resolve;
            request.onerror = function() {
                reject(request.error);
            };
        });
    } catch (err) {
        console.error('[Lapak3D] Gagal membersihkan IndexedDB upload:', err);
    }
}

async function clearClientStateForServerReset(resetId) {
    sessionStorage.clear();

    const keysToClear = [
        'lapak3d_user',
        'lapak3d_user_db',
        'lapak3d_cart',
        'lapak3d_orders',
        'lapak3d_global_sales',
        'lapak3d_bids',
        'lapak3d_products',
        'lapak3d_pending_order',
        'lapak3d_global_auction_time',
        'lapak3d_heartbeat'
    ];

    keysToClear.forEach(key => localStorage.removeItem(key));
    if (resetId) {
        localStorage.setItem('lapak3d_last_reset_id', resetId);
    }

    await clearUploadDB();
}

async function checkServerReset() {
    try {
        const response = await fetch('reset.json', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        const currentResetId = data.resetId;
        const previousResetId = localStorage.getItem('lapak3d_last_reset_id');

        if (previousResetId !== currentResetId) {
            console.info('[Lapak3D] Detected new server reset state. Clearing browser storage.');
            await clearClientStateForServerReset(currentResetId);
        }
    } catch (err) {
        console.warn('[Lapak3D] Gagal memeriksa reset server:', err);
    }
}

async function resolveUploadedProductFiles(product) {
    const resolved = { ...product };

    // Kompatibilitas dengan data upload simulasi versi lama yang memakai modelUrl.
    if (!resolved.model && resolved.modelUrl) {
        resolved.model = resolved.modelUrl;
    }

    if (resolved.modelKey) {
        const modelUrl = await getUploadBlobUrl(resolved.modelKey);
        if (modelUrl) resolved.model = modelUrl;
    }

    if (resolved.thumbnailKey) {
        const thumbnailUrl = await getUploadBlobUrl(resolved.thumbnailKey);
        if (thumbnailUrl) resolved.thumbnail = thumbnailUrl;
    }

    return resolved;
}

async function resolveUploadedProducts(products) {
    return Promise.all(products.map(resolveUploadedProductFiles));
}

async function saveUploadedAsset(productData, modelFile, thumbnailFile) {
    const id = Date.now();
    const safeName = (productData.name || 'asset').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'asset';
    const modelKey = `uploads/models/${id}-${safeName}-${modelFile.name}`;
    const thumbnailKey = `uploads/thumbnails/${id}-${safeName}-${thumbnailFile.name}`;

    await Promise.all([
        saveUploadBlob(modelKey, modelFile),
        saveUploadBlob(thumbnailKey, thumbnailFile)
    ]);

    const product = {
        id,
        ...productData,
        model: modelKey,
        thumbnail: thumbnailKey,
        modelKey,
        thumbnailKey,
        uploadedAt: new Date().toISOString(),
        storageMode: 'browser-indexeddb'
    };

    const localProducts = JSON.parse(localStorage.getItem('lapak3d_products')) || [];
    localProducts.push(product);
    localStorage.setItem('lapak3d_products', JSON.stringify(localProducts));

    return resolveUploadedProductFiles(product);
}

async function deleteLocalUploadedProduct(productId) {
    const id = parseInt(productId);
    let localProducts = JSON.parse(localStorage.getItem('lapak3d_products')) || [];
    const product = localProducts.find(p => p.id === id);

    if (product) {
        await Promise.all([
            deleteUploadBlob(product.modelKey),
            deleteUploadBlob(product.thumbnailKey)
        ]);
    }

    localProducts = localProducts.filter(p => p.id !== id);
    localStorage.setItem('lapak3d_products', JSON.stringify(localProducts));
}

// 1. loadProductsFromJSON(callback)
function loadProductsFromJSON(callback) {
    $.getJSON('js/products.json', async function(jsonProducts) {
        let localProductsStr = localStorage.getItem("lapak3d_products");
        let localProducts = localProductsStr ? JSON.parse(localProductsStr) : [];

        // Setel waktu lelang dinamis di localStorage (dibagi semua tab)
        // Jika sudah ada (dari tab sebelumnya), gunakan yang ada
        let globalAuctionEndTime = localStorage.getItem('lapak3d_global_auction_time');
        if (!globalAuctionEndTime) {
            const endDate = new Date(Date.now() + 30 * 60000);
            globalAuctionEndTime = endDate.toISOString();
            localStorage.setItem('lapak3d_global_auction_time', globalAuctionEndTime);
        }

        // Gabungkan data (prioritaskan localProducts jika ada id yang sama)
        let combinedMap = new Map();
        
        jsonProducts.forEach(p => {
            // Ubah waktu lelang default JSON dengan waktu dinamis yang baru
            if (p.type === 'auction') {
                p.auctionEndTime = globalAuctionEndTime;
            }
            combinedMap.set(p.id, p);
        });
        
        localProducts.forEach(p => combinedMap.set(p.id, p));
        
        let combined = await resolveUploadedProducts(Array.from(combinedMap.values()));
        
        if (typeof callback === 'function') {
            callback(combined);
        }
    }).fail(async function() {
        console.error("Gagal memuat products.json");
        let localProductsStr = localStorage.getItem("lapak3d_products");
        let localProducts = localProductsStr ? JSON.parse(localProductsStr) : [];
        localProducts = await resolveUploadedProducts(localProducts);
        if (typeof callback === 'function') {
            callback(localProducts);
        }
    });
}

// 2. getProductById(products, id)
function getProductById(products, id) {
    let parsedId = parseInt(id);
    return products.find(p => p.id === parsedId) || null;
}

// 3. getCart()
function getCart() {
    return JSON.parse(localStorage.getItem("lapak3d_cart")) || [];
}

// 4. saveCart(cart)
function saveCart(cart) {
    localStorage.setItem("lapak3d_cart", JSON.stringify(cart));
}

// 5. addToCart(product, price)
function addToCart(product, price = product.price) {
    let cart = getCart();
    let existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: price,
            thumbnail: product.thumbnail,
            quantity: 1
        });
    }
    
    saveCart(cart);
    updateCartBadge();
    showToast("Berhasil ditambahkan ke keranjang!");
}

// 6. removeFromCart(id)
function removeFromCart(id) {
    let cart = getCart();
    cart = cart.filter(item => item.id !== parseInt(id));
    saveCart(cart);
    updateCartBadge();
}

// 7. updateCartQuantity(id, newQty)
function updateCartQuantity(id, newQty) {
    if (newQty <= 0) {
        removeFromCart(id);
        return;
    }
    let cart = getCart();
    let item = cart.find(item => item.id === parseInt(id));
    if (item) {
        item.quantity = parseInt(newQty);
        saveCart(cart);
        updateCartBadge();
    }
}

// 8. getCartTotal()
function getCartTotal() {
    let cart = getCart();
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

// 9. updateCartBadge()
function updateCartBadge() {
    let cart = getCart();
    let totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    let $badge = $('#cart-badge');
    if ($badge.length) {
        if (totalQty > 0) {
            $badge.text(totalQty).show();
        } else {
            $badge.hide();
        }
    }
}

// 10. getUserDB()
function getUserDB() {
    return JSON.parse(localStorage.getItem("lapak3d_user_db")) || {};
}

// 11. getUserFromDB(username)
function getUserFromDB(username) {
    if (!username) return null;
    const db = getUserDB();
    return db[username] || null;
}

// 12. saveUserToDB(user)
function saveUserToDB(user) {
    if (!user || !user.username) return;
    const db = getUserDB();
    db[user.username] = { ...db[user.username], ...user };
    localStorage.setItem("lapak3d_user_db", JSON.stringify(db));
}

// 13. getUser()
function getUser() {
    return JSON.parse(localStorage.getItem("lapak3d_user")) || null;
}

// 14. saveUser(user)
function saveUser(user) {
    if (!user) return;
    const existing = getUserFromDB(user.username) || {};
    const merged = { ...existing, ...user, isLoggedIn: true };
    localStorage.setItem("lapak3d_user", JSON.stringify(merged));
    saveUserToDB(merged);
}

// 15. checkLoginStatus()
function checkLoginStatus() {
    let user = getUser();
    return user !== null && user.isLoggedIn === true;
}

// 13. loginSimulation()
function loginSimulation() {
    // Simpan halaman saat ini untuk diarahkan kembali setelah login
    localStorage.setItem('lapak3d_redirect_after_login', window.location.href);
    window.location.href = "login.html";
    return false;
}

// 14. logoutSimulation()
function logoutSimulation() {
    localStorage.removeItem("lapak3d_user");
    updateNavbar();
    showToast("Berhasil logout!");
    setTimeout(() => {
        window.location.href = "index.html";
    }, 1000);
}

// 15. updateNavbar()
function updateNavbar() {
    let isLoggedIn = checkLoginStatus();
    let user = getUser();
    
    if (isLoggedIn) {
        $('#nav-login-btn').hide();
        $('#nav-user-dropdown').show();
        $('#nav-user-name').text(user.username);
    } else {
        $('#nav-login-btn').show();
        $('#nav-user-dropdown').hide();
    }
    
    updateCartBadge();
}

// 16. showToast(message, isError = false)
function showToast(message, isError = false) {
    if ($('.toast-container').length === 0) {
        $('body').append('<div class="toast-container"></div>');
    }
    
    const toastClass = isError ? 'toast-error' : 'toast-success';
    const iconClass = isError ? 'fa-circle-xmark' : 'fa-circle-check';
    const title = isError ? 'Error' : 'Berhasil';
    
    const toastHtml = `
        <div class="toast-custom ${toastClass}">
            <div class="toast-icon">
                <i class="fa-solid ${iconClass}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
        </div>
    `;
    
    const $toast = $(toastHtml);
    $('.toast-container').append($toast);
    
    // Auto-hilang setelah 3 detik
    setTimeout(() => {
        $toast.fadeOut(400, function() {
            $(this).remove();
        });
    }, 3000);
}

// 17. formatRupiah(number)
function formatRupiah(number) {
    if (!number || number === 0) return "Gratis";
    return "Rp " + parseInt(number).toLocaleString("id-ID");
}

// 18. getTimeRemaining(endTimeStr)
function getTimeRemaining(endTimeStr) {
    const total = Date.parse(endTimeStr) - Date.parse(new Date());
    
    if (!endTimeStr || isNaN(total) || total <= 0) {
        return {
            days: 0, hours: 0, minutes: 0, seconds: 0, expired: true
        };
    }
    
    const seconds = Math.floor((total / 1000) % 60);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const days = Math.floor(total / (1000 * 60 * 60 * 24));
    
    return {
        days, hours, minutes, seconds, expired: false
    };
}

// 19. getBids() - Disimpan di localStorage agar bisa di-sync antar tab
function getBids() {
    return JSON.parse(localStorage.getItem("lapak3d_bids")) || {};
}

// 20. saveBids(bids)
function saveBids(bids) {
    localStorage.setItem("lapak3d_bids", JSON.stringify(bids));
}

window.saveUploadedAsset = saveUploadedAsset;
window.deleteLocalUploadedProduct = deleteLocalUploadedProduct;

// Document Ready
$(document).ready(function() {
    checkServerReset().finally(function() {
        initLapakSession(); // Mulai session tracking
        updateNavbar();
    });
});
