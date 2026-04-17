// Firebase is loaded as a compat global via <script> tags in index.html.
// No import statements needed - compatible with file:// and http:// alike.

// --- State Management ---
let firebaseDb = null;

let eventConfig = {
    eventName: "No Event Loaded",
    eventTimeline: "",
    eventWifi: "",
    eventContact: "",
    mapImageBase64: null,
    apiGemini: '',
    apiFirebase: '',
    pins: []
};

// Fallback Mock Data if Admin hasn't configured anything
const fallbackPins = [
    { id: 'gate-a', name: 'Gate A (Main)', x: 50, y: 10, type: 'gate' },
    { id: 'gate-b', name: 'Gate B (Transit)', x: 50, y: 90, type: 'gate' },
    { id: 'food-east', name: 'East Grill', x: 90, y: 50, type: 'food' },
    { id: 'restroom-north', name: 'North Restroom', x: 10, y: 50, type: 'restroom' }
];

// --- Boot Sequence ---
document.addEventListener('DOMContentLoaded', () => {
    registerServiceWorker();
    loadConfiguration();
    initAuth();
    initThemeToggle();
    initNavigation();
    initChatInterface();
    startBroadcastSystem();
});

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(() => console.log("Offline PWA logic active"))
            .catch(err => console.error("SW failed: ", err));
    }
}

// Loads Admin configure JSON from local database memory, then bootstraps Firebase
function loadConfiguration() {
    const raw = localStorage.getItem('venue_config');
    if (raw) {
        eventConfig = JSON.parse(raw);
    } else {
        eventConfig.eventName = "Hack2Skill Prompt Wars";
        eventConfig.pins = fallbackPins;
    }

    document.getElementById('login-event-name').textContent = eventConfig.eventName;
    document.getElementById('lbl-eventname').textContent = eventConfig.eventName;
    
    // Load Venue Info details
    if(eventConfig.eventTimeline || eventConfig.eventWifi || eventConfig.eventContact) {
        document.getElementById('venue-info-card').style.display = 'block';
        document.getElementById('vi-time').textContent = eventConfig.eventTimeline;
        document.getElementById('vi-wifi').textContent = eventConfig.eventWifi;
        document.getElementById('vi-contact').textContent = eventConfig.eventContact;
    }
    
    renderDashboard();
    renderMap();

    // Show Demo Mode badge if vital keys are missing
    const demoBadge = document.getElementById('demo-badge');
    if (!eventConfig.apiGemini || !eventConfig.apiFirebase) {
        if (demoBadge) demoBadge.classList.remove('hidden');
    } else {
        if (demoBadge) demoBadge.classList.add('hidden');
    }

    // Initialise Firebase if a URL is configured by admin
    if (eventConfig.apiFirebase && eventConfig.apiFirebase.trim() !== '') {
        initFirebaseSync();
    } else {
        // Fall back to simulated updates when no Firebase is configured
        startSimulatedUpdates();
    }
}

// Authentication Screen
function initAuth() {
    const btn = document.getElementById('btn-login');
    const input = document.getElementById('ticket-input');
    
    btn.addEventListener('click', () => {
        const val = input.value.trim();
        if (val.length < 3) {
            alert("Invalid Ticket ID. Try 'VIP-44'");
            return;
        }
        
        document.getElementById('lbl-username').textContent = val;
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById('app-container').style.opacity = '1';
        document.getElementById('bottom-nav').classList.remove('hidden');
        triggerHaptic('heavy');
    });
}

// Light / Dark Theme toggle
function initThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    const htmlEl = document.documentElement;

    btn.addEventListener('click', () => {
        const currentTheme = htmlEl.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        htmlEl.setAttribute('data-theme', newTheme);
        triggerHaptic('light');
    });
}

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active'));
            views.forEach(view => view.classList.remove('active'));

            item.classList.add('active');
            const targetId = item.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
        });
    });
}

// Render pins with status colours derived from live wait times
function renderDashboard() {
    const grid = document.getElementById('services-grid');
    grid.innerHTML = ''; 

    if (eventConfig.pins.length === 0) {
        grid.innerHTML = '<p style="padding:20px; text-align:center;">No services mapped by admin.</p>';
        return;
    }

    const sorted = [...eventConfig.pins].sort((a,b) => a.type.localeCompare(b.type));

    sorted.forEach(pin => {
        // Use admin-set wait time; only generate random if not yet set
        if (pin.wait === undefined) pin.wait = Math.floor(Math.random() * 25);
        pin.status = pin.wait > 15 ? 'red' : (pin.wait > 5 ? 'yellow' : 'green');

        const card = document.createElement('div');
        card.className = `card service-card`;
        card.id = `dash-${pin.id}`;
        card.setAttribute('role', 'region');
        card.setAttribute('aria-label', `${pin.name} wait time ${pin.wait} minutes`);
        card.innerHTML = `
            <div class="card-info">
                <h3>${pin.name}</h3>
                <p>${capitalize(pin.type)}</p>
            </div>
            <div class="wait-time"><span class="val status-${pin.status}" aria-live="polite">${pin.wait} min</span></div>
            <svg class="sparkline-bg" aria-hidden="true"></svg>
        `;
        grid.appendChild(card);
    });
    
    drawSparklines();
}

function renderMap() {
    const imgEl = document.getElementById('attendee-map-img');
    const pinsLayer = document.getElementById('attendee-pins-layer');
    const fallbackText = document.getElementById('no-map-fallback');
    
    if (eventConfig.mapImageBase64) {
        imgEl.src = eventConfig.mapImageBase64;
        imgEl.style.display = 'block';
        fallbackText.style.display = 'none';
        
        // Render pins exactly over the image
        eventConfig.pins.forEach(pin => {
            const beacon = document.createElement('div');
            beacon.className = 'map-beacon';
            beacon.style.left = `${pin.x}%`;
            beacon.style.top = `${pin.y}%`;
            beacon.setAttribute('data-name', pin.name);
            beacon.id = `beacon-${pin.id}`;
            
            if(pin.status === 'red') beacon.style.background = 'var(--status-red)';
            if(pin.status === 'yellow') beacon.style.background = 'var(--status-yellow)';
            if(pin.status === 'green') beacon.style.background = 'var(--status-green)';
            
            pinsLayer.appendChild(beacon);
        });
    }
}

// --- Firebase Realtime Sync (uses compat global loaded via CDN script tag) ---
function initFirebaseSync() {
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp({ databaseURL: eventConfig.apiFirebase });
        }
        firebaseDb = firebase.database();

        // Listen for real-time pin wait-time updates pushed by Admin
        firebaseDb.ref('venue_config/pins').on('value', (snapshot) => {
            const livePins = snapshot.val();
            if (!livePins || !Array.isArray(livePins)) return;

            livePins.forEach(livePin => {
                const localPin = eventConfig.pins.find(p => p.id === livePin.id);
                if (!localPin) return;

                localPin.wait = livePin.wait;
                localPin.status = livePin.wait > 15 ? 'red' : (livePin.wait > 5 ? 'yellow' : 'green');

                const cardEl = document.getElementById(`dash-${livePin.id}`);
                if (cardEl) {
                    const valEl = cardEl.querySelector('.val');
                    if (valEl) {
                        valEl.className = `val status-${localPin.status}`;
                        valEl.textContent = `${localPin.wait} min`;
                        cardEl.setAttribute('aria-label', `${localPin.name} wait time ${localPin.wait} minutes`);
                    }
                }
                const beacon = document.getElementById(`beacon-${livePin.id}`);
                if (beacon) beacon.style.background = `var(--status-${localPin.status})`;
            });
            drawSparklines();
        });
        console.log('✅ Firebase Realtime sync active');
    } catch(e) {
        console.warn('Firebase init failed, using simulated updates.', e);
        startSimulatedUpdates();
    }
}

// Fallback simulation (used when Firebase is not configured)
function startSimulatedUpdates() {
    setInterval(() => {
        if(eventConfig.pins.length > 0) {
            const rPin = eventConfig.pins[Math.floor(Math.random() * eventConfig.pins.length)];
            rPin.wait += (Math.random() > 0.5 ? 2 : -2);
            if(rPin.wait < 0) rPin.wait = 0;
            
            rPin.status = rPin.wait > 15 ? 'red' : (rPin.wait > 5 ? 'yellow' : 'green');
            
            const cardEl = document.getElementById(`dash-${rPin.id}`);
            if(cardEl) {
                const valEl = cardEl.querySelector('.val');
                valEl.className = `val status-${rPin.status}`;
                valEl.textContent = `${rPin.wait} min`;
            }
            // Update beacon color if map is loaded
            const beacon = document.getElementById(`beacon-${rPin.id}`);
            if(beacon) {
                beacon.style.background = `var(--status-${rPin.status})`;
            }
            
            if(Math.random() > 0.6) drawSparklines();
        }
    }, 4000);
}

function drawSparklines() {
    document.querySelectorAll('.sparkline-bg').forEach(svg => {
        let d = `M 0 50 `;
        for(let i=1; i<=10; i++) {
            d += `L ${i*10} ${Math.random() * 50} `;
        }
        svg.innerHTML = `<path d="${d}" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"></path>`;
        svg.setAttribute('viewBox', '0 0 100 50');
        svg.setAttribute('preserveAspectRatio', 'none');
    });
}

function initChatInterface() {
    document.getElementById('chat-send').addEventListener('click', () => {
        submitChat(document.getElementById('chat-input').value);
    });
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if(e.key === 'Enter') submitChat(e.target.value);
    });
    document.querySelectorAll('.chip').forEach(c => {
        c.addEventListener('click', (e) => submitChat(e.target.getAttribute('data-query')));
    });
}

function submitChat(query) {
    if(!query.trim()) return;
    const windowEl = document.getElementById('chat-window');
    
    const ub = document.createElement('div');
    ub.className = 'chat-bubble user';
    ub.textContent = query;
    windowEl.appendChild(ub);
    
    document.getElementById('chat-input').value = '';
    windowEl.scrollTop = windowEl.scrollHeight;

    const typ = document.getElementById('typing-indicator');
    windowEl.appendChild(typ);
    typ.classList.remove('hidden');

    setTimeout(() => {
        if (eventConfig.apiGemini && eventConfig.apiGemini.trim() !== '') {
            handleGeminiChat(query, windowEl, typ);
        } else {
            typ.classList.add('hidden');
            replyBot(query.toLowerCase(), windowEl);
        }
    }, 500);
}

async function handleGeminiChat(query, windowEl, typ) {
    const key = (eventConfig.apiGemini || '').trim();
    if (!key) {
        typ.classList.add('hidden');
        renderChatBubble("⚠️ Gemini API Key missing. Please configure it in the Admin Portal.", windowEl);
        return;
    }

    const systemInstruction = `You are a helpful event assistant at ${eventConfig.eventName || 'the venue'}. 
Available locations: ${JSON.stringify(eventConfig.pins)}. 
Current time: ${new Date().toLocaleTimeString()}.
Analyze the user's query. If you should guide them to a specific location from the available pins list, provide the exact 'id' of the pin.
Respond in strict JSON format ONLY:
{
  "response": "Your conversational reply here using simple HTML tags like <b> if needed",
  "recommended_pin_id": "pin_123" // or null if no pin is relevant
}`;

    // A list of model identifiers to try in sequence if a 404 occurs.
    const modelCandidates = [
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-2.5-pro',
        'gemini-2.0-pro',
        'gemini-1.5-flash-latest', 
        'gemini-1.5-flash', 
        'gemini-pro'
    ];

    let lastError = null;

    for (const modelName of modelCandidates) {
        try {
            console.log(`🤖 AI Attempt: Trying model ${modelName}...`);
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        { role: "user", parts: [{ text: "CONTEXT: " + systemInstruction + "\n\nUser Query follows." }] },
                        { role: "model", parts: [{ text: "Understood. I will provide helpful venue guidance in the requested JSON format." }] },
                        { role: "user", parts: [{ text: query }] }
                    ],
                    generationConfig: { temperature: 0.2 }
                })
            });

            const data = await response.json();
            
            // If the error is 404 (Not Found) OR 503 (High Demand) OR 429 (Quota), try the next model.
            if (data.error) {
                const msg = data.error.message.toLowerCase();
                if (data.error.code === 404 || 
                    data.error.code === 503 || 
                    data.error.code === 429 ||
                    msg.includes("not found") || 
                    msg.includes("high demand") ||
                    msg.includes("quota") ||
                    msg.includes("busy") ||
                    msg.includes("spike")) {
                    console.warn(`⚠️ Model ${modelName} hit a limit or not found. Trying fallback...`);
                    lastError = data.error.message;
                    continue; 
                }
                // For other errors (e.g., Key invalid), we stop and report.
                typ.classList.add('hidden');
                renderChatBubble(`❌ AI Error: ${data.error.message}`, windowEl);
                return;
            }

            // SUCCESS!
            console.log(`✅ AI Connected via ${modelName}`);
            typ.classList.add('hidden');
            const textRes = data.candidates[0].content.parts[0].text;
            const parsed = JSON.parse(textRes);
            renderChatBubble(parsed.response, windowEl);
            
            if (parsed.recommended_pin_id) {
                const best = eventConfig.pins.find(p => p.id === parsed.recommended_pin_id);
                if (best) {
                    const container = document.createElement('div');
                    container.style.width = '100%';
                    container.appendChild(createWidgetCard(best));
                    windowEl.appendChild(container);
                    windowEl.scrollTop = windowEl.scrollHeight;
                    drawRouteTo(best);
                    triggerHaptic('light');
                }
            }
            return; // Exit function on success

        } catch (err) {
            console.error(`AI Fetch Failure for ${modelName}:`, err);
            lastError = err.message;
        }
    }

    // If we reach here, all model candidates failed
    typ.classList.add('hidden');
    renderChatBubble(`😭 I'm having trouble connecting to the AI brain. (Last error: ${lastError}). Please verify your API key in Admin.`, windowEl);
}

function renderChatBubble(text, windowEl) {
    const container = document.createElement('div');
    container.style.width = '100%';
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble bot';
    bubble.innerHTML = text;
    container.appendChild(bubble);
    windowEl.appendChild(container);
    windowEl.scrollTop = windowEl.scrollHeight;}

function replyBot(query, windowEl) {
    const container = document.createElement('div');
    container.style.width = '100%';
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble bot';

    let requestedType = null;
    if (query.includes('food') || query.includes('hungry')) requestedType = 'food';
    if (query.includes('restroom') || query.includes('bathroom') || query.includes('toilet')) requestedType = 'restroom';
    if (query.includes('exit') || query.includes('gate') || query.includes('leave') || query.includes('transit')) requestedType = 'gate';

    if (requestedType && eventConfig.pins.length > 0) {
        const matches = eventConfig.pins.filter(p => p.type === requestedType);
        if(matches.length > 0) {
            matches.sort((a,b) => a.wait - b.wait);
            const best = matches[0];
            
            bubble.innerHTML = `I found a route to <b>${best.name}</b>. It has the shortest current wait time of ${best.wait} minutes.`;
            container.appendChild(bubble);
            container.appendChild(createWidgetCard(best));
            
            drawRouteTo(best);
            triggerHaptic('light');
        } else {
            bubble.innerHTML = `Sorry, the admin has not mapped any ${requestedType} locations on this map.`;
            container.appendChild(bubble);
        }
    } else {
        bubble.innerHTML = `I didn't quite catch that. Try asking for "Food", "Restrooms", or "Exits".`;
        container.appendChild(bubble);
    }

    windowEl.appendChild(container);
    windowEl.scrollTop = windowEl.scrollHeight;
}

function createWidgetCard(bestPin) {
    const wrapper = document.createElement('div');
    wrapper.className = 'chat-widget';
    wrapper.innerHTML = `
        <div class="card service-card" style="margin-bottom:0; margin-top:10px;">
            <div class="card-info">
                <h3>${bestPin.name}</h3>
                <p>View path on map</p>
            </div>
            <div class="wait-time status-${bestPin.status}">${bestPin.wait} min</div>
        </div>
    `;
    return wrapper;
}

function drawRouteTo(pin) {
    const path = document.getElementById('routing-path');
    if (path) {
        // Draw from a dummy center (50,50) to exact destination
        path.setAttribute('d', `M 50 50 Q 50 ${pin.y} ${pin.x} ${pin.y}`);
    }
}

function startBroadcastSystem() {
    const island = document.getElementById('dynamic-island');
    const txt = document.getElementById('island-text');
    const msg = [
        "⚠️ Heavy congestion detected at main gates", 
        "ℹ️ All event maps are synced for offline use", 
        "🚨 Halftime show starting in 10 minutes!"
    ];
    
    setInterval(() => {
        txt.textContent = msg[Math.floor(Math.random() * msg.length)];
        island.classList.remove('hidden');
        triggerHaptic('heavy');
        setTimeout(() => island.classList.add('hidden'), 5000);
    }, 28000);
}

function triggerHaptic(type) {
    if (!navigator.vibrate) return;
    navigator.vibrate(type === 'heavy' ? [100,50,100] : 20);
}

function capitalize(s) {
    if(typeof s !== 'string') return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
}
