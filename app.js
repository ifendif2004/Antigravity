/**
 * Pedometer App Logic
 */

// State
let isTracking = false;
let stepCount = 0;
let startTime = 0;
let timerInterval;
let watchId = null;
let currentPath = [];

// DOM Elements
const elements = {
    startBtn: document.getElementById('start-btn'),
    stopBtn: document.getElementById('stop-btn'),
    stepDisplay: document.getElementById('step-count'),
    timeDisplay: document.getElementById('time-display'),
    distDisplay: document.getElementById('distance-display'),
    viewHistoryBtn: document.getElementById('view-history-btn'),
    backToTrackerBtn: document.getElementById('back-to-tracker-btn'),
    trackerView: document.getElementById('tracker-view'),
    historyView: document.getElementById('history-view'),
    statusMsg: document.getElementById('status-message'),
    permissionOverlay: document.getElementById('permission-overlay'),
    grantPermissionBtn: document.getElementById('grant-permission-btn'),
    historyList: document.getElementById('history-list'),
    mapModal: document.getElementById('map-modal'),
    closeMapBtn: document.getElementById('close-map-btn'),
    mapContainer: document.getElementById('map')
};

// Map Global
let map;
let polyline;

// --- Initialization ---

function init() {
    setupEventListeners();
    loadHistory();
    // Check if map is loaded (callback)
    window.initMap = function () {
        console.log("Google Maps API loaded");
    };
}

function setupEventListeners() {
    elements.startBtn.addEventListener('click', startTracking);
    elements.stopBtn.addEventListener('click', stopTracking);
    elements.viewHistoryBtn.addEventListener('click', () => switchView('history'));
    elements.backToTrackerBtn.addEventListener('click', () => switchView('tracker'));
    elements.grantPermissionBtn.addEventListener('click', requestPermissions);
    elements.closeMapBtn.addEventListener('click', () => {
        elements.mapModal.classList.remove('active');
    });
}

function switchView(viewName) {
    if (viewName === 'history') {
        elements.trackerView.classList.remove('active');
        elements.historyView.classList.add('active');
        renderHistory();
    } else {
        elements.historyView.classList.remove('active');
        elements.trackerView.classList.add('active');
    }
}

// --- Tracking Logic Stubs ---

// --- Tracking Logic ---

function startTracking() {
    // Check permissions first
    if (typeof DeviceMotionEvent !== 'undefined' &&
        typeof DeviceMotionEvent.requestPermission === 'function') {
        // iOS 13+ requires manual permission request
        DeviceMotionEvent.requestPermission()
            .then(response => {
                if (response === 'granted') {
                    beginSession();
                } else {
                    alert('Permiso denegado para sensores de movimiento.');
                }
            })
            .catch(console.error);
    } else {
        // Non-iOS 13+ devices
        beginSession();
    }
}

function beginSession() {
    isTracking = true;
    stepCount = 0;
    currentPath = [];
    startTime = Date.now();
    updateDisplay();

    // Toggle Buttons
    elements.startBtn.classList.add('hidden');
    elements.stopBtn.classList.remove('hidden');
    elements.statusMsg.textContent = "Caminando...";

    // Start Timer
    timerInterval = setInterval(updateTimer, 1000);

    // Start Step Counting
    window.addEventListener('devicemotion', handleMotion);

    // Start Geolocation
    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(handleLocation, handleError, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        });
    } else {
        console.warn("Geolocalización no soportada");
    }
}

function stopTracking() {
    isTracking = false;
    clearInterval(timerInterval);

    // Toggle Buttons
    elements.stopBtn.classList.add('hidden');
    elements.startBtn.classList.remove('hidden');
    elements.statusMsg.textContent = "Recorrido finalizado.";

    // Stop Listeners
    window.removeEventListener('devicemotion', handleMotion);
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }

    // Save Run
    saveRun();
}

function deleteRun(id) {
    if (!confirm('¿Estás seguro de que quieres borrar este recorrido?')) return;

    let history = JSON.parse(localStorage.getItem('pedometer_runs') || '[]');
    history = history.filter(run => run.id !== id);
    localStorage.setItem('pedometer_runs', JSON.stringify(history));
    renderHistory();
}

// --- Pedometer Algorithm ---
// Improved algorithm with High-Pass Filter to remove gravity
// and Low-Pass Filter to isolate gravity.
let gravity = { x: 0, y: 0, z: 0 };
const ALPHA = 0.8; // Smoothing factor for gravity
const STEP_THRESHOLD = 2.5; // Threshold for linear acceleration magnitude (m/s^2)
const MIN_STEP_DELAY = 300; // ms

function handleMotion(event) {
    if (!isTracking) return;

    const acc = event.accelerationIncludingGravity;
    if (!acc) return;

    // 1. Isolate Gravity (Low-Pass Filter)
    gravity.x = ALPHA * gravity.x + (1 - ALPHA) * acc.x;
    gravity.y = ALPHA * gravity.y + (1 - ALPHA) * acc.y;
    gravity.z = ALPHA * gravity.z + (1 - ALPHA) * acc.z;

    // 2. Linear Acceleration (High-Pass Filter)
    // Remove gravity component to get actual movement
    const linearX = acc.x - gravity.x;
    const linearY = acc.y - gravity.y;
    const linearZ = acc.z - gravity.z;

    // 3. Magnitude of Linear Acceleration
    const magnitude = Math.sqrt(linearX * linearX + linearY * linearY + linearZ * linearZ);

    // 4. Peak Detection with new threshold
    if (magnitude > STEP_THRESHOLD) {
        const now = Date.now();
        if (now - lastStepTime > MIN_STEP_DELAY) {
            stepCount++;
            lastStepTime = now;
            updateDisplay();
        }
    }
}

// --- Geolocation Logic ---

function handleLocation(position) {
    if (!isTracking) return;

    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    currentPath.push({ lat, lng });

    // Optional: Calculate detailed distance from GPS instead of steps?
    // For now we stick to step-based distance for simplicity or mix them.
}

function handleError(error) {
    console.warn('Error en geolocalización:', error.message);
}

function updateTimer() {
    const elapsed = Date.now() - startTime; // in ms
    const totalSeconds = Math.floor(elapsed / 1000);
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    elements.timeDisplay.textContent = `${h}:${m}:${s}`;
}

function updateDisplay() {
    elements.stepDisplay.textContent = stepCount;
    // Simple estimation: 0.762m per step (average) -> km
    const km = (stepCount * 0.762) / 1000;
    elements.distDisplay.textContent = km.toFixed(2) + ' km';
}

function requestPermissions() {
    // This is for the manual overlay if needed
    elements.permissionOverlay.classList.add('hidden');
    startTracking();
}


// --- Storage ---

function saveRun() {
    if (stepCount === 0 && currentPath.length === 0) {
        elements.statusMsg.textContent = "Recorrido vacío, no guardado.";
        return;
    }

    const runData = {
        id: Date.now(),
        date: new Date().toLocaleString(),
        steps: stepCount,
        startTime: startTime,
        endTime: Date.now(),
        path: currentPath
    };

    let history = JSON.parse(localStorage.getItem('pedometer_runs') || '[]');
    history.unshift(runData);
    localStorage.setItem('pedometer_runs', JSON.stringify(history));
    console.log("Run saved", runData);
}

function loadHistory() {
    // Initial load check
}

function renderHistory() {
    let history = JSON.parse(localStorage.getItem('pedometer_runs') || '[]');
    elements.historyList.innerHTML = '';

    if (history.length === 0) {
        elements.historyList.innerHTML = '<div class="empty-state">No hay recorridos guardados aún.</div>';
        return;
    }

    history.forEach(run => {
        const item = document.createElement('div');
        item.className = 'history-item';
        // Add current path check for better UX
        const isCurrent = false;

        item.innerHTML = `
            <div class="h-info-row">
                <span class="h-date">${run.date}</span>
                <button class="delete-btn" aria-label="Borrar recorrido">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
            <div class="h-row-center">
                 <span class="h-steps">${run.steps} pasos</span>
            </div>
            <div class="h-detail-row">
                <span>${((run.steps * 0.762) / 1000).toFixed(2)} km</span>
            </div>
        `;

        // Click on item to view map
        item.addEventListener('click', (e) => {
            showMapDetails(run);
        });

        // Click on delete button
        const deleteBtn = item.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent opening map
            deleteRun(run.id);
        });

        elements.historyList.appendChild(item);
    });
}

function showMapDetails(runData) {
    elements.mapModal.classList.add('active');
    document.getElementById('m-steps').textContent = runData.steps;
    document.getElementById('m-dist').textContent = ((runData.steps * 0.762) / 1000).toFixed(2) + ' km';
    document.getElementById('map-date').textContent = runData.date;

    initMapWithRun(runData);
}

function initMapWithRun(runData) {
    if (!window.google) {
        elements.mapContainer.innerHTML = '<div style="padding:1rem">Google Maps API no cargada.</div>';
        return;
    }

    // Default center if path is empty
    let center = { lat: -34.397, lng: 150.644 };
    if (runData.path && runData.path.length > 0) {
        center = runData.path[0];
    }

    map = new google.maps.Map(elements.mapContainer, {
        center: center,
        zoom: 15,
        styles: [
            { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
            { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
            { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
        ]
    });

    if (runData.path && runData.path.length > 0) {
        polyline = new google.maps.Polyline({
            path: runData.path,
            geodesic: true,
            strokeColor: "#10b981", // Accent green
            strokeOpacity: 1.0,
            strokeWeight: 5
        });

        polyline.setMap(map);

        // Fit bounds
        const bounds = new google.maps.LatLngBounds();
        runData.path.forEach(coord => bounds.extend(coord));
        map.fitBounds(bounds);
    }
}

// Start app
init();
