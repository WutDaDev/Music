require('dotenv').config();
const { Client } = require('discord.js-selfbot-v13');
const moment = require('moment-timezone'); // Make sure to: npm install moment-timezone

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

// Helper: Delay function for "tutu" (step-by-step) sending
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function sendMusicSequence() {
    const channel = client.channels.cache.get(config.targetTextChannelId);
    if (!channel) return console.log("[ERROR] Text channel not found.");

    console.log("[MUSIC] Sending sequence with delays...");
    await channel.send(`m!play ${config.musicLink}`);
    await sleep(4000); // Wait 4s
    await channel.send('m!shuffle');
    await sleep(4000); // Wait 4s
    await channel.send('m!loop');
    console.log("[MUSIC] Sequence finished.");
}

function updateTracking() {
    const channel = client.channels.cache.get(config.targetVoiceChannelId);
    if (!channel || !channel.isVoice()) return;
    
    channel.members.forEach(member => {
        if (config.trackedUserIds.includes(member.id)) {
            // If we don't have them yet, mark their start time as 00:00:00 GMT+7
            if (!userJoinTimes.has(member.id)) {
                const startOfDay = moment().tz("Asia/Bangkok").startOf('day').valueOf();
                userJoinTimes.set(member.id, startOfDay);
            }
        }
    });
}

client.on('ready', () => console.log(`[STATUS] Logged in as ${client.user.tag}`));

client.on('messageCreate', async (message) => {
    if (message.channel.type !== 'DM' || message.author.id !== config.ownerId) return;

    // Trigger Music manually
    if (message.content.includes(`${config.prefix}um`)) {
        await message.channel.send("⏳ Đang gửi lệnh nhạc...");
        await sendMusicSequence();
        await message.channel.send("✅ Đã gửi xong.");
    }

    // Uptime report
    if (message.content.includes(`${config.prefix}uptime`)) {
        updateTracking();
        let report = "📊 **Báo cáo từ 00:00 GMT+7:**\n";
        
        userJoinTimes.forEach((startTime, userId) => {
            const durationMs = Date.now() - startTime;
            const hours = Math.floor(durationMs / 3600000);
            const mins = Math.floor((durationMs % 3600000) / 60000);
            report += `<@${userId}>: ${hours}h ${mins}m\n`;
        });
        await message.channel.send(report);
    }
});

client.login(config.token);
