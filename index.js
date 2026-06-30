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

function syncChannelMembers() {
    const channel = client.channels.cache.get(config.targetVoiceChannelId);
    if (channel && channel.isVoice()) {
        channel.members.forEach(member => {
            if (config.trackedUserIds.includes(member.id) && member.id !== config.hydraseiId) {
                if (!userJoinTimes.has(member.id)) {
                    userJoinTimes.set(member.id, Date.now());
                }
            }
        });
    }
}

client.on('ready', async () => {
    console.log(`[STATUS] Logged in as ${client.user.tag}`);
    setTimeout(syncChannelMembers, 5000);
    setInterval(() => {
        console.log(`[HEARTBEAT] Tracking ${userJoinTimes.size} users.`);
        syncChannelMembers();
    }, 300000);
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    const userId = newState.member.id;

    if (config.jockieBotIds.includes(userId)) {
        if (oldState.channelId === config.targetVoiceChannelId && newState.channelId === null) {
            const textChannel = client.channels.cache.get(config.targetTextChannelId);
            if (textChannel) {
                await textChannel.send(`m!play ${config.musicLink}`);
                setTimeout(() => textChannel.send('m!shuffle'), 4000);
                setTimeout(() => textChannel.send('m!loop'), 8000);
            }
        }
    }

    if (config.trackedUserIds.includes(userId) && userId !== config.hydraseiId) {
        if (newState.channelId === config.targetVoiceChannelId) {
            if (!userJoinTimes.has(userId)) userJoinTimes.set(userId, Date.now());
        } else if (oldState.channelId === config.targetVoiceChannelId) {
            userJoinTimes.delete(userId);
            try {
                const owner = await client.users.fetch(config.ownerId);
                await owner.send(`⚠️ **Alert:** \`${newState.member.user.tag}\` left the VC.`);
            } catch (e) {}
        }
    }
});

client.on('messageCreate', async (message) => {
    if (message.channel.type !== 'DM' || message.author.id !== config.ownerId) return;

    if (message.content.includes(`${config.prefix}uptime`)) {
        let report = "📊 **Uptime & XP Report:**\n";
        if (userJoinTimes.size === 0) report += "No tracked users in VC.";
        userJoinTimes.forEach((joinTime, userId) => {
            const mins = Math.floor((Date.now() - joinTime) / 60000);
            report += `<@${userId}>: ${mins}m (${Math.floor(mins / 3)} XP)\n`;
        });
        await message.channel.send(report);
    }
});

client.login(config.token);
