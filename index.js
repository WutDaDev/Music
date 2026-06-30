require('dotenv').config();
const { Client } = require('discord.js-selfbot-v13');

const client = new Client({ checkUpdate: false });

const config = {
    token: process.env.DISCORD_TOKEN,
    ownerId: process.env.OWNER_ID,
    targetVoiceChannelId: process.env.TARGET_VOICE_CHANNEL_ID,
    targetTextChannelId: process.env.TARGET_TEXT_CHANNEL_ID,
    musicLink: process.env.MUSIC_LINK,
    prefix: process.env.PREFIX || '!',
    hydraseiId: process.env.HYDRASEI_ID,
    jockieBotIds: process.env.JOCKIE_BOT_IDS.split(','),
    trackedUserIds: process.env.TRACKED_USER_IDS.split(',')
};

const userJoinTimes = new Map();

client.on('ready', async () => {
    console.log(`[STATUS] Bot logged in as ${client.user.tag}`);
    
    // Heartbeat to confirm process is running
    setInterval(() => {
        console.log(`[HEARTBEAT] Active. Tracking ${userJoinTimes.size} users.`);
    }, 60000);
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    const userId = newState.member.id;

    // Music Trigger
    if (config.jockieBotIds.includes(userId) && oldState.channelId === config.targetVoiceChannelId && newState.channelId === null) {
        const textChannel = client.channels.cache.get(config.targetTextChannelId);
        if (textChannel) {
            await textChannel.send(`m!play ${config.musicLink}`);
            setTimeout(() => textChannel.send('m!shuffle'), 4000);
            setTimeout(() => textChannel.send('m!loop'), 8000);
        }
    }

    // Tracking
    if (config.trackedUserIds.includes(userId) && userId !== config.hydraseiId) {
        if (newState.channelId === config.targetVoiceChannelId) {
            userJoinTimes.set(userId, Date.now());
        } else {
            userJoinTimes.delete(userId);
        }
    }
});

client.on('messageCreate', async (message) => {
    // Basic command filter
    if (message.author.id !== client.user.id) return;
    
    if (message.content.includes(`${config.prefix}uptime`)) {
        console.log("[CMD] Uptime triggered");
        let report = "📊 **Uptime Report:**\n";
        
        userJoinTimes.forEach((joinTime, userId) => {
            const mins = Math.floor((Date.now() - joinTime) / 60000);
            report += `<@${userId}>: ${mins}m (${Math.floor(mins / 3)} XP)\n`;
        });

        // Try channel send first to verify if logic is working
        await message.channel.send(report || "No data.");
    }
});

client.login(config.token);
