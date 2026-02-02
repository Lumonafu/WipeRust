require('dotenv').config(); 
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const fs = require('fs');

const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    SERVER_ID: '31263425',
    CHANNEL_ID: '1467859052473225332',
    ROLE_TO_PING: '1467859098979795151',
    ROLES_TO_REMOVE: ['1467859359144087646', '1467859416945659924']
};

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const DB_FILE = './lastWipe.json';

async function runCheck() {
    try {
        console.log('Consultando BattleMetrics (Modo Búsqueda)...');

        // CAMBIO: Dejamos que axios construya la URL limpia automáticamente
        const response = await axios.get('https://api.battlemetrics.com/servers', {
            params: {
                'filter[ids]': CONFIG.SERVER_ID, // Sin los corchetes vacíos []
                'include': 'server',
                't': Date.now() // Anti-caché
            }
        });
        
        // Verificamos si la API devolvió la lista vacía
        if (!response.data.data || response.data.data.length === 0) {
            console.log('Error: BattleMetrics devolvió una lista vacía. ¿El ID es correcto?');
            return;
        }

        const serverData = response.data.data[0]; 
        const attributes = serverData.attributes;
        const lastWipeTime = attributes.details.rust_last_wipe;

        console.log(`Fecha detectada por API: ${lastWipeTime}`);

        // Leer archivo local
        let savedData = { date: "" };
        if (fs.existsSync(DB_FILE)) {
            savedData = JSON.parse(fs.readFileSync(DB_FILE));
        }

        // SI HAY WIPE NUEVO
        if (lastWipeTime && lastWipeTime !== savedData.date) {
            console.log('¡Nuevo Wipe detectado! Iniciando sesión en Discord...');
            
            await client.login(CONFIG.TOKEN);
            const channel = await client.channels.fetch(CONFIG.CHANNEL_ID);
            
            if (channel) {
                // Preparamos datos visuales
                const mapName = attributes.details.map || "Mapa Personalizado";
                
                await channel.send({
                    content: `||<@&${CONFIG.ROLE_TO_PING}>|| \n# 🚨 ¡SERVIDOR WIPEADO! 🚨\n\nEl servidor **[LATAM] SOLO NOOB** acaba de hacer Wipe.\n\n**Mapa:** ${mapName}\n**Fecha:** ${new Date(lastWipeTime).toLocaleString()}\n\n¡A conectarse! 🔫\nhttps://www.battlemetrics.com/servers/rust/${CONFIG.SERVER_ID}`
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
            console.log('Base de datos actualizada.');
        } else {
            console.log('No hay wipe nuevo. Terminando.');
        }

    } catch (error) {
        console.error('Error detallado:', error.response ? error.response.data : error.message);
    } finally {
        console.log('Cerrando proceso.');
        process.exit(0);
    }
}

runCheck();