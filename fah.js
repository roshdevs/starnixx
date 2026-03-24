const mineflayer = require('mineflayer');

let bot = null;
let reconnectTimer = null;
let isLoggedIn = false;
let survivalSwitched = false;
let resourcePackLoaded = false;

// Server options
const serverOptions = [
    { host: 'ind.starnixmc.xyz', port: 25565 }
];

let currentServerIndex = 0;
let botStartTime = Date.now();
let connectionStartTime = null;

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
        console.log(`[Timeout] Connection to ${server.host} timed out`);
        if (bot) bot.end();
        setTimeout(() => createBot(), 10000);
    }, 15000);
    
    bot.once('login', () => {
        clearTimeout(connectionTimeout);
        connectionStartTime = Date.now();
        console.log(`[${new Date().toLocaleTimeString()}] ✓ Connected to ${server.host}`);
        
        setTimeout(() => {
            console.log('[→] Sending login command...');
            bot.chat('/login roshroy12');
        }, 2000);
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
    });
    
    bot.on('kicked', (reason) => {
        console.log(`[✗] Kicked: ${reason}`);
        connectionStartTime = null;
        scheduleReconnect();
    });
    
    bot.on('error', (err) => {
        if (err.message.includes('PartialReadError') || err.message.includes('world_particles')) {
            return;
        }
        console.log(`[Error] ${err.message}`);
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
        scheduleReconnect();
    });
    
    bot.once('spawn', () => {
        console.log('[✓] Bot spawned in lobby!');
        const pos = bot.entity.position;
        console.log(`[Position] X:${Math.floor(pos.x)} Y:${Math.floor(pos.y)} Z:${Math.floor(pos.z)}`);
        console.log('[Bot] Ready and waiting for commands!\n');
    });
}

function switchToSurvival() {
    if (survivalSwitched) return;
    
    setTimeout(() => {
        if (!survivalSwitched && isLoggedIn && bot && bot.entity) {
            console.log('[→] Switching to survival server...');
            bot.chat('/server survival');
        }
    }, 3000);
}

function scheduleReconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
        console.log('[Reconnect] Reconnecting in 10 seconds...');
        if (bot) {
            try { bot.end(); } catch(e) {}
        }
        isLoggedIn = false;
        survivalSwitched = false;
        resourcePackLoaded = false;
        createBot();
    }, 10000);
}

// Start the bot
console.log('╔══════════════════════════════════════════╗');
console.log('║     Minecraft Bot - StarnixMC            ║');
console.log('╠══════════════════════════════════════════╣');
console.log('║ Version: 1.21.4                         ║');
console.log('║ Username: RRF_GAMING                    ║');
console.log('║ Server: play.starnixmc.xyz              ║');
console.log('║ Features:                               ║');
console.log('║   • Auto-login                          ║');
console.log('║   • Auto-survival                       ║');
console.log('║   • Auto-resource pack                  ║');
console.log('║   • Uptime tracking                     ║');
console.log('║   • Auto-reconnect                      ║');
console.log('╚══════════════════════════════════════════╝\n');

createBot();

// Keep process alive with heartbeat
setInterval(() => {
    const uptime = (Date.now() - botStartTime) / 1000;
    console.log(`[Heartbeat] Running: ${formatUptime(uptime)} | Status: ${bot ? 'Connected' : 'Disconnected'}`);
}, 60000);