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

// Helper to scan channel members and update tracking
function syncChannelMembers() {
    const channel = client.channels.cache.get(config.targetVoiceChannelId);
    if (channel && channel.isVoice()) {
        console.log(`[SYNC] Scanning ${channel.members.size} members...`);
        channel.members.forEach(member => {
            if (config.trackedUserIds.includes(member.id) && member.id !== config.hydraseiId) {
                if (!userJoinTimes.has(member.id)) {
                    userJoinTimes.set(member.id, Date.now());
                    console.log(`[SYNC] Started tracking: ${member.user.tag}`);
                }
            }
        });
    } else {
        console.log(`[ERROR] Target Voice Channel ${config.targetVoiceChannelId} not found/accessible.`);
    }
}

client.on('ready', async () => {
    console.log(`[STATUS] Logged in as ${client.user.tag}`);
    
    // 1. Initial Sync
    setTimeout(syncChannelMembers, 5000);

    // 2. Periodic 5-minute Health Check/Sync
    setInterval(() => {
        console.log(`[HEARTBEAT] Tracking ${userJoinTimes.size} users.`);
        syncChannelMembers();
    }, 300000); // 300,000ms = 5 minutes
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    const userId = newState.member.id;

    // Music Trigger
    if (config.jockieBotIds.includes(userId)) {
        if (oldState.channelId === config.targetVoiceChannelId && newState.channelId === null) {
            console.log(`[MUSIC] Jockie Bot left. Triggering sequence.`);
            const textChannel = client.channels.cache.get(config.targetTextChannelId);
            if (textChannel) {
                await textChannel.send(`m!play ${config.musicLink}`);
                setTimeout(() => textChannel.send('m!shuffle'), 4000);
                setTimeout(() => textChannel.send('m!loop'), 8000);
            }
        }
    }

    // User Tracking
    if (config.trackedUserIds.includes(userId) && userId !== config.hydraseiId) {
        if (newState.channelId === config.targetVoiceChannelId) {
            if (!userJoinTimes.has(userId)) {
                userJoinTimes.set(userId, Date.now());
                console.log(`[TRACK] ${newState.member.user.tag} joined.`);
            }
        } else if (oldState.channelId === config.targetVoiceChannelId) {
            userJoinTimes.delete(userId);
            console.log(`[TRACK] ${newState.member.user.tag} left.`);
            try {
                const owner = await client.users.fetch(config.ownerId);
                await owner.send(`⚠️ **Alert:** \`${newState.member.user.tag}\` left the VC.`);
            } catch (e) { console.error("[ERROR] Failed to DM owner."); }
        }
    }
});

client.on('messageCreate', async (message) => {
    // Show us exactly what the bot sees
    console.log(`[DEBUG] Received msg from ${message.author.tag}: ${message.content}`);

    if (message.author.id !== client.user.id) return;
    
    if (message.content.includes(`${config.prefix}uptime`)) {
        console.log("[CMD] Processing uptime request...");
        let report = "📊 **Uptime & XP Report:**\n";
        
        if (userJoinTimes.size === 0) report += "No tracked users in VC.";
        
        userJoinTimes.forEach((joinTime, userId) => {
            const mins = Math.floor((Date.now() - joinTime) / 60000);
            report += `<@${userId}>: ${mins}m (${Math.floor(mins / 3)} XP)\n`;
        });

        // Send to channel so you can see it's working, then DM
        await message.channel.send(report); 
        try {
            const owner = await client.users.fetch(config.ownerId);
            await owner.send(report);
            await message.delete().catch(() => {});
        } catch (e) { console.error("[ERROR] Could not DM owner."); }
    }
});

client.login(config.token);
