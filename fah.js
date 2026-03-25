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
console.log('╚══════════════════════════════════════════╝\n');

function formatUptime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
}

function createBot() {
    console.log(`[${new Date().toLocaleTimeString()}] Connecting...`);
    
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
    
    bot.once('login', () => {
        console.log(`[✓] Connected!`);
        reconnectAttempts = 0;
        
        // Send login command after 5 seconds
        setTimeout(() => {
            console.log('[1] Sending /login roshroy12...');
            bot.chat('/login roshroy12');
        }, 5000);
    });
    
    bot.on('message', (message) => {
        const msg = message.toString();
        console.log(`[Chat] ${msg}`);
        
        // Check for login success (multiple variations)
        if (msg.includes('Logged in successfully') || 
            msg.includes('Successfully logged in') || 
            msg.includes('Logged-in due to Session') ||
            msg.includes('login successful')) {
            console.log('[✓] Login detected!');
            isLoggedIn = true;
            
            // Wait 5 seconds after login, then switch to survival
            setTimeout(() => {
                if (!survivalSwitched) {
                    console.log('[2] Sending /server survival...');
                    bot.chat('/server survival');
                    survivalSwitched = true;
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
                setTimeout(() => bot.chat(`Pos: ${Math.floor(pos.x)} ${Math.floor(pos.y)} ${Math.floor(pos.z)}`), 1000);
            }
            if (msg.toLowerCase().includes('!uptime')) {
                const uptime = (Date.now() - botStartTime) / 1000;
                setTimeout(() => bot.chat(`Uptime: ${formatUptime(uptime)}`), 1000);
            }
            if (msg.toLowerCase().includes('!survival')) {
                setTimeout(() => bot.chat('/server survival'), 1000);
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
        scheduleReconnect();
    });
    
    bot.on('error', (err) => {
        if (!err.message.includes('PartialReadError')) {
            console.log(`[Error] ${err.message}`);
        }
        scheduleReconnect();
    });
    
    bot.on('end', () => {
        console.log(`[Disconnected]`);
        scheduleReconnect();
    });
    
    bot.once('spawn', () => {
        console.log('[✓] Bot spawned!');
        const pos = bot.entity.position;
        console.log(`[Pos] X:${Math.floor(pos.x)} Y:${Math.floor(pos.y)} Z:${Math.floor(pos.z)}`);
    });
}

let botStartTime = Date.now();

function scheduleReconnect() {
    reconnectAttempts++;
    if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
        console.log('[!] Max attempts. Waiting 5 min...');
        reconnectAttempts = 0;
        setTimeout(() => createBot(), 300000);
        return;
    }
    
    const delay = 15000;
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
    const mode = survivalSwitched ? 'Survival ✓' : (isLoggedIn ? 'Lobby (waiting...)' : 'Logging in');
    console.log(`[❤️] Uptime: ${formatUptime(uptime)} | ${status} | ${mode}`);
}, 60000);