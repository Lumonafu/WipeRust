const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const fs = require('fs');

const CONFIG = {
    // Usamos process.env para que GitHub Secrets inyecte el token
    TOKEN: process.env.DISCORD_TOKEN, 
    SERVER_ID: '31263425', 
    CHANNEL_ID: '1467859052473225332', // Pon aquí tus IDs reales o usa variables de entorno
    ROLE_TO_PING: '1467859098979795151',
    ROLES_TO_REMOVE: ['1467859359144087646', '1467859416945659924'] 
};

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const DB_FILE = './lastWipe.json';

async function runCheck() {
    try {
        console.log('Consultando BattleMetrics...');
        const response = await axios.get(`https://api.battlemetrics.com/servers/${CONFIG.SERVER_ID}`);
        const serverData = response.data.data;
        const lastWipeTime = serverData.attributes.details.rust_last_wipe;

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
                await channel.send({
                    content: `||<@&${CONFIG.ROLE_TO_PING}>|| \n# 🚨 ¡SERVIDOR WIPEADO! 🚨\n\nEl servidor **[LATAM] SOLO NOOB** acaba de hacer Wipe.\n\n**Mapa:** ${serverData.attributes.details.map}\n**Seed:** ${serverData.attributes.details.rust_headerimage}\n\n¡A conectarse! 🔫\nhttps://www.battlemetrics.com/servers/rust/${CONFIG.SERVER_ID}`
                });
            }

            // 2. Borrar roles (Cuidado con los límites de tiempo de GitHub Actions)
            const guild = channel.guild;
            await guild.members.fetch(); 
            
            for (const roleId of CONFIG.ROLES_TO_REMOVE) {
                const role = guild.roles.cache.get(roleId);
                if (role) {
                    console.log(`Eliminando rol ${role.name} de los usuarios...`);
                    // Usamos un bucle for...of para poder usar await y no saturar
                    for (const [memberId, member] of role.members) {
                        await member.roles.remove(role).catch(e => console.log(`No pude quitar rol a ${member.user.tag}`));
                    }
                }
            }

            // 3. Guardar nueva fecha en el archivo JSON
            fs.writeFileSync(DB_FILE, JSON.stringify({ date: lastWipeTime }));
            console.log('Base de datos actualizada.');
        } else {
            console.log('No hay wipe nuevo. Terminando.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        // MUY IMPORTANTE: Matar el proceso para que la Acción de GitHub termine
        console.log('Cerrando proceso.');
        process.exit(0);
    }
}

// Ejecutar directamente
runCheck();