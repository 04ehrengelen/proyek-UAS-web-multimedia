// js/detail.js - Logic for Product Detail and Three.js Viewer
// Menggunakan ES Module untuk Three.js
// jQuery diakses via window.$ (sudah diload sebagai global script sebelum module ini)

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let currentProduct = null;
let allProductsData = [];

// Alias jQuery global karena ini ES module (tidak bisa akses $ langsung)
const $ = window.$;

// ===================== THREE.JS =====================

function initThreeJS(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xE8EAED);

    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(0, 1, 5);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Resize observer
    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
                camera.aspect = entry.contentRect.width / entry.contentRect.height;
                camera.updateProjectionMatrix();
                renderer.setSize(entry.contentRect.width, entry.contentRect.height);
            }
        }
    });
    resizeObserver.observe(container);

    // ---- PENCAHAYAAN (seimbang, tidak over-expose) ----

    // Ambient: cahaya dasar lembut
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    // Key light: cahaya utama dari atas-depan-kiri (penghasil bayangan)
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(4, 12, 6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 0.1;
    keyLight.shadow.camera.far = 80;
    keyLight.shadow.camera.left = -20;
    keyLight.shadow.camera.right = 20;
    keyLight.shadow.camera.top = 20;
    keyLight.shadow.camera.bottom = -20;
    keyLight.shadow.bias = -0.002;
    keyLight.shadow.radius = 4; // Bayangan lembut
    scene.add(keyLight);

    // Fill light: cahaya pengisi dari kanan (tanpa bayangan, lebih lembut)
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
    fillLight.position.set(-6, 4, 4);
    scene.add(fillLight);

    // Back/rim light: cahaya dari belakang untuk siluet
    const rimLight = new THREE.DirectionalLight(0xC4B5FD, 0.5);
    rimLight.position.set(-3, 6, -8);
    scene.add(rimLight);

    // Hemisphere: transisi langit ke tanah
    const hemiLight = new THREE.HemisphereLight(0xF0F0F0, 0xB0B0B0, 0.7);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    // ---- ORBIT CONTROLS ----
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.enablePan = true;
    controls.panSpeed = 0.8;
    controls.screenSpacePanning = true;
    controls.mouseButtons = {
        LEFT:   THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT:  THREE.MOUSE.PAN
    };
    controls.minDistance = 0.5;
    controls.maxDistance = 50;

    // Animation Loop
    (function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    })();

    // Mencegah scroll halaman saat klik tengah (panning)
    container.addEventListener('mousedown', function (e) {
        if (e.button === 1) { // Tombol tengah
            e.preventDefault();
            return false;
        }
    });
}

function loadModel(path) {
    const loader = new GLTFLoader();
    $('#loading-overlay').show();
    $('#error-overlay').hide();

    loader.load(
        path,
        function (gltf) {
            $('#loading-overlay').hide();
            const model = gltf.scene;

            // Aktifkan shadow casting pada semua mesh di model
            model.traverse(function (child) {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            // Normalisasi ukuran model
            const box0 = new THREE.Box3().setFromObject(model);
            const size0 = box0.getSize(new THREE.Vector3());
            const targetSize = 13;
            const maxDim = Math.max(size0.x, size0.y, size0.z);
            if (maxDim > 0) {
                model.scale.multiplyScalar(targetSize / maxDim);
            }

            // Pusatkan model secara horizontal, tapi taruh di atas lantai
            const box1 = new THREE.Box3().setFromObject(model);
            const center = box1.getCenter(new THREE.Vector3());
            const bottomY = box1.min.y;
            model.position.x -= center.x;
            model.position.z -= center.z;
            model.position.y -= bottomY; // Kaki model pas di Y=0

            scene.add(model);

            // ---- LANTAI BAYANGAN ----
            // Plane transparan di Y=0 yang hanya menerima bayangan
            const shadowPlaneGeo = new THREE.PlaneGeometry(60, 60);
            const shadowPlaneMat = new THREE.ShadowMaterial({
                opacity: 0.25 // Transparansi bayangan (lembut)
            });
            const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
            shadowPlane.rotation.x = -Math.PI / 2; // Horizontal
            shadowPlane.position.y = 0;
            shadowPlane.receiveShadow = true;
            scene.add(shadowPlane);

            // Posisi kamera otomatis
            const fov = camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(targetSize / 2 / Math.tan(fov / 2)) * 2.2;
            camera.position.set(cameraZ * 0.5, cameraZ * 0.35, cameraZ);
            camera.lookAt(0, targetSize * 0.25, 0);
            controls.target.set(0, targetSize * 0.25, 0); // Fokus sedikit di atas lantai
            controls.update();
        },
        function (xhr) {
            if (xhr.lengthComputable && xhr.total > 0) {
                const pct = Math.round((xhr.loaded / xhr.total) * 100);
                $('#loading-text').text(`Memuat model 3D (${pct}%)...`);
            } else if (xhr.loaded > 0) {
                const mb = (xhr.loaded / 1048576).toFixed(2);
                $('#loading-text').text(`Memuat model 3D (${mb} MB)...`);
            }
        },
        function (error) {
            console.error('Error memuat GLTF:', error);
            $('#loading-overlay').hide();
            $('#error-overlay').show();
        }
    );
}

// ===================== PRODUCT INFO =====================

function displayProductInfo(product) {
    currentProduct = product;

    $('#breadcrumb-category').text(product.category);
    $('#breadcrumb-name').text(product.name);
    $('#product-name').text(product.name);
    $('#product-creator').html(`<i class="fa-solid fa-user-circle me-1 text-primary-custom"></i> ${product.creator}`);
    $('#product-rating').text(product.rating);
    $('#product-reviews').text(`(${product.reviews} ulasan)`);
    $('#product-polycount').text(product.polycount);

    const formatsArray = product.format || product.formats || [];
    $('#product-format').text(formatsArray.join(', '));
    $('#product-description').text(product.description);

    const tagsArray = Array.isArray(product.tags) ? product.tags : [];
    $('#product-tags').html(tagsArray.map(t =>
        `<span class="badge bg-secondary me-2 bg-opacity-25 text-light border border-secondary px-3 py-2 rounded-pill">
            <i class="fa-solid fa-tag me-1 text-muted" style="font-size:0.7rem;"></i>${t}
        </span>`
    ).join(''));

    let badgeClass = '', badgeText = '';

    // Sembunyikan semua section action dulu
    $('#action-free, #action-paid, #action-auction, #action-auction-ended').hide();

    if (product.type === 'free') {
        badgeClass = 'badge-free'; badgeText = 'FREE';
        $('#action-free').show();
        $('#btn-claim-free').off('click').on('click', function () {
            window.addToCart(product, 0);
        });

    } else if (product.type === 'paid') {
        badgeClass = 'badge-paid'; badgeText = 'PREMIUM';
        $('#action-paid').show();
        $('#price-paid-text').text(window.formatRupiah(product.price));
        $('#btn-add-cart').off('click').on('click', function () {
            window.addToCart(product, product.price);
        });

    } else if (product.type === 'auction') {
        badgeClass = 'badge-auction'; badgeText = 'LELANG';
        $('#action-auction').show();

        const user = window.getUser();
        if (user && user.username === product.creator) {
            $('#auction-form-container').hide();
            if ($('#creator-bid-warning').length === 0) {
                $('#action-auction').append('<div id="creator-bid-warning" class="mt-3 text-center text-warning fs-7"><i class="fa-solid fa-circle-exclamation me-1"></i> Anda tidak dapat melakukan bid pada aset buatan Anda sendiri.</div>');
            }
        } else {
            $('#auction-form-container').show();
            $('#creator-bid-warning').remove();
        }

        // Selalu baca dari localStorage agar data terkini (tidak hilang saat navigasi)
        const bidsData = window.getBids();
        const currentBidData = bidsData[product.id] || { currentBid: product.currentBid, history: [] };

        // Pastikan data awal tersimpan ke localStorage jika belum ada
        if (!bidsData[product.id]) {
            bidsData[product.id] = currentBidData;
            window.saveBids(bidsData);
        }

        $('#price-auction-text').text(window.formatRupiah(currentBidData.currentBid));
        renderBidHistory(currentBidData.history);
        startCountdown(product.auctionEndTime, currentBidData);

        // submitBid selalu membaca ulang dari localStorage saat dieksekusi
        $('#btn-submit-bid').off('click').on('click', function () {
            const freshBids = window.getBids();
            const freshBidData = freshBids[product.id] || { currentBid: product.currentBid, history: [] };
            submitBid(product, freshBidData);
        });
    }

    $('#product-type-badge').addClass(`px-3 py-1 fs-6 ${badgeClass}`).text(badgeText);
}

function renderBidHistory(history) {
    const $ul = $('#bid-history');
    $ul.empty();
    if (!history || history.length === 0) {
        $ul.append('<li class="text-muted fst-italic py-2"><i class="fa-solid fa-comment-slash me-2"></i> Belum ada penawaran. Jadilah yang pertama!</li>');
    } else {
        history.slice(-3).reverse().forEach(bid => {
            $ul.append(`
                <li class="d-flex justify-content-between align-items-center bg-dark bg-opacity-50 p-2 rounded">
                    <span><i class="fa-solid fa-user-ninja text-muted me-2"></i> ${bid.user}</span>
                    <span class="fw-bold text-warning">${window.formatRupiah(bid.amount)}</span>
                </li>`);
        });
    }
}

// ===================== AUCTION =====================

function startCountdown(endTimeStr, bidDataRef) {
    let intervalId = null;

    const updateTime = () => {
        const time = window.getTimeRemaining(endTimeStr);
        const $el = $('#auction-countdown');

        if (time.expired) {
            clearInterval(intervalId);
            $el.html('<i class="fa-solid fa-circle-exclamation me-2"></i> Lelang Berakhir')
               .removeClass('text-warning').addClass('text-danger border-danger');
            $('#auction-form-container').hide();

            const user = window.getUser();
            const bidsData = window.getBids();
            const currentBidData = bidsData[currentProduct.id] || { currentBid: currentProduct.currentBid, history: [] };
            const history = currentBidData.history;

            let isWinner = false;
            if (history.length > 0 && user) {
                if (user.username === history[history.length - 1].user) {
                    isWinner = true;
                }
            }

            if (isWinner) {
                $('#auction-winner-container').show();
                $('#btn-claim-auction').off('click').on('click', function () {
                    claimAuctionWinner(currentProduct);
                });
            } else {
                $('#auction-winner-container').hide();
                $('#action-auction').hide();
                const finalPrice = currentBidData.currentBid || currentProduct.startingBid || 0;
                $('#action-auction-ended').show();
                $('#price-auction-ended-text').text(window.formatRupiah(finalPrice));
                $('#product-type-badge').removeClass('badge-auction').addClass('bg-secondary text-white').text('LELANG BERAKHIR');
            }
        } else {
            const h = String(time.hours + time.days * 24).padStart(2, '0');
            const m = String(time.minutes).padStart(2, '0');
            const s = String(time.seconds).padStart(2, '0');
            $el.text(`${h}:${m}:${s}`);
        }
    };

    updateTime();
    intervalId = setInterval(updateTime, 1000);
}


function submitBid(product, currentBidData) {
    if (!window.checkLoginStatus()) {
        window.showToast('Silakan login terlebih dahulu untuk mengikuti lelang!', true);
        window.loginSimulation();
        return;
    }

    const user = window.getUser();
    if (user && user.username === product.creator) {
        window.showToast('Anda tidak dapat melakukan bid pada aset buatan Anda sendiri.', true);
        return;
    }

    // Selalu baca data bid TERBARU dari localStorage sebelum memproses
    const latestBids = window.getBids();
    const latestBidData = latestBids[product.id] || currentBidData;

    const amount = parseInt($('#bid-input').val());
    const minBid = latestBidData.currentBid + 1000;

    if (isNaN(amount) || amount < minBid) {
        window.showToast(`Nominal tidak valid! Minimal tawaran: ${window.formatRupiah(minBid)}`, true);
        return;
    }

    latestBidData.currentBid = amount;
    latestBidData.history.push({ user: user.username, amount, time: new Date().toISOString() });

    // Simpan ke localStorage (akan memicu storage event di tab lain)
    latestBids[product.id] = latestBidData;
    window.saveBids(latestBids);

    $('#price-auction-text').text(window.formatRupiah(amount));
    renderBidHistory(latestBidData.history);
    $('#bid-input').val('');
    window.showToast(`Berhasil! Tawaran ${window.formatRupiah(amount)} telah dipasang.`);
}


function claimAuctionWinner(product) {
    const claimKey = 'lapak3d_claimed_' + product.id;
    if (sessionStorage.getItem(claimKey)) {
        window.showToast('Aset ini sudah diklaim sebelumnya!', true);
        return;
    }

    if (typeof confetti === 'function') {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#8b5cf6', '#10b981', '#f59e0b', '#ffffff'] });
    }

    const bidsData = window.getBids();
    const currentBidData = bidsData[product.id];
    const winningAmount = currentBidData ? currentBidData.currentBid : product.currentBid;

    window.addToCart(product, winningAmount);
    sessionStorage.setItem(claimKey, 'true');
    window.showToast('Selamat! Aset berhasil diklaim ke keranjang!');
    $('#btn-claim-auction').prop('disabled', true).removeClass('btn-success').addClass('btn-secondary').html('<i class="fa-solid fa-check me-2"></i> Sudah Diklaim');
}

// ===================== RECOMMENDATIONS =====================

function loadRecommendations(currentId, category, allProducts) {
    const $grid = $('#recommendations');
    if (!$grid.length) return;

    let filtered = allProducts.filter(p => p.id !== parseInt(currentId));
    let sameCat = filtered.filter(p => p.category === category).sort(() => 0.5 - Math.random());
    let recs = sameCat.slice(0, 4);

    if (recs.length < 4) {
        const others = filtered.filter(p => !recs.some(r => r.id === p.id)).sort(() => 0.5 - Math.random());
        recs = recs.concat(others.slice(0, 4 - recs.length));
    }

    $grid.empty();

    recs.forEach(p => {
        let badgeClass = '', badgeText = '';
        if (p.type === 'free') { badgeClass = 'badge-free'; badgeText = 'FREE'; }
        else if (p.type === 'paid') { badgeClass = 'badge-paid'; badgeText = 'PREMIUM'; }
        else { badgeClass = 'badge-auction'; badgeText = 'LELANG'; }

        const bData = window.getBids()[p.id];
        const displayPrice = p.type === 'auction' ? (bData ? bData.currentBid : p.currentBid) : p.price;
        const priceHtml = p.type === 'free'
            ? '<span class="text-success fw-bold fs-7">Gratis</span>'
            : `<span class="${p.type === 'auction' ? 'text-warning' : 'text-primary-light'} fw-bold fs-7">${window.formatRupiah(displayPrice)}</span>`;

        $grid.append(`
            <div class="product-card" onclick="window.location.href='detail.html?id=${p.id}'" style="cursor:pointer;">
                <div class="product-thumbnail-wrapper">
                    <span class="product-type-badge ${badgeClass}">${badgeText}</span>
                    <img src="${p.thumbnail || 'assets/thumbnails/placeholder.jpg'}" onerror="this.src='assets/thumbnails/placeholder.jpg'" alt="${p.name}" class="product-thumbnail">
                </div>
                <div class="product-card-body p-3">
                    <h5 class="product-title text-truncate fs-6 m-0">${p.name}</h5>
                    <div class="product-creator mt-1 mb-2 fs-7"><i class="fa-solid fa-user-circle me-1 text-primary-custom"></i>${p.creator}</div>
                    <div class="d-flex justify-content-between align-items-center mt-auto border-top border-secondary pt-2" style="border-color:rgba(51,65,85,0.5)!important;">
                        <span class="fw-bold text-white fs-7"><i class="fa-solid fa-star text-warning"></i> ${p.rating}</span>
                        ${priceHtml}
                    </div>
                </div>
            </div>
        `);
    });
}

// ===================== INIT =====================
// Gunakan DOMContentLoaded (bukan $(document).ready) karena ini ES Module.
// setTimeout 100ms memastikan jQuery & main.js sudah siap digunakan.
document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
        const idParam = new URLSearchParams(window.location.search).get('id');

        if (!idParam) {
            window.location.href = 'index.html';
            return;
        }

        window.loadProductsFromJSON(function (products) {
            allProductsData = products;
            const product = window.getProductById(products, idParam);

            if (product) {
                displayProductInfo(product);
                initThreeJS('three-canvas-container');
                loadModel(product.model);
                loadRecommendations(product.id, product.category, products);

                // ===================== REAL-TIME CROSS-TAB SYNC =====================
                // Dengarkan perubahan localStorage dari tab lain
                window.addEventListener('storage', function (e) {
                    if (e.key === 'lapak3d_bids' && currentProduct) {
                        const newBidsData = JSON.parse(e.newValue || '{}');
                        const newBidData = newBidsData[currentProduct.id];

                        if (newBidData) {
                            // Update harga bid tertinggi
                            $('#price-auction-text').text(window.formatRupiah(newBidData.currentBid));
                            // Update riwayat bid
                            renderBidHistory(newBidData.history);
                            // Tandai dengan animasi kilat agar user tahu ada update
                            $('#price-auction-text').addClass('text-flash');
                            setTimeout(() => $('#price-auction-text').removeClass('text-flash'), 1500);
                        }
                    }
                });
                // ===================== END SYNC =====================

            } else {
                document.body.innerHTML = `
                    <div class="container mt-5 pt-5 text-center">
                        <i class="fa-solid fa-triangle-exclamation text-warning mb-4" style="font-size:5rem;"></i>
                        <h1 class="fw-bold">Aset tidak ditemukan</h1>
                        <p class="text-muted mb-4">Aset 3D yang Anda cari mungkin sudah dihapus atau URL tidak valid.</p>
                        <a href="index.html" class="btn btn-primary-custom px-4 py-2 rounded-pill fw-bold">
                            <i class="fa-solid fa-arrow-left me-2"></i> Kembali ke Beranda
                        </a>
                    </div>
                `;
            }
        });
    }, 100);
});

