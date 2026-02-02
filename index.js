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
        console.log('Consultando BattleMetrics (ID Directo)...');

        // Petición directa al ID. Sin filtros, sin errores 400.
        const response = await axios.get(`https://api.battlemetrics.com/servers/${CONFIG.SERVER_ID}`);
        
        if (!response.data || !response.data.data) {
            console.log('Error: La API no devolvió datos.');
            return;
        }

        const attributes = response.data.data.attributes;
        const details = attributes.details;

        // --- DEBUG: VERIFICACIÓN DE VARIABLES ---
        console.log('--- Datos encontrados en la API ---');
        console.log(`rust_born:      ${details.rust_born}`);
        console.log(`rust_last_wipe: ${details.rust_last_wipe}`);
        console.log('-----------------------------------');

        // USAMOS TU HALLAZGO: Priorizamos 'rust_born'
        const lastWipeTime = details.rust_born || details.rust_last_wipe;

        if (!lastWipeTime) {
            console.log('Error: No se encontró fecha de wipe en la API.');
            return;
        }

        console.log(`Fecha OFICIAL seleccionada: ${lastWipeTime}`);

        // Leer archivo local
        let savedData = { date: "" };
        if (fs.existsSync(DB_FILE)) {
            savedData = JSON.parse(fs.readFileSync(DB_FILE));
        }

        // --- LÓGICA DE DETECCION ---
        // Comparamos la fecha encontrada con la guardada
        if (lastWipeTime !== savedData.date) {
            console.log('¡FECHA DIFERENTE DETECTADA! Iniciando alerta...');
            
            await client.login(CONFIG.TOKEN);
            const channel = await client.channels.fetch(CONFIG.CHANNEL_ID);
            
            if (channel) {
                const mapName = details.map || "Mapa Personalizado";
                
                // Formateamos la fecha para que se lea bonito en Discord
                // Usamos <t:TIMESTAMP:F> para que Discord muestre la hora local de cada usuario
                const unixTime = Math.floor(new Date(lastWipeTime).getTime() / 1000);
                const discordTime = `<t:${unixTime}:R>`; // Muestra "hace X días" o "hace X minutos"

                await channel.send({
                    content: `||<@&${CONFIG.ROLE_TO_PING}>|| \n# 🚨 ¡SERVIDOR WIPEADO! 🚨\n\nEl servidor **[LATAM] SOLO NOOB** detectó un cambio.\n\n**Mapa:** ${mapName}\n**Wipeado:** ${discordTime} (${new Date(lastWipeTime).toLocaleString()})\n\n¡A conectarse! 🔫\nhttps://www.battlemetrics.com/servers/rust/${CONFIG.SERVER_ID}`
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