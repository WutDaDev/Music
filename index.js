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

// --- SAFETY UTILITY ---
async function safeSend(channel, text) {
    try {
        // Check permissions before attempting to send
        const permissions = channel.permissionsFor(client.user);
        if (!permissions || !permissions.has('SEND_MESSAGES')) {
            console.error(`[SAFETY] Missing SEND_MESSAGES permission in ${channel.name}`);
            return false;
        }
        await channel.send(text);
        console.log(`[SUCCESS] Message sent: ${text}`);
        return true;
    } catch (e) {
        console.error(`[SAFETY] Failed to send: ${e.message}`);
        return false;
    }
}

// --- LOGIC ---
function updateTracking() {
    const channel = client.channels.cache.get(config.targetVoiceChannelId);
    if (!channel || !channel.isVoice()) return;

    userJoinTimes.forEach((_, userId) => { if (!channel.members.has(userId)) userJoinTimes.delete(userId); });
    channel.members.forEach(member => {
        if (config.trackedUserIds.includes(member.id) && !userJoinTimes.has(member.id)) {
            userJoinTimes.set(member.id, Date.now());
        }
    });
}

client.on('ready', async () => {
    console.log(`[STATUS] Logged in as ${client.user.tag}`);
    const channel = client.channels.cache.get(config.targetTextChannelId);
    if (channel) {
        console.log(`[VERIFY] Bot has access to text channel: ${channel.name}`);
    } else {
        console.log("[CRITICAL] Bot cannot find the text channel ID!");
    }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    // Music Trigger
    if (config.jockieBotIds.includes(newState.member.id)) {
        if (oldState.channelId === config.targetVoiceChannelId && newState.channelId === null) {
            const channel = client.channels.cache.get(config.targetTextChannelId);
            if (channel) {
                // Sequential delays to avoid triggering Discord's rate-limit
                await safeSend(channel, `m!play ${config.musicLink}`);
                setTimeout(() => safeSend(channel, 'm!shuffle'), 3000);
                setTimeout(() => safeSend(channel, 'm!loop'), 6000);
            }
        }
    }
    updateTracking();
});

client.on('messageCreate', async (message) => {
    // Enforce DM only and restrict to Owner ID
    if (message.channel.type !== 'DM' || message.author.id !== config.ownerId) return;

    if (message.content.includes(`${config.prefix}uptime`)) {
        updateTracking();
        let report = "📊 **User Session Report:**\n";
        if (userJoinTimes.size === 0) report += "No tracked users in VC.";
        userJoinTimes.forEach((joinTime, userId) => {
            const mins = Math.floor((Date.now() - joinTime) / 60000);
            report += `<@${userId}>: Online for ${mins}m\n`;
        });
        await message.channel.send(report);
    }
});

client.login(config.token);
