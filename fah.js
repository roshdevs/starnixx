const mineflayer = require('mineflayer');
const readline = require('readline');
const dns = require('dns');

let bot = null;
let reconnectTimer = null;
let isLoggedIn = false;
let survivalSwitched = false;
let resourcePackLoaded = false;

// Server options (try different ones if main is down)
const serverOptions = [
    { host: 'ind.starnixmc.xyz', port: 25565 }
];

let currentServerIndex = 0;
let botStartTime = Date.now();
let connectionStartTime = null;
let uptimeInterval = null;

// Format uptime function
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m ${secs}s`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

// Check if server is reachable
function checkServer(host, port, callback) {
    console.log(`[Check] Testing connection to ${host}:${port}...`);
    
    const socket = require('net').createConnection(port, host, () => {
        socket.destroy();
        callback(true);
    });
    
    socket.on('error', () => {
        socket.destroy();
        callback(false);
    });
    
    setTimeout(() => {
        socket.destroy();
        callback(false);
    }, 3000);
}

// Create readline interface for console input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'You > '
});

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
    console.log(`[Server] Trying server ${currentServerIndex + 1}/${serverOptions.length}`);
    
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
        connectTimeout: 10000
    });
    
    let connectionTimeout = setTimeout(() => {
        console.log(`[Timeout] Connection to ${server.host} timed out`);
        bot.end();
        tryNextServer();
    }, 15000);
    
    bot.once('login', () => {
        clearTimeout(connectionTimeout);
        connectionStartTime = Date.now();
        currentServerIndex = 0; // Reset on successful connection
        console.log(`[${new Date().toLocaleTimeString()}] ✓ Connected to ${server.host}`);
        console.log(`[Connection] Connected for: ${formatUptime(0)}`);
        
        // Send login command
        setTimeout(() => {
            console.log('[→] Sending login command...');
            bot.chat('/login roshroy12');
        }, 2000);
    });
    
    bot.on('resourcePack', (url, hash) => {
        console.log('[→] Resource pack offered, accepting...');
        resourcePackLoaded = false;
        bot.acceptResourcePack();
        
        setTimeout(() => {
            resourcePackLoaded = true;
            console.log('[✓] Resource pack accepted');
        }, 3000);
    });
    
    bot.on('message', (message) => {
        const msg = message.toString();
        
        // Log all chat messages
        console.log(`[Chat] ${msg}`);
        
        // Handle login responses
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
            console.log('[✗] Wrong password! Please check the password.');
        }
        
        if (msg.toLowerCase().includes('resource pack loaded') || msg.toLowerCase().includes('resource pack applied')) {
            console.log('[✓] Resource pack loaded');
            resourcePackLoaded = true;
        }
        
        if (msg.includes('You are now in survival mode') || msg.includes('Teleported to survival')) {
            console.log('[✓] Successfully in survival server!');
            survivalSwitched = true;
        }
        
        // Check for commands in chat
        if (msg.toLowerCase().includes(bot.username.toLowerCase())) {
            handleChatCommand(msg);
        }
    });
    
    bot.on('kicked', (reason) => {
        const reasonText = typeof reason === 'string' ? reason : JSON.stringify(reason);
        console.log(`[✗] Kicked: ${reasonText.substring(0, 200)}`);
        connectionStartTime = null;
        
        if (reasonText.includes('resource pack')) {
            console.log('[!] Resource pack issue. Retrying...');
            setTimeout(() => {
                if (bot) bot.end();
                setTimeout(() => createBot(), 5000);
            }, 1000);
        } else if (reasonText.includes('unsupported')) {
            console.log('[!] Version not supported. Using 1.20.4 instead...');
            bot.end();
            setTimeout(() => {
                createBotWithVersion('1.20.4');
            }, 3000);
        } else {
            scheduleReconnect();
        }
    });
    
    bot.on('error', (err) => {
        if (err.message.includes('PartialReadError') || 
            err.message.includes('world_particles')) {
            return;
        }
        
        console.log(`[Error] ${err.message}`);
        
        if (err.message.includes('ECONNREFUSED') || 
            err.message.includes('ENOTFOUND') ||
            err.message.includes('getaddrinfo')) {
            console.log(`[Error] Cannot reach ${server.host}`);
            tryNextServer();
        } else if (err.message.includes('ECONNRESET')) {
            scheduleReconnect();
        }
    });
    
    bot.on('end', () => {
        console.log(`[${new Date().toLocaleTimeString()}] Disconnected`);
        if (connectionStartTime) {
            const connectionDuration = (Date.now() - connectionStartTime) / 1000;
            console.log(`[Connection] Was connected for: ${formatUptime(connectionDuration)}`);
            connectionStartTime = null;
        }
        isLoggedIn = false;
        survivalSwitched = false;
        resourcePackLoaded = false;
    });
    
    bot.once('spawn', () => {
        console.log('[✓] Bot spawned in lobby');
        const pos = bot.entity.position;
        console.log(`[Position] X:${Math.floor(pos.x)} Y:${Math.floor(pos.y)} Z:${Math.floor(pos.z)}`);
        
        // Show that bot is ready
        console.log('\n╔══════════════════════════════════════════╗');
        console.log('║  Bot is ready! Type messages to chat     ║');
        console.log('║  Commands:                               ║');
        console.log('║    /pos - Get bot position               ║');
        console.log('║    /health - Check bot health            ║');
        console.log('║    /survival - Switch to survival        ║');
        console.log('║    /lobby - Go to lobby                  ║');
        console.log('║    /reconnect - Force reconnect          ║');
        console.log('║    /status - Bot status                  ║');
        console.log('║    /uptime - Show bot uptime             ║');
        console.log('║    /say <msg> - Make bot say something   ║');
        console.log('║    /servers - List available servers     ║');
        console.log('║    /switch <num> - Switch server         ║');
        console.log('║    /help - Show all commands             ║');
        console.log('╚══════════════════════════════════════════╝\n');
        
        rl.prompt();
    });
}

function createBotWithVersion(version) {
    const server = serverOptions[currentServerIndex];
    
    console.log(`\n[${new Date().toLocaleTimeString()}] Connecting with version ${version}...`);
    
    bot = mineflayer.createBot({
        host: server.host,
        port: server.port,
        username: 'RRF_GAMING',
        version: version,
        disableChatSigning: true,
        viewDistance: 'short',
        hideErrors: true
    });
    
    bot.once('login', () => {
        console.log(`[✓] Connected with version ${version}`);
        setTimeout(() => bot.chat('/login roshroy12'), 2000);
    });
    
    bot.on('error', (err) => {
        if (!err.message.includes('PartialReadError')) {
            console.log(`[Error] ${err.message}`);
        }
    });
}

function tryNextServer() {
    currentServerIndex++;
    if (currentServerIndex < serverOptions.length) {
        console.log(`[Server] Trying next server...`);
        setTimeout(() => {
            if (bot) bot.end();
            createBot();
        }, 2000);
    } else {
        console.log(`[Server] All servers failed. Retrying from start in 30 seconds...`);
        currentServerIndex = 0;
        setTimeout(() => {
            createBot();
        }, 30000);
    }
}

function switchToSurvival() {
    if (survivalSwitched) {
        return;
    }
    
    const waitTime = resourcePackLoaded ? 2000 : 5000;
    
    setTimeout(() => {
        if (!survivalSwitched && isLoggedIn && bot && bot.entity) {
            console.log('[→] Switching to survival server...');
            bot.chat('/server survival');
            
            setTimeout(() => {
                if (!survivalSwitched) {
                    console.log('[→] Retrying survival switch...');
                    bot.chat('/server survival');
                }
            }, 5000);
        }
    }, waitTime);
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

// Handle commands from chat
function handleChatCommand(message) {
    const lowerMsg = message.toLowerCase();
    
    if (lowerMsg.includes('!pos') || lowerMsg.includes('!position')) {
        const pos = bot.entity.position;
        setTimeout(() => {
            bot.chat(`I'm at X: ${Math.floor(pos.x)}, Y: ${Math.floor(pos.y)}, Z: ${Math.floor(pos.z)}`);
        }, 500);
    }
    
    if (lowerMsg.includes('!health')) {
        setTimeout(() => {
            bot.chat(`Health: ${bot.health}/20, Food: ${bot.food}/20`);
        }, 500);
    }
    
    if (lowerMsg.includes('!uptime') || lowerMsg.includes('!time')) {
        const uptime = (Date.now() - botStartTime) / 1000;
        const connectionUptime = connectionStartTime ? (Date.now() - connectionStartTime) / 1000 : 0;
        setTimeout(() => {
            bot.chat(`Bot uptime: ${formatUptime(uptime)} | Connected: ${formatUptime(connectionUptime)}`);
        }, 500);
    }
    
    if (lowerMsg.includes('!hello') || lowerMsg.includes('!hi')) {
        setTimeout(() => {
            bot.chat(`Hello! I'm ${bot.username}`);
        }, 500);
    }
    
    if (lowerMsg.includes('!help')) {
        setTimeout(() => {
            bot.chat(`Commands: !pos, !health, !uptime, !hello`);
        }, 500);
    }
}

// Handle console commands
function handleConsoleCommand(command) {
    const parts = command.split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);
    
    switch(cmd) {
        case 'pos':
            const pos = bot.entity.position;
            console.log(`[Bot Position] X: ${Math.floor(pos.x)}, Y: ${Math.floor(pos.y)}, Z: ${Math.floor(pos.z)}`);
            break;
            
        case 'health':
            console.log(`[Bot Status] Health: ${bot.health}/20, Food: ${bot.food}/20`);
            break;
            
        case 'survival':
            console.log('[Command] Switching to survival...');
            bot.chat('/server survival');
            break;
            
        case 'lobby':
            console.log('[Command] Returning to lobby...');
            bot.chat('/server lobby');
            break;
            
        case 'reconnect':
            console.log('[Command] Forcing reconnect...');
            bot.end();
            break;
            
        case 'servers':
            console.log('\n[Available Servers]');
            serverOptions.forEach((server, i) => {
                console.log(`  ${i + 1}. ${server.host}:${server.port} ${i === currentServerIndex ? '(current)' : ''}`);
            });
            console.log('');
            break;
            
        case 'switch':
            if (args[0]) {
                const index = parseInt(args[0]) - 1;
                if (index >= 0 && index < serverOptions.length) {
                    currentServerIndex = index;
                    console.log(`[Server] Switching to ${serverOptions[index].host}`);
                    bot.end();
                } else {
                    console.log(`[Error] Invalid server number. Use /servers to see available servers.`);
                }
            }
            break;
            
        case 'uptime':
            const totalUptime = (Date.now() - botStartTime) / 1000;
            const connectionUptime = connectionStartTime ? (Date.now() - connectionStartTime) / 1000 : 0;
            console.log(`\n[Bot Uptime]`);
            console.log(`  Bot process running: ${formatUptime(totalUptime)}`);
            console.log(`  Current connection: ${connectionStartTime ? formatUptime(connectionUptime) : 'Not connected'}`);
            console.log(`  Bot start time: ${new Date(botStartTime).toLocaleString()}`);
            console.log(`  Current time: ${new Date().toLocaleString()}`);
            console.log(`  Server: ${serverOptions[currentServerIndex].host}`);
            console.log(`  Version: 1.21.4\n`);
            break;
            
        case 'status':
            const uptime = (Date.now() - botStartTime) / 1000;
            const connUptime = connectionStartTime ? (Date.now() - connectionStartTime) / 1000 : 0;
            console.log(`\n[Bot Status]`);
            console.log(`  Connected: ${!!bot && bot.entity}`);
            console.log(`  Server: ${serverOptions[currentServerIndex].host}`);
            console.log(`  Logged in: ${isLoggedIn}`);
            console.log(`  Survival: ${survivalSwitched}`);
            console.log(`  Resource Pack: ${resourcePackLoaded}`);
            console.log(`  Health: ${bot.health}/20`);
            console.log(`  Food: ${bot.food}/20`);
            if (bot.entity) {
                const pos2 = bot.entity.position;
                console.log(`  Position: ${Math.floor(pos2.x)} ${Math.floor(pos2.y)} ${Math.floor(pos2.z)}`);
            }
            console.log(`  Bot Uptime: ${formatUptime(uptime)}`);
            console.log(`  Connection Uptime: ${connUptime > 0 ? formatUptime(connUptime) : 'N/A'}\n`);
            break;
            
        case 'say':
            if (args.length > 0) {
                const message = args.join(' ');
                bot.chat(message);
                console.log(`[Bot] ${message}`);
            }
            break;
            
        case 'help':
            console.log('\n[Available Commands]');
            console.log('  /pos           - Get bot position');
            console.log('  /health        - Check bot health and food');
            console.log('  /survival      - Switch to survival server');
            console.log('  /lobby         - Return to lobby');
            console.log('  /reconnect     - Force reconnect');
            console.log('  /uptime        - Show bot uptime');
            console.log('  /status        - Show detailed bot status');
            console.log('  /servers       - List available servers');
            console.log('  /switch <num>  - Switch to different server');
            console.log('  /say <message> - Make bot say something');
            console.log('  /help          - Show this help');
            console.log('\n[Chat Commands] (when mentioned)');
            console.log('  !pos          - Bot tells position');
            console.log('  !health       - Bot tells health');
            console.log('  !uptime       - Bot tells uptime');
            console.log('  !hello        - Bot says hello');
            console.log('  !help         - Bot shows help');
            console.log('');
            break;
            
        default:
            console.log('[Unknown command] Type /help for available commands');
    }
}

// Handle console input
rl.on('line', (input) => {
    const message = input.trim();
    
    if (!bot || !bot.entity) {
        console.log('[Error] Bot not connected yet!');
        rl.prompt();
        return;
    }
    
    if (message.startsWith('/')) {
        const command = message.substring(1);
        handleConsoleCommand(command);
    } else if (message.length > 0) {
        console.log(`[You] ${message}`);
        bot.chat(message);
    }
    
    rl.prompt();
});

rl.on('close', () => {
    console.log('\n[Bot] Shutting down...');
    if (uptimeInterval) clearInterval(uptimeInterval);
    if (bot) bot.end();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n[Bot] Shutting down...');
    if (uptimeInterval) clearInterval(uptimeInterval);
    if (bot) bot.end();
    rl.close();
    setTimeout(() => process.exit(0), 1000);
});

// Start uptime tracking
function startUptimeTracking() {
    if (uptimeInterval) clearInterval(uptimeInterval);
    uptimeInterval = setInterval(() => {
        if (process.platform === 'win32' && botStartTime) {
            try {
                const uptime = (Date.now() - botStartTime) / 1000;
                process.title = `Minecraft Bot - Uptime: ${formatUptime(uptime)}`;
            } catch(e) {}
        }
    }, 1000);
}

startUptimeTracking();

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
console.log('║   • Multi-server fallback               ║');
console.log('║   • Chat control                        ║');
console.log('╚══════════════════════════════════════════╝\n');

createBot();