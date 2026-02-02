require('dotenv').config(); // Agregado por si pruebas en local
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

        // CAMBIO 1: Usamos el endpoint de búsqueda (?filter[ids]) en vez del directo
        // Agregamos un timestamp random (&t=...) para obligar a que no use caché vieja
        const url = `https://api.battlemetrics.com/servers?filter[ids][]=${CONFIG.SERVER_ID}&include=server&t=${Date.now()}`;
        
        const response = await axios.get(url);
        
        // CAMBIO 2: La búsqueda devuelve un Array (lista), tomamos el primero [0]
        if (!response.data.data || response.data.data.length === 0) {
            console.log('Error: BattleMetrics no encontró el servidor.');
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
            
            // 1. Enviar mensaje
            if (channel) {
                // Preparamos datos visuales (si faltan, ponemos genéricos)
                const mapName = attributes.details.map || "Mapa Personalizado";
                const mapUrl = attributes.details.rust_headerimage || "";

                await channel.send({
                    content: `||<@&${CONFIG.ROLE_TO_PING}>|| \n# 🚨 ¡SERVIDOR WIPEADO! 🚨\n\nEl servidor **[LATAM] SOLO NOOB** acaba de hacer Wipe.\n\n**Mapa:** ${mapName}\n**Fecha:** ${new Date(lastWipeTime).toLocaleString()}\n\n¡A conectarse! 🔫\nhttps://www.battlemetrics.com/servers/rust/${CONFIG.SERVER_ID}`
                });
            }

            // 2. Borrar roles
            const guild = channel.guild;
            await guild.members.fetch(); 
            
            for (const roleId of CONFIG.ROLES_TO_REMOVE) {
                const role = guild.roles.cache.get(roleId);
                if (role) {
                    console.log(`Eliminando rol ${role.name}...`);
                    for (const [memberId, member] of role.members) {
                        await member.roles.remove(role).catch(e => console.log(`Error quitando rol a ${member.user.tag}`));
                    }
                }
            }

            // 3. Guardar nueva fecha
            fs.writeFileSync(DB_FILE, JSON.stringify({ date: lastWipeTime }));
            console.log('Base de datos actualizada.');
        } else {
            console.log('No hay wipe nuevo. Terminando.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        console.log('Cerrando proceso.');
        process.exit(0);
    }
}

runCheck();