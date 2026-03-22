const mineflayer = require('mineflayer')
const readline = require('readline')

const botArgs = {
  host: 'play.starnixmc.xyz',
  port: 25565,
  username: 'RRF_GAMING',
  version: false, 
  auth: 'offline',
  checkTimeoutInterval: 90000,
  hideErrors: true 
}

let bot
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

function createBot() {
  console.log("--- [SYSTEM] Connecting to StarnixMC... ---")
  bot = mineflayer.createBot(botArgs)

  bot.on('inject_allowed', () => {
    bot.physics.enabled = false 
  })

  bot.on('resourcePack', (url, hash) => {
    setTimeout(() => { bot.acceptResourcePack() }, 2500)
  })

  bot.once('spawn', () => {
    console.log("--- [STATUS] JOINED LOBBY ---")
    
    // 1. Wait 5s to spawn
    setTimeout(() => {
      bot.chat('/login roshroy12')
      console.log("--- [AUTH] Login Sent ---")
      
      // 2. Wait a full 15s for the session to "bake" into the proxy
      setTimeout(() => {
        console.log("--- [ACTION] Jumping to Survival... ---")
        bot.chat('/server survival') 

        // 3. Final physics activation after the world change
        setTimeout(() => {
          bot.physics.enabled = true
          console.log("--- [SYSTEM] Physics Active. ---")
        }, 15000)

      }, 15000) // Increased delay for session stability
    }, 5000)
  })

  bot.on('message', (jsonMsg) => {
    const msg = jsonMsg.toString().trim()
    if (msg && !msg.includes('Groundclean')) {
        console.log(`[CHAT] ${msg}`)
    }
  })

  bot.on('end', (reason) => {
    console.log(`\n[DISCONNECTED] Retrying...`)
    setTimeout(createBot, 10000)
  })
}

rl.on('line', (line) => {
  if (bot && bot.entity) bot.chat(line)
})

createBot()