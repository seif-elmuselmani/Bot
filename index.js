/**
 * Localized SaveTimePro_bot Entry Point (Arabic) - Refactored & Modularized
 * Initializes configuration, establishes database connection, registers Telegraf middlewares,
 * hooks admin action callbacks & delivery reply listeners, loads admin/user command modules,
 * and launches the Telegram bot with a keep-alive HTTP server.
 */

// Load environment variables
require('dotenv').config();

const { Telegraf } = require('telegraf');
const connectDB = require('./config/db');

// Import Middlewares and Scenes Stage
const { registerMiddlewares } = require('./bot/middlewares');

// Import Actions & Delivery Handlers
const { registerAdminActions } = require('./bot/actions/adminActions');
const { setupAdminDelivery } = require('./bot/handlers/adminDelivery');

// Import Commands Modules
const { registerAdminCommands } = require('./bot/commands/admin');
const { registerUserCommands } = require('./bot/commands/user');

const botToken = process.env.BOT_TOKEN;
if (!botToken) {
  console.error('CRITICAL: BOT_TOKEN is missing in environment variables.');
  process.exit(1);
}

// Initialize Telegraf Bot
const bot = new Telegraf(botToken);

// Connect to MongoDB Database
connectDB();

// Register global bot error handler to catch promise rejections and Telegram API errors
bot.catch(async (err, ctx) => {
  console.error(`🔴 Telegraf Error [Update ID: ${ctx?.update?.update_id || 'unknown'}]:`, err);
  
  if (err.description) {
    console.error(`   - Description: ${err.description}`);
  }
  if (err.code) {
    console.error(`   - Code: ${err.code}`);
  }

  // Attempt to notify admins about critical errors
  try {
    const adminGroupId = process.env.ADMIN_GROUP_ID;
    if (adminGroupId) {
      const errMsgClean = (err.message || 'Unknown Error').replace(/[*_`[\]()]/g, '\\$&');
      const errNameClean = (err.name || 'Error').replace(/[*_`[\]()]/g, '\\$&');
      
      const errorText = 
        `⚠️ *تنبيه: حدث خطأ في النظام*\n\n` +
        `• *رقم التحديث:* \`${ctx?.update?.update_id || 'unknown'}\`\n` +
        `• *نوع الخطأ:* \`${errNameClean}\`\n` +
        `• *الرسالة:* \`${errMsgClean}\`\n\n` +
        `يرجى مراجعة سجلات السيرفر (Logs) لمعرفة التفاصيل كاملة.`;
      
      await ctx.telegram.sendMessage(adminGroupId, errorText, { parse_mode: 'Markdown' }).catch(() => {});
    }
  } catch (notifyErr) {
    console.error('Failed to notify admin group of error:', notifyErr.message);
  }
});

// 1. Register Middlewares & Stage Scenes
registerMiddlewares(bot);

// 2. Register Callback Actions Listeners (Recharge Approvals)
registerAdminActions(bot);

// 3. Register Admin Delivery Reply Listeners
setupAdminDelivery(bot);

// 4. Register Admin Commands & Admin Hears triggers
registerAdminCommands(bot);

// 5. Register User Commands & User Hears triggers
registerUserCommands(bot);

// Register Telegram commands menu list
bot.telegram.setMyCommands([
  { command: 'start', description: 'بدء تشغيل البوت وتحديث الحساب' },
  { command: 'services', description: 'عرض قائمة الخدمات المتاحة' },
  { command: 'recharge', description: 'شحن نقاط المحفظة' },
  { command: 'instructions', description: '📌 تعليمات وطريقة استخدام البوت' },
  { command: 'profile', description: 'استعراض بيانات حسابك ورصيدك' },
  { command: 'promo', description: 'تفعيل أكواد الهدايا والنقاط' },
  { command: 'help', description: 'دليل المساعدة وعرض الأوامر المتاحة' }
]).then(() => {
  console.log('✅ Bot commands menu registered successfully.');
}).catch((error) => {
  console.error('Failed to register bot commands menu:', error);
});

// Simple HTTP server for Render's health checks and to keep the bot alive
const http = require('http');
const port = process.env.PORT || 7860;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('SaveTimePro Bot is running! 🤖');
});

server.listen(port, () => {
  console.log(`📡 Keep-alive HTTP server listening on port ${port}`);
});

// Launch Bot
bot.launch().then(() => {
  console.log('🤖 SaveTimePro Bot has launched and is listening for updates.');
}).catch((error) => {
  console.error('Failed to launch Telegram bot:', error);
});

// Enable graceful stop
const shutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  bot.stop(signal);
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
  }
  process.exit(0);
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
