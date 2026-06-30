require('dotenv').config(); // Load environment variables from .env file
const { Client } = require('discord.js-selfbot-v13');
const client = new Client({ checkUpdate: false });

// Parse configurations from process.env
const config = {
    token: process.env.DISCORD_TOKEN,
    ownerId: process.env.OWNER_ID,
    targetVoiceChannelId: process.env.TARGET_VOICE_CHANNEL_ID,
    targetTextChannelId: process.env.TARGET_TEXT_CHANNEL_ID,
    musicLink: process.env.MUSIC_LINK,
    prefix: process.env.PREFIX || '!',
    hydraseiId: process.env.HYDRASEI_ID,
    // Split the comma-separated strings into clean arrays
    jockieBotIds: process.env.JOCKIE_BOT_IDS ? process.env.JOCKIE_BOT_IDS.split(',') : [],
    trackedUserIds: process.env.TRACKED_USER_IDS ? process.env.TRACKED_USER_IDS.split(',') : []
};

// Map to store the timestamp of when users join the VC
const userJoinTimes = new Map();

client.on('ready', async () => {
    console.log(`Logged in successfully as ${client.user.tag}`);
    
    // Initial scan: Track target users already sitting in the VC on startup
    const channel = client.channels.cache.get(config.targetVoiceChannelId);
    if (channel && channel.isVoice()) {
        channel.members.forEach(member => {
            if (config.trackedUserIds.includes(member.id) && member.id !== config.hydraseiId) {
                userJoinTimes.set(member.id, Date.now());
            }
        });
        console.log(`Initialized tracking for ${userJoinTimes.size} setup users in the voice channel.`);
    }
});

// ==========================================
// EVENT: VOICE STATE UPDATES
// ==========================================
client.on('voiceStateUpdate', async (oldState, newState) => {
    const userId = newState.member.id;

    // 1. Check if a Jockie Bot left the channel
    if (config.jockieBotIds.includes(userId)) {
        if (oldState.channelId === config.targetVoiceChannelId && newState.channelId === null) {
            console.log('Detected Jockie Bot leaving. Restarting music sequence...');
            startMusicSequence();
        }
        return;
    }

    // 2. Track only the specified users (Ignore anyone else, bots, and Hydrasei)
    if (config.trackedUserIds.includes(userId) && userId !== config.hydraseiId) {
        
        // User JOINED the target channel
        if (newState.channelId === config.targetVoiceChannelId && oldState.channelId !== config.targetVoiceChannelId) {
            userJoinTimes.set(userId, Date.now());
            console.log(`Started tracking: ${newState.member.user.tag}`);
        }
        
        // User LEFT the target channel
        if (oldState.channelId === config.targetVoiceChannelId && newState.channelId !== config.targetVoiceChannelId) {
            userJoinTimes.delete(userId);
            
            // Alert Owner via DM
            try {
                const owner = await client.users.fetch(config.ownerId);
                await owner.send(`🚨 **Alert:** \`${newState.member.user.tag}\` has just left the voice channel!`);
                console.log(`Alerted owner that ${newState.member.user.tag} left.`);
            } catch (err) {
                console.error('Failed to send DM to owner. Verify privacy/DM settings.');
            }
        }
    }
});

// ==========================================
// FUNCTION: RESTART MUSIC SEQUENCE
// ==========================================
async function startMusicSequence() {
    const textChannel = client.channels.cache.get(config.targetTextChannelId);
    if (!textChannel) return console.log('Error: Target text channel not found.');

    // Corrected command: just m!loop without "yes"
    await textChannel.send(`m!play ${config.musicLink}`);
    console.log(`Sent: m!play ${config.musicLink}`);

    setTimeout(async () => {
        await textChannel.send('m!shuffle');
        console.log('Sent: m!shuffle');
    }, 3000);

    setTimeout(async () => {
        await textChannel.send('m!loop');
        console.log('Sent: m!loop');
    }, 6000);
}

// ==========================================
// EVENT: MESSAGE COMMANDS (!uptime)
// ==========================================
client.on('messageCreate', async (message) => {
    if (message.author.id !== client.user.id) return;
    if (!message.content.startsWith(config.prefix)) return;

    const args = message.content.slice(config.prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'uptime') {
        let report = "📊 **Voice Channel Uptime & XP Report:**\n\n";
        const now = Date.now();
        let count = 0;

        for (const [userId, joinTime] of userJoinTimes.entries()) {
            const diffMs = now - joinTime;
            const minutes = Math.floor(diffMs / 60000); 
            const xp = Math.floor(minutes / 3); // 1 XP per 3 minutes
            
            report += `<@${userId}>: ${minutes} minutes -> **${xp} XP**\n`;
            count++;
        }

        if (count === 0) report += "*No monitored users currently in the voice channel.*";

        try {
            const owner = await client.users.fetch(config.ownerId);
            await owner.send(report);
            await message.delete().catch(() => {});
            console.log('Uptime report sent successfully.');
        } catch (err) {
            console.error('Could not send the XP report via DM.');
        }
    }
});

client.login(config.token);
