/**
 * PASSPORT PHOTO STUDIO (SECURE + HIGH RES)
 * Features: Password Lock, High Res, Batch ZIP, Original Names
 */

const APP_PASSWORD = "5544332211"; // YOUR PASSWORD
const DB_NAME = 'PassportZipDB_Secure';
const db = new Dexie(DB_NAME);
db.version(1).stores({ cards: '++id, blob, name, cropData' });

const state = { cards: [], activeIndex: -1, cropper: null };

// Standard Passport Ratio (35mm x 45mm)
const PASSPORT_ASPECT_RATIO = 3.5 / 4.5; 

// UI Elements
const els = {
    // Login Elements
    loginOverlay: document.getElementById('loginOverlay'),
    passwordInput: document.getElementById('passwordInput'),
    btnLogin: document.getElementById('btnLogin'),
    loginError: document.getElementById('loginError'),
    appContent: document.getElementById('appContent'),
    btnLogout: document.getElementById('btnLogout'),

    // App Elements
    fileInput: document.getElementById('fileInput'),
    thumbStrip: document.getElementById('thumbnailStrip'),
    editorImage: document.getElementById('editorImage'),
    cropperWrapper: document.getElementById('cropperWrapper'),
    emptyState: document.getElementById('emptyState'),
    previewCard: document.getElementById('previewCard'),
    zoomRange: document.getElementById('zoomRange'),
    toast: document.getElementById('toast'),
    toastMsg: document.getElementById('toastMsg'),
    
    btnPrev: document.getElementById('btnPrev'),
    btnNext: document.getElementById('btnNext'),
    imageCounter: document.getElementById('imageCounter'),
    btnRotate: document.getElementById('btnRotate'),
    btnReset: document.getElementById('btnReset'),
    btnDownloadZip: document.getElementById('btnDownloadZip')
};

// --- SECURITY LOGIC ---
function checkAuth() {
    const isAuth = localStorage.getItem('isSabbirLoggedIn');
    if (isAuth === 'true') {
        unlockApp();
    }
}

function unlockApp() {
    els.loginOverlay.classList.add('hidden'); // Hide Lock Screen
    els.appContent.classList.remove('opacity-0'); // Show App
    initApp(); // Load DB and listeners
}

function handleLogin() {
    const input = els.passwordInput.value;
    if (input === APP_PASSWORD) {
        localStorage.setItem('isSabbirLoggedIn', 'true');
        unlockApp();
    } else {
        els.loginError.classList.remove('hidden');
        els.passwordInput.value = '';
        els.passwordInput.focus();
    }
}

function handleLogout() {
    localStorage.removeItem('isSabbirLoggedIn');
    location.reload(); // Reload to show lock screen
}

// --- APP LOGIC ---
async function initApp() {
    await loadFromDB();
    // Re-bind listeners here just in case, though usually fine on load
}

window.addEventListener('DOMContentLoaded', () => {
    checkAuth(); // Check security first
    
    // Login Listeners
    els.btnLogin.addEventListener('click', handleLogin);
    els.passwordInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') handleLogin();
    });
    
    setupEventListeners();
});

async function loadFromDB() {
    state.cards = await db.cards.toArray();
    renderThumbnails();
    if (state.cards.length > 0) selectCard(state.cards.length - 1);
    else resetEditor();
    updatePaginationUI();
}

async function handleUpload(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    showToast(`Loading ${files.length} images...`);

    for (const file of files) {
        const blob = await fileToDataURL(file);
        const fileName = file.name; 
        
        const id = await db.cards.add({ blob: blob, name: fileName, cropData: null });
        state.cards.push({ id, blob, name: fileName, cropData: null });
    }
    
    renderThumbnails();
    selectCard(state.cards.length - 1);
    updatePaginationUI();
    showToast("Upload Successful!");
}

function fileToDataURL(file) {
    return new Promise(r => { const rd = new FileReader(); rd.onload = e => r(e.target.result); rd.readAsDataURL(file); });
}

function renderThumbnails() {
    els.thumbStrip.innerHTML = '';
    state.cards.forEach((card, index) => {
        const div = document.createElement('div');
        div.className = `thumb-item ${index === state.activeIndex ? 'active' : ''}`;
        
        const displayName = card.name.length > 10 ? card.name.substring(0, 8) + '...' : card.name;
        
        div.innerHTML = `
            <img src="${card.blob}" onclick="selectCard(${index})" title="${card.name}">
            <div class="thumb-badge" style="top:auto; bottom:2px; right:2px;">${index + 1}</div>
            <div class="absolute top-0 left-0 w-full bg-black/50 text-[8px] text-white text-center p-0.5 truncate pointer-events-none">${displayName}</div>
            <div class="thumb-delete" onclick="deleteCard(event, ${index})"><i class="fa-solid fa-xmark"></i></div>
        `;
        els.thumbStrip.appendChild(div);
    });
}

async function deleteCard(e, index) {
    e.stopPropagation();
    if(!confirm("Delete this image?")) return;
    const cardId = state.cards[index].id;
    await db.cards.delete(cardId);
    state.cards.splice(index, 1);
    
    if (state.cards.length === 0) {
        state.activeIndex = -1;
        resetEditor();
    } else if (index === state.activeIndex) {
        const newIndex = index > 0 ? index - 1 : 0;
        selectCard(newIndex);
    } else if (index < state.activeIndex) {
        state.activeIndex--;
        renderThumbnails();
        updatePaginationUI();
    } else {
        renderThumbnails();
    }
    showToast("Deleted");
}

function resetEditor() {
    if (state.cropper) state.cropper.destroy();
    els.emptyState.classList.remove('hidden');
    els.cropperWrapper.classList.add('hidden');
    els.imageCounter.innerText = "0 / 0";
    els.previewCard.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-gray-400 gap-2"><i class="fa-solid fa-user text-2xl"></i><span class="text-[10px] font-bold">PREVIEW</span></div>`;
    renderThumbnails();
}

function selectCard(index) {
    if (index < 0 || index >= state.cards.length) return;

    if (state.cropper) state.cropper.destroy();
    state.activeIndex = index;
    renderThumbnails();
    updatePaginationUI();

    const card = state.cards[index];
    els.emptyState.classList.add('hidden');
    els.cropperWrapper.classList.remove('hidden');
    els.editorImage.src = card.blob;

    // --- CONFIG FOR PASSPORT PHOTO ---
    state.cropper = new Cropper(els.editorImage, {
        viewMode: 1, 
        dragMode: 'move', 
        aspectRatio: PASSPORT_ASPECT_RATIO, 
        autoCropArea: 0.4, 
        responsive: true,
        restore: false,
        guides: true,
        center: true,
        highlight: false,
        cropBoxMovable: true,
        cropBoxResizable: true,
        toggleDragModeOnDblclick: false,
        ready() {
            if (card.cropData) {
                this.cropper.setData(card.cropData);
            } 
            updatePreview();
        },
        cropend() { saveCropData(); updatePreview(); },
        zoom() { els.zoomRange.value = state.cropper.getImageData().ratio; saveCropData(); }
    });
    els.zoomRange.value = 1;
}

function updatePaginationUI() {
    const total = state.cards.length;
    const current = state.activeIndex + 1;
    els.imageCounter.innerText = total === 0 ? "0 / 0" : `${current} / ${total}`;
    els.btnPrev.disabled = state.activeIndex <= 0;
    els.btnNext.disabled = state.activeIndex >= total - 1;
}

function handleNext() { if (state.activeIndex < state.cards.length - 1) selectCard(state.activeIndex + 1); }
function handlePrev() { if (state.activeIndex > 0) selectCard(state.activeIndex - 1); }

async function saveCropData() {
    if (!state.cropper) return;
    const data = state.cropper.getData();
    state.cards[state.activeIndex].cropData = data;
    await db.cards.update(state.cards[state.activeIndex].id, { cropData: data });
}

function updatePreview() {
    if (!state.cropper) return;
    const canvas = state.cropper.getCroppedCanvas({ width: 350, height: 450 });
    if (canvas) {
        els.previewCard.innerHTML = '';
        const img = document.createElement('img');
        img.src = canvas.toDataURL();
        img.className = "w-full h-full object-cover";
        els.previewCard.appendChild(img);
    }
}

// --- BATCH ZIP DOWNLOAD (HIGH QUALITY) ---
async function handleDownloadZip() {
    if (state.cards.length === 0) return showToast("No images to download!");
    
    showToast("Processing High-Res Images...");
    const zip = new JSZip();
    const folder = zip.folder("Passport_Photos_HD");

    for (let i = 0; i < state.cards.length; i++) {
        const card = state.cards[i];
        const imgUrl = await getHighResCrop(card);
        
        // Handle Filename Extension
        let finalName = card.name;
        if (!finalName.includes('.')) {
            finalName += '.jpg';
        } else {
            finalName = finalName.substring(0, finalName.lastIndexOf('.')) + '.jpg';
        }

        folder.file(finalName, imgUrl.split(',')[1], {base64: true});
    }

    zip.generateAsync({type:"blob"}).then(function(content) {
        saveAs(content, "Passport_Batch_HD.zip");
        showToast("HD ZIP Downloaded!");
    });
}

// --- HELPER: Generate ULTRA High-Res Image ---
async function getHighResCrop(card) {
    return new Promise(resolve => {
        // ULTRA HD Settings (1200px wide)
        const HD_WIDTH = 1200;
        const HD_HEIGHT = 1542; 

        if (state.activeIndex > -1 && card.id === state.cards[state.activeIndex].id && state.cropper) {
            const canvas = state.cropper.getCroppedCanvas({
                width: HD_WIDTH, height: HD_HEIGHT,
                imageSmoothingEnabled: true, imageSmoothingQuality: 'high'
            });
            resolve(canvas.toDataURL('image/jpeg', 1.0));
            return;
        }

        const img = new Image();
        img.src = card.blob;
        img.onload = () => {
            const div = document.createElement('div');
            div.appendChild(img);
            document.body.appendChild(div);

            const c = new Cropper(img, {
                aspectRatio: PASSPORT_ASPECT_RATIO,
                viewMode: 1,
                autoCropArea: 0.4,
                checkCrossOrigin: false,
                ready() {
                    if (card.cropData) c.setData(card.cropData);
                    const canvas = c.getCroppedCanvas({
                        width: HD_WIDTH, height: HD_HEIGHT,
                        imageSmoothingEnabled: true, imageSmoothingQuality: 'high'
                    });
                    const url = canvas.toDataURL('image/jpeg', 1.0);
                    c.destroy();
                    div.remove();
                    resolve(url);
                }
            });
        };
    });
}

function setupEventListeners() {
    els.fileInput.addEventListener('change', handleUpload);
    els.btnPrev.onclick = handlePrev;
    els.btnNext.onclick = handleNext;
    els.btnRotate.onclick = () => state.cropper?.rotate(90);
    els.btnReset.onclick = () => state.cropper?.reset();
    els.zoomRange.oninput = (e) => state.cropper?.zoomTo(e.target.value);
    els.btnDownloadZip.onclick = handleDownloadZip;
    els.btnLogout.onclick = handleLogout; // New Logout Listener
    
    document.addEventListener('keydown', (e) => {
        if (document.getElementById('loginOverlay').classList.contains('hidden')) {
            if(e.key === 'ArrowLeft') handlePrev();
            if(e.key === 'ArrowRight') handleNext();
        }
    });
}

function showToast(msg) {
    els.toastMsg.innerText = msg; els.toast.classList.remove('translate-x-[150%]');
    setTimeout(() => els.toast.classList.add('translate-x-[150%]'), 3000);
}
