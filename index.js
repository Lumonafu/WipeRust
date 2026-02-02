require('dotenv').config(); 
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const fs = require('fs');

const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    SERVER_ID: '31263425',
    CHANNEL_ID: '1467859052473225332',
    ROLE_TO_PING: '1467877032795967579',
    ROLE_SOLO_NOOB: '1467859098979795151',
    ROLES_TO_REMOVE: ['1467859359144087646', '1467859416945659924']
};

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const DB_FILE = './lastWipe.json';

async function runCheck() {
    try {
        console.log('Consultando BattleMetrics (ID Directo)...');

        const response = await axios.get(`https://api.battlemetrics.com/servers/${CONFIG.SERVER_ID}`);
        
        if (!response.data || !response.data.data) {
            console.log('Error: La API no devolvió datos.');
            return;
        }

        const attributes = response.data.data.attributes;
        const details = attributes.details;

        // EXTRAEMOS IP Y PUERTO AUTOMÁTICAMENTE
        const serverIP = attributes.ip;
        const serverPort = attributes.port;

        // --- DEBUG ---
        console.log('--- Datos encontrados ---');
        console.log(`rust_born:      ${details.rust_born}`);
        console.log(`IP:             ${serverIP}:${serverPort}`);
        console.log('-------------------------');

        const lastWipeTime = details.rust_born || details.rust_last_wipe;

        if (!lastWipeTime) {
            console.log('Error: No se encontró fecha de wipe.');
            return;
        }

        // Leer archivo local
        let savedData = { date: "" };
        if (fs.existsSync(DB_FILE)) {
            savedData = JSON.parse(fs.readFileSync(DB_FILE));
        }

        // --- LÓGICA DE DETECCION ---
        if (lastWipeTime !== savedData.date) {
            console.log('¡FECHA DIFERENTE DETECTADA! Iniciando alerta...');
            
            await client.login(CONFIG.TOKEN);
            const channel = await client.channels.fetch(CONFIG.CHANNEL_ID);
            
            if (channel) {
                const mapName = details.map || "Mapa Personalizado";
                
                // Formato de tiempo relativo
                const unixTime = Math.floor(new Date(lastWipeTime).getTime() / 1000);
                const discordTime = `<t:${unixTime}:R>`; 

                // Construimos el comando connect
                const connectCommand = `client.connect ${serverIP}:${serverPort}`;

                await channel.send({
                    // NOTA SOBRE EL EMOJI: 
                    // Si el bot está en el servidor donde existe :scrap:, funcionará así.
                    // Si ves que sale texto plano, necesitarás el ID: <:scrap:123456789>
                    content: `||<@&${CONFIG.ROLE_TO_PING}>|| \n# 🚨 ¡SERVIDOR WIPEADO! 🚨\n\nEl servidor <@&${CONFIG.ROLE_SOLO_NOOB}> hizo Wipe.\n\n**Mapa:** ${mapName}\n**Wipeado:** ${discordTime}\n\n¡A poppear! :scrap:\n\n\`${connectCommand}\`\nhttps://www.battlemetrics.com/servers/rust/${CONFIG.SERVER_ID}`
                });
            }

            // Borrar roles
            const guild = channel.guild;
            await guild.members.fetch(); 
            
            for (const roleId of CONFIG.ROLES_TO_REMOVE) {
                const role = guild.roles.cache.get(roleId);
                if (role) {
                    console.log(`Eliminando rol ${role.name}...`);
                    for (const [memberId, member] of role.members) {
                        await member.roles.remove(role).catch(e => console.log(`Error quitando rol`));
                    }
                }
            }

            // Guardar nueva fecha
            fs.writeFileSync(DB_FILE, JSON.stringify({ date: lastWipeTime }));
            console.log('Base de datos actualizada correctamente.');
        } else {
            console.log('La fecha es idéntica a la guardada. No hay wipe nuevo.');
        }

    } catch (error) {
        console.error('Error Fatal:', error.message);
    } finally {
        console.log('Cerrando proceso.');
        process.exit(0);
    }
}

runCheck();