const mineflayer = require('mineflayer');

let bot = null;
let isLoggedIn = false;
let survivalSwitched = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

console.log('╔══════════════════════════════════════════╗');
console.log('║     Minecraft Bot - StarnixMC            ║');
console.log('╠══════════════════════════════════════════╣');
console.log('║ Username: RRF_GAMING                    ║');
console.log('║ Server: ind.starnixmc.xyz               ║');
console.log('║ Status: Starting...                     ║');
console.log('╚══════════════════════════════════════════╝\n');

function formatUptime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
}

function createBot() {
    console.log(`[${new Date().toLocaleTimeString()}] Connecting to ind.starnixmc.xyz...`);
    
    bot = mineflayer.createBot({
        host: 'ind.starnixmc.xyz',
        port: 25565,
        username: 'RRF_GAMING',
        version: '1.21.4',
        disableChatSigning: true,
        viewDistance: 'short',
        hideErrors: true,
        connectTimeout: 30000
    });
    
    // Step 1: On login
    bot.once('login', () => {
        console.log(`[✓] Connected!`);
        reconnectAttempts = 0;
        
        // Wait 5 seconds, then send login command
        setTimeout(() => {
            console.log('[1] Sending /login roshroy12...');
            bot.chat('/login roshroy12');
        }, 5000);
    });
    
    // Step 2: After login, wait 5 seconds then switch to survival
    bot.on('message', (message) => {
        const msg = message.toString();
        console.log(`[Chat] ${msg}`);
        
        // Check for login success
        if (msg.includes('Successfully logged in') || msg.includes('Logged-in due to Session')) {
            console.log('[✓] Login successful!');
            isLoggedIn = true;
            
            // Wait 5 seconds after login, then switch to survival
            setTimeout(() => {
                if (!survivalSwitched) {
                    console.log('[2] Switching to survival server...');
                    bot.chat('/server survival');
                }
            }, 5000);
        }
        
        // Check if we're in survival
        if (msg.includes('survival') && (msg.includes('teleport') || msg.includes('You are now in'))) {
            console.log('[✓] Now in survival server!');
            survivalSwitched = true;
        }
        
        // Auto-respond to commands
        if (msg.toLowerCase().includes('rrf_gaming')) {
            if (msg.toLowerCase().includes('!pos')) {
                const pos = bot.entity.position;
                setTimeout(() => bot.chat(`Position: ${Math.floor(pos.x)} ${Math.floor(pos.y)} ${Math.floor(pos.z)}`), 1000);
            }
            if (msg.toLowerCase().includes('!uptime')) {
                const uptime = (Date.now() - botStartTime) / 1000;
                setTimeout(() => bot.chat(`Uptime: ${formatUptime(uptime)}`), 1000);
            }
            if (msg.toLowerCase().includes('!hello')) {
                setTimeout(() => bot.chat(`Hello!`), 1000);
            }
        }
    });
    
    bot.on('resourcePack', () => {
        console.log('[→] Accepting resource pack...');
        bot.acceptResourcePack();
    });
    
    bot.on('kicked', (reason) => {
        const text = typeof reason === 'string' ? reason : JSON.stringify(reason);
        console.log(`[✗] Kicked: ${text}`);
        
        if (text.includes('already connected')) {
            console.log('[!] Account already logged in elsewhere!');
            console.log('[!] Make sure you are NOT logged into Minecraft with RRF_GAMING');
            console.log('[!] Waiting 60 seconds before retry...');
            setTimeout(() => scheduleReconnect(), 60000);
        } else {
            scheduleReconnect();
        }
    });
    
    bot.on('error', (err) => {
        console.log(`[Error] ${err.message}`);
        scheduleReconnect();
    });
    
    bot.on('end', () => {
        console.log(`[Disconnected]`);
        scheduleReconnect();
    });
    
    bot.once('spawn', () => {
        console.log('[✓] Bot spawned!');
        const pos = bot.entity.position;
        console.log(`[Position] X:${Math.floor(pos.x)} Y:${Math.floor(pos.y)} Z:${Math.floor(pos.z)}`);
    });
}

let botStartTime = Date.now();

function scheduleReconnect() {
    reconnectAttempts++;
    if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
        console.log('[!] Too many reconnect attempts. Waiting 5 minutes...');
        reconnectAttempts = 0;
        setTimeout(() => createBot(), 300000);
        return;
    }
    
    const delay = 15000; // 15 seconds between reconnects
    console.log(`[Reconnect] Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay/1000}s...`);
    setTimeout(() => {
        isLoggedIn = false;
        survivalSwitched = false;
        createBot();
    }, delay);
}

// Start bot
createBot();

// Heartbeat every minute
setInterval(() => {
    const uptime = (Date.now() - botStartTime) / 1000;
    const status = bot && bot.entity ? 'Connected' : 'Disconnected';
    const mode = survivalSwitched ? 'Survival' : (isLoggedIn ? 'Lobby' : 'Logging in');
    console.log(`[Heartbeat] Uptime: ${formatUptime(uptime)} | Status: ${status} | Mode: ${mode}`);
}, 60000);