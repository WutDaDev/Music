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
    jockieBotIds: process.env.JOCKIE_BOT_IDS.split(','),
    trackedUserIds: process.env.TRACKED_USER_IDS.split(',')
};

const userJoinTimes = new Map();

// This function ONLY tracks people currently inside the VC
function updateTracking() {
    const channel = client.channels.cache.get(config.targetVoiceChannelId);
    if (!channel || !channel.isVoice()) return;

    // Remove users who left
    userJoinTimes.forEach((_, userId) => {
        if (!channel.members.has(userId)) {
            userJoinTimes.delete(userId);
        }
    });

    // Add users who are in VC
    channel.members.forEach(member => {
        if (config.trackedUserIds.includes(member.id) && !userJoinTimes.has(member.id)) {
            userJoinTimes.set(member.id, Date.now());
        }
    });
}

client.on('ready', async () => {
    console.log(`[STATUS] Logged in as ${client.user.tag}`);
    // Check every 30 seconds to ensure the tracking is "real"
    setInterval(updateTracking, 30000);
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    // 1. Music Trigger Logic
    // Trigger only if a Jockie bot leaves the target channel
    if (config.jockieBotIds.includes(newState.member.id)) {
        if (oldState.channelId === config.targetVoiceChannelId && newState.channelId === null) {
            console.log("[MUSIC] Jockie left. Executing sequence.");
            const channel = client.channels.cache.get(config.targetTextChannelId);
            if (channel) {
                await channel.send(`m!play ${config.musicLink}`);
                setTimeout(() => channel.send('m!shuffle'), 3000);
                setTimeout(() => channel.send('m!loop'), 6000);
            } else {
                console.log("[ERROR] Cannot send music command: Text channel not found/cached.");
            }
        }
    }
    
    // 2. Tracking Logic handled by updateTracking
    updateTracking();
});

client.on('messageCreate', async (message) => {
    if (message.channel.type !== 'DM' || message.author.id !== config.ownerId) return;

    if (message.content.includes(`${config.prefix}uptime`)) {
        updateTracking(); // Force refresh before reporting
        let report = "📊 **User Session Report:**\n";
        if (userJoinTimes.size === 0) report += "No tracked users currently in VC.";
        userJoinTimes.forEach((joinTime, userId) => {
            const mins = Math.floor((Date.now() - joinTime) / 60000);
            report += `<@${userId}>: Online for ${mins}m\n`;
        });
        await message.channel.send(report);
    }
});

client.login(config.token);
