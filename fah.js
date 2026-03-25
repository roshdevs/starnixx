const mineflayer = require('mineflayer');

let bot = null;
let reconnectTimer = null;
let isLoggedIn = false;
let survivalSwitched = false;
let resourcePackLoaded = false;
let isConnecting = false;

// Server options
const serverOptions = [
    { host: 'ind.starnixmc.xyz', port: 25565 }
];

let currentServerIndex = 0;
let botStartTime = Date.now();
let connectionStartTime = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Format uptime function
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m ${secs}s`;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
}

// Suppress packet errors
const originalConsoleError = console.error;
console.error = function(...args) {
    const message = args.join(' ');
    if (message.includes('PartialReadError') || 
        message.includes('Read error for undefined') ||
        message.includes('f32') && message.includes('world_particles') ||
        message.includes('getaddrinfo')) {
        return;
    }
    originalConsoleError.apply(console, args);
};

function createBot() {
    if (isConnecting) return;
    isConnecting = true;
    
    const server = serverOptions[currentServerIndex];
    
    console.log(`\n[${new Date().toLocaleTimeString()}] Connecting to ${server.host}:${server.port} (1.21.4)...`);
    console.log(`[Uptime] Bot process has been running for: ${formatUptime((Date.now() - botStartTime) / 1000)}`);
    
    bot = mineflayer.createBot({
        host: server.host,
        port: server.port,
        username: 'RRF_GAMING',
        version: '1.21.4',
        disableChatSigning: true,
        viewDistance: 'short',
        hideErrors: true,
        checkTimeoutInterval: 60000,
        keepAlive: true,
        skipValidation: true,
        connectTimeout: 30000
    });
    
    let connectionTimeout = setTimeout(() => {
        if (bot && !bot.entity) {
            console.log(`[Timeout] Connection to ${server.host} timed out`);
            bot.end();
            isConnecting = false;
            scheduleReconnect();
        }
    }, 20000);
    
    bot.once('login', () => {
        clearTimeout(connectionTimeout);
        connectionStartTime = Date.now();
        reconnectAttempts = 0;
        isConnecting = false;
        console.log(`[${new Date().toLocaleTimeString()}] ✓ Connected to ${server.host}`);
        
        // Send login command after delay
        setTimeout(() => {
            console.log('[→] Sending login command...');
            bot.chat('/login roshroy12');
        }, 3000);
        
        // First survival switch attempt after longer delay
        setTimeout(() => {
            if (!survivalSwitched && isLoggedIn) {
                console.log('[→] Switching to survival server...');
                bot.chat('/server survival');
            }
        }, 10000);
    });
    
    bot.on('resourcePack', () => {
        console.log('[→] Resource pack offered, accepting...');
        bot.acceptResourcePack();
        setTimeout(() => {
            resourcePackLoaded = true;
        }, 3000);
    });
    
    bot.on('message', (message) => {
        const msg = message.toString();
        console.log(`[Chat] ${msg}`);
        
        if (msg.includes('Logged-in due to Session Reconnection')) {
            console.log('[✓] Session restored');
            isLoggedIn = true;
            switchToSurvival();
        }
        
        if (msg.includes('Successfully logged in') || msg.includes('You are now logged in')) {
            console.log('[✓] Login successful');
            isLoggedIn = true;
            switchToSurvival();
        }
        
        if (msg.includes('Wrong password') || msg.includes('Invalid password')) {
            console.log('[✗] Wrong password!');
        }
        
        if (msg.includes('survival') && msg.includes('teleport')) {
            console.log('[✓] Successfully in survival server!');
            survivalSwitched = true;
        }
        
        // Auto-respond to mentions
        if (msg.toLowerCase().includes('rrf_gaming')) {
            if (msg.toLowerCase().includes('!pos')) {
                const pos = bot.entity.position;
                setTimeout(() => bot.chat(`Position: ${Math.floor(pos.x)} ${Math.floor(pos.y)} ${Math.floor(pos.z)}`), 500);
            }
            if (msg.toLowerCase().includes('!uptime')) {
                const uptime = (Date.now() - botStartTime) / 1000;
                setTimeout(() => bot.chat(`Uptime: ${formatUptime(uptime)}`), 500);
            }
            if (msg.toLowerCase().includes('!hello')) {
                setTimeout(() => bot.chat(`Hello! I'm RRF_GAMING`), 500);
            }
        }
    });
    
    bot.on('kicked', (reason) => {
        const reasonText = typeof reason === 'string' ? reason : JSON.stringify(reason);
        console.log(`[✗] Kicked: ${reasonText}`);
        connectionStartTime = null;
        isConnecting = false;
        
        // Longer delay for "logging in too fast" kicks
        if (reasonText.includes('too fast')) {
            console.log('[!] Kicked for logging too fast. Waiting 30 seconds...');
            setTimeout(() => scheduleReconnect(), 30000);
        } else {
            scheduleReconnect();
        }
    });
    
    bot.on('error', (err) => {
        if (err.message.includes('PartialReadError') || err.message.includes('world_particles')) {
            return;
        }
        console.log(`[Error] ${err.message}`);
        isConnecting = false;
        scheduleReconnect();
    });
    
    bot.on('end', () => {
        console.log(`[${new Date().toLocaleTimeString()}] Disconnected`);
        if (connectionStartTime) {
            const duration = (Date.now() - connectionStartTime) / 1000;
            console.log(`[Connection] Was connected for: ${formatUptime(duration)}`);
            connectionStartTime = null;
        }
        isLoggedIn = false;
        survivalSwitched = false;
        isConnecting = false;
        scheduleReconnect();
    });
    
    bot.once('spawn', () => {
        console.log('[✓] Bot spawned in lobby!');
        const pos = bot.entity.position;
        console.log(`[Position] X:${Math.floor(pos.x)} Y:${Math.floor(pos.y)} Z:${Math.floor(pos.z)}`);
    });
}

// Multiple attempt survival switch function
let switchAttempts = 0;
let switchInterval = null;

function switchToSurvival() {
    if (survivalSwitched) return;
    
    if (switchInterval) clearInterval(switchInterval);
    
    switchAttempts = 0;
    
    switchInterval = setInterval(() => {
        if (survivalSwitched) {
            clearInterval(switchInterval);
            switchInterval = null;
            return;
        }
        
        switchAttempts++;
        if (switchAttempts > 10) {
            console.log('[→] Max survival switch attempts reached');
            clearInterval(switchInterval);
            switchInterval = null;
            return;
        }
        
        if (isLoggedIn && bot && bot.entity) {
            console.log(`[→] Attempt ${switchAttempts}/10: Switching to survival...`);
            bot.chat('/server survival');
        }
    }, 8000);
}

function scheduleReconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    
    reconnectAttempts++;
    const delay = Math.min(30000, 10000 * reconnectAttempts);
    
    console.log(`[Reconnect] Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay/1000} seconds...`);
    
    reconnectTimer = setTimeout(() => {
        if (bot) {
            try { bot.end(); } catch(e) {}
            bot = null;
        }
        isLoggedIn = false;
        survivalSwitched = false;
        resourcePackLoaded = false;
        switchAttempts = 0;
        if (switchInterval) clearInterval(switchInterval);
        
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.log('[Reconnect] Max attempts reached. Waiting 5 minutes...');
            reconnectAttempts = 0;
            setTimeout(() => createBot(), 300000);
        } else {
            createBot();
        }
    }, delay);
}

// Start the bot
console.log('╔══════════════════════════════════════════╗');
console.log('║     Minecraft Bot - StarnixMC            ║');
console.log('╠══════════════════════════════════════════╣');
console.log('║ Version: 1.21.4                         ║');
console.log('║ Username: RRF_GAMING                    ║');
console.log('║ Server: ind.starnixmc.xyz               ║');
console.log('║ Features:                               ║');
console.log('║   • Auto-login                          ║');
console.log('║   • Auto-survival (retry up to 10x)     ║');
console.log('║   • Auto-resource pack                  ║');
console.log('║   • Uptime tracking                     ║');
console.log('║   • Smart reconnects with delays        ║');
console.log('║   • Chat commands (!pos, !uptime, !hello)║');
console.log('╚══════════════════════════════════════════╝\n');

createBot();

// Keep process alive with heartbeat
setInterval(() => {
    const uptime = (Date.now() - botStartTime) / 1000;
    const status = bot && bot.entity ? 'Connected' : 'Disconnected';
    const survivalStatus = survivalSwitched ? 'Survival ✓' : 'Lobby';
    console.log(`[Heartbeat] Running: ${formatUptime(uptime)} | Status: ${status} | Mode: ${survivalStatus}`);
}, 60000);