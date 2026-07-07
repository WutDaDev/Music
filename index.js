require('dotenv').config();
const { Client } = require('discord.js-selfbot-v13');
const moment = require('moment-timezone');

const client = new Client({ checkUpdate: false });

const config = {
    token: process.env.DISCORD_TOKEN,
    ownerId: process.env.OWNER_ID,
    targetVoiceChannelId: process.env.TARGET_VOICE_CHANNEL_ID,
    targetTextChannelId: process.env.TARGET_TEXT_CHANNEL_ID,
    // Two playlist links — loaded from .env or hardcoded fallback
    musicLinks: [
        process.env.MUSIC_LINK_1 || 'https://music.youtube.com/watch?v=7FDRQifEMUQ&si=SeLYSmnu5pN4iDRf',
        process.env.MUSIC_LINK_2 || 'https://music.youtube.com/playlist?list=PLSrCGwTLHc8g&si=Fr9UUs5PXu9HFCNz'
    ],
    prefix: process.env.PREFIX || '!',
    jockieBotIds: (process.env.JOCKIE_BOT_IDS || '').split(',').filter(Boolean),
    trackedUserIds: (process.env.TRACKED_USER_IDS || '').split(',').filter(Boolean),
    autoDeleteMs: 15000 // Auto-delete music messages after 15 seconds
};

const userJoinTimes = new Map();

// Helper: Delay
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Delete a message after a delay, silently fail if already gone
async function deleteAfter(msg, ms) {
    if (!msg) return;
    await sleep(ms);
    try { await msg.delete(); } catch (_) {}
}

// Fetch voice channel text (with caching for voice-channel-bound text channels)
async function getTargetChannel() {
    let channel = client.channels.cache.get(config.targetTextChannelId);
    if (!channel) {
        try {
            channel = await client.channels.fetch(config.targetTextChannelId);
        } catch (err) {
            console.log("[ERROR] Could not fetch text channel:", err.message);
            return null;
        }
    }
    return channel;
}

// Send a message and schedule auto-delete; returns the sent message
async function sendAndScheduleDelete(channel, content, deleteMs = config.autoDeleteMs) {
    const msg = await channel.send(content);
    deleteAfter(msg, deleteMs);
    return msg;
}

// Full music start sequence: play link1 first, then link2, then shuffle + loop
async function sendMusicSequence() {
    const channel = await getTargetChannel();
    if (!channel) return console.log("[ERROR] Text channel not found.");

    console.log("[MUSIC] Starting sequence...");

    // Play first link
    const msg1 = await sendAndScheduleDelete(channel, `m!play ${config.musicLinks[0]}`);
    console.log(`[MUSIC] Sent link 1 (auto-delete in ${config.autoDeleteMs / 1000}s)`);
    await sleep(5000); // Wait for bot to process

    // Play second link (queues it)
    const msg2 = await sendAndScheduleDelete(channel, `m!play ${config.musicLinks[1]}`);
    console.log(`[MUSIC] Sent link 2 (auto-delete in ${config.autoDeleteMs / 1000}s)`);
    await sleep(5000);

    // Shuffle the queue
    const msg3 = await sendAndScheduleDelete(channel, 'm!shuffle');
    await sleep(3000);

    // Loop the queue
    const msg4 = await sendAndScheduleDelete(channel, 'm!loop queue');

    console.log("[MUSIC] Sequence complete. All messages will self-delete.");
}

// Stop command
async function sendStopCommand() {
    const channel = await getTargetChannel();
    if (!channel) return console.log("[ERROR] Text channel not found.");

    console.log("[MUSIC] Sending stop...");
    const msg = await sendAndScheduleDelete(channel, 'm!stop');
    console.log("[MUSIC] Stop sent, will auto-delete.");
}

// Track users currently in the voice channel
function updateTracking() {
    const channel = client.channels.cache.get(config.targetVoiceChannelId);
    if (!channel || !channel.isVoice()) return;

    channel.members.forEach(member => {
        if (config.trackedUserIds.includes(member.id) && !userJoinTimes.has(member.id)) {
            const startOfDay = moment().tz("Asia/Bangkok").startOf('day').valueOf();
            userJoinTimes.set(member.id, startOfDay);
        }
    });
}

client.on('ready', () => {
    console.log(`[STATUS] Logged in as ${client.user.tag}`);
    // Pre-cache the target channels on startup
    client.channels.fetch(config.targetTextChannelId).catch(() => {});
    client.channels.fetch(config.targetVoiceChannelId).catch(() => {});
});

client.on('messageCreate', async (message) => {
    if (message.channel.type !== 'DM' || message.author.id !== config.ownerId) return;

    const content = message.content.trim();

    // !um — Play music (both links, sequentially)
    if (content.startsWith(`${config.prefix}um`)) {
        const statusMsg = await message.channel.send("⏳ Đang gửi lệnh nhạc...");
        await sendMusicSequence();
        await statusMsg.delete().catch(() => {});
        const doneMsg = await message.channel.send("✅ Đã gửi xong. Các lệnh sẽ tự xóa sau 15 giây.");
        deleteAfter(doneMsg, 10000);
    }

    // !stop — Stop music
    if (content.startsWith(`${config.prefix}stop`)) {
        const statusMsg = await message.channel.send("⏹️ Đang gửi lệnh dừng nhạc...");
        await sendStopCommand();
        await statusMsg.delete().catch(() => {});
        const doneMsg = await message.channel.send("✅ Đã dừng. Lệnh sẽ tự xóa sau 15 giây.");
        deleteAfter(doneMsg, 10000);
    }

    // !uptime — Report voice time for tracked users
    if (content.startsWith(`${config.prefix}uptime`)) {
        updateTracking();
        let report = "📊 **Báo cáo từ 00:00 GMT+7:**\n";

        if (userJoinTimes.size === 0) {
            report += "_Không có dữ liệu._";
        } else {
            userJoinTimes.forEach((startTime, userId) => {
                const durationMs = Date.now() - startTime;
                const hours = Math.floor(durationMs / 3600000);
                const mins = Math.floor((durationMs % 3600000) / 60000);
                report += `<@${userId}>: ${hours}h ${mins}m\n`;
            });
        }

        await message.channel.send(report);
    }
});

client.login(config.token);
