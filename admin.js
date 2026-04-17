// Firebase is loaded as a compat global script via HTML <script> tags.
// No ES module imports needed - works with file:// and http:// alike.

let firebaseDb = null;

function initAdminFirebase(url) {
    if (!url || url.trim() === '') return;
    try {
        // Avoid re-initialising if already done
        if (!firebase.apps.length) {
            firebase.initializeApp({ databaseURL: url });
        }
        firebaseDb = firebase.database();
        console.log('✅ Admin Firebase connected');
    } catch(e) {
        console.warn('Firebase init error:', e);
    }
}

function pushToFirebase(configData) {
    if (!firebaseDb) return;
    firebaseDb.ref('venue_config').set({
        eventName: configData.eventName,
        eventTimeline: configData.eventTimeline,
        eventWifi: configData.eventWifi,
        eventContact: configData.eventContact,
        pins: configData.pins
    }).then(() => console.log('✅ Firebase synced'))
      .catch(err => console.warn('Firebase push error:', err));
}

document.addEventListener('DOMContentLoaded', () => {
    const mapUpload = document.getElementById('map-upload');
    const mapImgPreview = document.getElementById('map-img-preview');
    const mapWrapper = document.getElementById('map-wrapper');
    const pinsLayer = document.getElementById('pins-layer');
    const noMapText = document.getElementById('no-map-text');
    
    const pinsList = document.getElementById('pins-list');
    const btnSave = document.getElementById('btn-save');
    const btnClear = document.getElementById('btn-clear');
    
    // Inputs
    const evtName = document.getElementById('event-name');
    const evtTime = document.getElementById('event-timeline');
    const evtWifi = document.getElementById('event-wifi');
    const evtContact = document.getElementById('event-contact');
    const apiGemini = document.getElementById('api-gemini');
    const apiFirebase = document.getElementById('api-firebase');

    let config = {
        eventName: 'Hack2Skill Prompt Wars',
        eventTimeline: '10:00 AM - 4:00 PM',
        eventWifi: 'Network: Stadium_Guest | Pass: hack2win',
        eventContact: 'Security: 555-0199',
        mapImageBase64: null,
        apiGemini: '',
        apiFirebase: '',
        pins: []
    };

    // Load existing config from localStorage
    const existing = localStorage.getItem('venue_config');
    if (existing) {
        config = JSON.parse(existing);
        evtName.value = config.eventName || '';
        evtTime.value = config.eventTimeline || '';
        evtWifi.value = config.eventWifi || '';
        evtContact.value = config.eventContact || '';
        apiGemini.value = config.apiGemini || '';
        apiFirebase.value = config.apiFirebase || '';
        if (config.mapImageBase64) {
            setupMap(config.mapImageBase64);
        }
        renderPins();
        // Re-init Firebase if URL was already saved
        if (config.apiFirebase) initAdminFirebase(config.apiFirebase);
    }

    function setupMap(base64Source) {
        mapImgPreview.src = base64Source;
        mapWrapper.style.display = 'inline-block';
        noMapText.style.display = 'none';
    }

    // Handle Image Upload
    mapUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            config.mapImageBase64 = event.target.result;
            setupMap(config.mapImageBase64);
            mapImgPreview.onload = renderPins;
        };
        reader.readAsDataURL(file);
    });

    // Drop pin on map click
    mapImgPreview.addEventListener('click', (e) => {
        if (!config.mapImageBase64) return;
        
        const rect = mapImgPreview.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        
        const percentX = (clickX / rect.width) * 100;
        const percentY = (clickY / rect.height) * 100;

        const pinName = prompt("Name this location (e.g., 'Gate A', 'North Food', 'Restroom B'):");
        if (pinName && pinName.trim()) {
            const lower = pinName.toLowerCase();
            const type = lower.includes('food') || lower.includes('grill') || lower.includes('eat') ? 'food'
                       : lower.includes('restroom') || lower.includes('toilet') || lower.includes('wc') ? 'restroom'
                       : 'gate';
            config.pins.push({
                id: 'pin_' + Date.now(),
                name: pinName.trim(),
                x: percentX,
                y: percentY,
                type: type,
                wait: 5
            });
            renderPins();
        }
    });

    function renderPins() {
        pinsLayer.innerHTML = '';
        pinsList.innerHTML = '';

        config.pins.forEach((pin, index) => {
            // Map Visual Beacon
            const pinDom = document.createElement('div');
            pinDom.className = 'pin';
            pinDom.style.left = `${pin.x}%`;
            pinDom.style.top = `${pin.y}%`;
            if (pin.wait > 15) pinDom.style.background = 'var(--status-red)';
            else if (pin.wait > 5) pinDom.style.background = 'var(--status-yellow)';
            else pinDom.style.background = 'var(--status-green)';
            pinDom.innerHTML = `<span>${pin.name}</span>`;
            pinsLayer.appendChild(pinDom);

            // Sidebar List with Live Congestion Controls
            const listItem = document.createElement('div');
            listItem.className = 'admin-card';
            listItem.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <strong>${pin.name}</strong>
                    <small style="color:var(--text-secondary); margin: 0 auto 0 8px;">[${pin.type}]</small>
                    <button onclick="removePin(${index})" style="background:transparent; border:none; color:var(--status-red); cursor:pointer;">✖ Remove</button>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;" class="admin-controls">
                    <span style="font-size:0.8rem; color:var(--text-secondary);">Wait Time: <strong id="wait_${index}">${pin.wait || 5}</strong> min</span>
                    <div style="display:flex; gap:5px;">
                        <button onclick="updateWait(${index}, -5)" style="background:var(--bg-panel); color:var(--text-primary); border:1px solid var(--border-glass); padding:4px 10px; border-radius:4px; cursor:pointer; font-size:1rem;">−</button>
                        <button onclick="updateWait(${index}, 5)" style="background:var(--bg-panel); color:var(--text-primary); border:1px solid var(--border-glass); padding:4px 10px; border-radius:4px; cursor:pointer; font-size:1rem;">+</button>
                    </div>
                </div>
            `;
            pinsList.appendChild(listItem);
        });
    }

    window.updateWait = function(index, delta) {
        if (config.pins[index].wait === undefined) config.pins[index].wait = 5;
        config.pins[index].wait = Math.max(0, config.pins[index].wait + delta);
        localStorage.setItem('venue_config', JSON.stringify(config));
        pushToFirebase(config);
        renderPins();
    };

    window.removePin = function(index) {
        if (confirm(`Remove ${config.pins[index].name}?`)) {
            config.pins.splice(index, 1);
            localStorage.setItem('venue_config', JSON.stringify(config));
            pushToFirebase(config);
            renderPins();
        }
    };

    btnSave.addEventListener('click', () => {
        config.eventName = evtName.value;
        config.eventTimeline = evtTime.value;
        config.eventWifi = evtWifi.value;
        config.eventContact = evtContact.value;
        config.apiGemini = apiGemini.value.trim();
        config.apiFirebase = apiFirebase.value.trim();
        
        if (!config.mapImageBase64) {
            alert('⚠️ Please upload a map image before saving.');
            return;
        }
        localStorage.setItem('venue_config', JSON.stringify(config));

        if (config.apiFirebase) {
            initAdminFirebase(config.apiFirebase);
            pushToFirebase(config);
            alert('✅ Event saved & synced to Firebase! All attendee devices will update in real-time.');
        } else {
            alert('✅ Event saved locally! Add a Firebase URL in Google API Configurations to enable live sync across devices.');
        }
    });

    btnClear.addEventListener('click', () => {
        if (confirm("Are you sure? This will permanently wipe the mapping database.")) {
            localStorage.removeItem('venue_config');
            config = { eventName: '', eventTimeline: '', eventWifi: '', eventContact: '', apiGemini: '', apiFirebase: '', mapImageBase64: null, pins: [] };
            mapImgPreview.src = '';
            mapWrapper.style.display = 'none';
            noMapText.style.display = 'block';
            evtName.value = '';
            evtTime.value = '';
            evtWifi.value = '';
            evtContact.value = '';
            apiGemini.value = '';
            apiFirebase.value = '';
            renderPins();
        }
    });

    const btnTestAI = document.getElementById('btn-test-test-ai') || document.getElementById('btn-test-ai');
    const aiStatus = document.getElementById('ai-test-status');

    if(btnTestAI) {
        btnTestAI.addEventListener('click', async () => {
            const key = apiGemini.value.trim();
            if(!key) {
                aiStatus.innerHTML = '<span style="color:var(--status-red)">⚠️ Please enter a key first.</span>';
                return;
            }
            aiStatus.innerHTML = '⌛ Testing connection...';
            try {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
                const data = await res.json();
                if(data.error) {
                    aiStatus.innerHTML = `<span style="color:var(--status-red)">❌ Error: ${data.error.message}</span>`;
                } else {
                    const modelNames = data.models.map(m => m.name.replace('models/','')).join(', ');
                    aiStatus.innerHTML = `<span style="color:var(--status-green)">✅ Success! Available models: ${modelNames.substring(0, 60)}...</span>`;
                    console.log("Full Model List:", data.models);
                }
            } catch(e) {
                aiStatus.innerHTML = `<span style="color:var(--status-red)">❌ Connection failed: ${e.message}</span>`;
            }
        });
    }
});
