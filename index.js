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
    console.log(`[READY] Logged in as ${client.user.tag}`);
    
    setTimeout(() => {
        const channel = client.channels.cache.get(config.targetVoiceChannelId);
        if (channel && channel.isVoice()) {
            channel.members.forEach(member => {
                if (config.trackedUserIds.includes(member.id) && member.id !== config.hydraseiId) {
                    userJoinTimes.set(member.id, Date.now());
                    console.log(`[TRACK] Tracking ${member.user.tag}`);
                }
            });
            console.log(`[READY] Initial tracking count: ${userJoinTimes.size}`);
        }
    }, 5000);
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    const userId = newState.member.id;

    // Jockie Bot Logic
    if (config.jockieBotIds.includes(userId)) {
        if (oldState.channelId === config.targetVoiceChannelId && newState.channelId === null) {
            console.log("[MUSIC] Detected Jockie Bot leaving. Triggering sequence.");
            startMusicSequence();
        }
        return;
    }

    // User Tracking
    if (config.trackedUserIds.includes(userId) && userId !== config.hydraseiId) {
        if (newState.channelId === config.targetVoiceChannelId && oldState.channelId !== config.targetVoiceChannelId) {
            userJoinTimes.set(userId, Date.now());
            console.log(`[TRACK] ${newState.member.user.tag} joined.`);
        } 
        else if (oldState.channelId === config.targetVoiceChannelId && newState.channelId !== config.targetVoiceChannelId) {
            userJoinTimes.delete(userId);
            console.log(`[TRACK] ${newState.member.user.tag} left.`);
            try {
                const owner = await client.users.fetch(config.ownerId);
                await owner.send(`⚠️ **Alert:** \`${newState.member.user.tag}\` has left the voice channel.`);
            } catch (e) { console.error("[ERROR] Failed to DM owner:", e); }
        }
    }
});

async function startMusicSequence() {
    const textChannel = client.channels.cache.get(config.targetTextChannelId);
    if (!textChannel) return console.log("[ERROR] Text channel not found.");

    await textChannel.send(`m!play ${config.musicLink}`);
    setTimeout(() => textChannel.send('m!shuffle'), 4000);
    setTimeout(() => textChannel.send('m!loop'), 8000);
    console.log("[MUSIC] Music sequence sent.");
}

client.on('messageCreate', async (message) => {
    // Only respond to your own messages
    if (message.author.id !== client.user.id) return;
    
    // Debugging: Log every message sent
    if (message.content.startsWith(config.prefix)) {
        console.log(`[CMD] Detected command: ${message.content}`);
    }
    
    if (message.content.trim() === `${config.prefix}uptime`) {
        console.log("[CMD] Uptime report requested.");
        let report = "📊 **Uptime & XP Report:**\n";
        const now = Date.now();
        
        if (userJoinTimes.size === 0) report += "No tracked users currently in VC.";
        
        userJoinTimes.forEach((joinTime, userId) => {
            const mins = Math.floor((now - joinTime) / 60000);
            const xp = Math.floor(mins / 3);
            report += `<@${userId}>: ${mins} mins -> **${xp} XP**\n`;
        });

        try {
            const owner = await client.users.fetch(config.ownerId);
            await owner.send(report);
            console.log("[CMD] Uptime report sent to owner.");
            await message.delete().catch(() => {});
        } catch (e) { 
            console.error("[ERROR] Could not send DM:", e);
            message.reply("Error: Could not DM owner. Check console.");
        }
    }
});

client.login(config.token);
