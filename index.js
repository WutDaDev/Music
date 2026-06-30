require('dotenv').config();
const { Client } = require('discord.js-selfbot-v13');
const client = new Client({ checkUpdate: false });

const config = {
    token: process.env.DISCORD_TOKEN,
    ownerId: process.env.OWNER_ID,
    targetVoiceChannelId: process.env.TARGET_VOICE_CHANNEL_ID,
    targetTextChannelId: process.env.TARGET_TEXT_CHANNEL_ID,
    musicLink: process.env.MUSIC_LINK,
    prefix: process.env.PREFIX,
    hydraseiId: process.env.HYDRASEI_ID,
    jockieBotIds: process.env.JOCKIE_BOT_IDS.split(','),
    trackedUserIds: process.env.TRACKED_USER_IDS.split(',')
};

const userJoinTimes = new Map();

client.on('ready', async () => {
    console.log(`Selfbot logged in as ${client.user.tag}`);
    
    // Initial population of the tracker
    setTimeout(() => {
        const channel = client.channels.cache.get(config.targetVoiceChannelId);
        if (channel && channel.type === 'GUILD_VOICE') {
            channel.members.forEach(member => {
                if (config.trackedUserIds.includes(member.id) && member.id !== config.hydraseiId) {
                    userJoinTimes.set(member.id, Date.now());
                }
            });
            console.log(`Initialized tracking for ${userJoinTimes.size} users.`);
        }
    }, 5000);
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    const userId = newState.member.id;

    // Jockie Bot Logic
    if (config.jockieBotIds.includes(userId)) {
        if (oldState.channelId === config.targetVoiceChannelId && newState.channelId === null) {
            console.log("Jockie bot left. Executing sequence.");
            startMusicSequence();
        }
        return;
    }

    // Track/Alert Logic for specific users
    if (config.trackedUserIds.includes(userId) && userId !== config.hydraseiId) {
        // User joined
        if (newState.channelId === config.targetVoiceChannelId && oldState.channelId !== config.targetVoiceChannelId) {
            userJoinTimes.set(userId, Date.now());
        }
        // User left
        if (oldState.channelId === config.targetVoiceChannelId && newState.channelId !== config.targetVoiceChannelId) {
            userJoinTimes.delete(userId);
            try {
                const owner = await client.users.fetch(config.ownerId);
                await owner.send(`⚠️ **Alert:** \`${newState.member.user.tag}\` has left the voice channel.`);
            } catch (e) { console.error("Could not DM owner."); }
        }
    }
});

async function startMusicSequence() {
    const textChannel = client.channels.cache.get(config.targetTextChannelId);
    if (!textChannel) return;

    await textChannel.send(`m!play ${config.musicLink}`);
    setTimeout(() => textChannel.send('m!shuffle'), 4000);
    setTimeout(() => textChannel.send('m!loop'), 8000);
}

client.on('messageCreate', async (message) => {
    if (message.author.id !== client.user.id || !message.content.startsWith(config.prefix)) return;
    
    if (message.content.startsWith(config.prefix + 'uptime')) {
        let report = "📊 **Uptime & XP Report:**\n";
        const now = Date.now();
        
        userJoinTimes.forEach((joinTime, userId) => {
            const mins = Math.floor((now - joinTime) / 60000);
            const xp = Math.floor(mins / 3);
            report += `<@${userId}>: ${mins} mins -> **${xp} XP**\n`;
        });

        try {
            const owner = await client.users.fetch(config.ownerId);
            await owner.send(report);
            message.delete().catch(() => {});
        } catch (e) { console.error("Could not send DM."); }
    }
});

client.login(config.token);
