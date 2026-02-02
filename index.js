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

        const serverIP = attributes.ip;
        const serverPort = attributes.port;

        // OBTENEMOS LA IMAGEN DEL MAPA
        // Si battlemetrics tiene la imagen del mapa, la usamos.
        const mapImageUrl = "https://cdn.discordapp.com/attachments/1293720649164128257/1467905235707101337/artic.png?ex=698214c8&is=6980c348&hm=312b66fd8fcdbd820029390f85cc15e2e6a40d778a041133efef80249dd38f55&";

        // --- DEBUG ---
        console.log('--- Datos encontrados ---');
        console.log(`rust_born:      ${details.rust_born}`);
        console.log(`Mapa URL:       ${mapImageUrl ? 'Sí tiene' : 'No tiene'}`);
        console.log('-------------------------');

        const lastWipeTime = details.rust_born || details.rust_last_wipe;

        if (!lastWipeTime) {
            console.log('Error: No se encontró fecha de wipe.');
            return;
        }

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
                const unixTime = Math.floor(new Date(lastWipeTime).getTime() / 1000);
                const discordTime = `<t:${unixTime}:R>`; 
                const connectCommand = `client.connect ${serverIP}:${serverPort}`;

                // PREPARAMOS EL MENSAJE
                const messageOptions = {
                    content: `||<@&${CONFIG.ROLE_TO_PING}>|| \n# 🚨 ¡SERVIDOR WIPEADO! 🚨\n\nEl servidor <@&${CONFIG.ROLE_SOLO_NOOB}> hizo Wipe.\n\n**Mapa:** ${mapName}\n**Wipeado:** ${discordTime}\n\n¡A poppear! <:scrap:1467876485128916992>\n\n\`${connectCommand}\`\n\nhttps://www.battlemetrics.com/servers/rust/${CONFIG.SERVER_ID}`
                };

                // AGREGAMOS LA IMAGEN SOLO SI EXISTE
                if (mapImageUrl) {
                    messageOptions.files = [mapImageUrl];
                }

                await channel.send(messageOptions);
            }

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