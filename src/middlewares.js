/**
 * Bot Middlewares Registry
 * Defines security, logging, session persistence, and rate-limiting middlewares.
 * Registers the Scenes Stage.
 */

const { Scenes: { Stage } } = require('telegraf');
const Session = require('../models/Session');
const SystemConfig = require('../models/SystemConfig');
const User = require('../models/User');

const { isUserAdmin } = require('./utils/helpers');

// Load Scenes
const rechargeWizard = require('./scenes/rechargeWizard');
const gradGiftWizard = require('./scenes/gradGiftWizard');
const loveGiftWizard = require('./scenes/loveGiftWizard');

// Custom Mongoose-based persistent session middleware to preserve wizard states across bot restarts
const mongooseSession = () => {
  return async (ctx, next) => {
    if (!ctx.from || !ctx.chat) {
      ctx.session = {};
      return next();
    }

    const key = `${ctx.from.id}:${ctx.chat.id}`;

    try {
      const sessionDoc = await Session.findOne({ key });
      ctx.session = sessionDoc ? sessionDoc.data : {};
    } catch (err) {
      console.error(`Failed to fetch session for key ${key}:`, err.message);
      ctx.session = {};
    }

    const originalSessionStr = JSON.stringify(ctx.session);

    await next();

    try {
      const currentSessionStr = JSON.stringify(ctx.session);
      if (currentSessionStr !== originalSessionStr) {
        if (!ctx.session || Object.keys(ctx.session).length === 0) {
          await Session.deleteOne({ key });
        } else {
          await Session.findOneAndUpdate(
            { key },
            { data: ctx.session },
            { upsert: true, new: true }
          );
        }
      }
    } catch (err) {
      console.error(`Failed to save session for key ${key}:`, err.message);
    }
  };
};

/**
 * Registers all middlewares and Stage components on the bot instance.
 * @param {Telegraf} bot 
 */
const registerMiddlewares = (bot) => {
  // 1. Debug Logger Middleware
  bot.use(async (ctx, next) => {
    const start = Date.now();
    console.log(`📥 Received Update ${ctx.update.update_id}:`, JSON.stringify(ctx.update, null, 2));
    await next();
    const ms = Date.now() - start;
    console.log(`Update ${ctx.update.update_id} processed in ${ms}ms`);
  });

  // 2. Group Whitelist Middleware
  bot.use(async (ctx, next) => {
    const adminGroupId = process.env.ADMIN_GROUP_ID;
    const chatType = ctx.chat?.type;

    if (!chatType || chatType === 'private' || chatType === 'channel') {
      return next();
    }

    if (chatType === 'group' || chatType === 'supergroup') {
      if (adminGroupId && ctx.chat.id.toString() === adminGroupId.toString()) {
        return next();
      }

      console.warn(`⚠️ Bot detected in unauthorized group: ${ctx.chat.id} ("${ctx.chat.title}"). Leaving now.`);
      try {
        await ctx.telegram.leaveChat(ctx.chat.id);
      } catch (leaveErr) {
        console.error(`Failed to leave unauthorized group ${ctx.chat.id}:`, leaveErr.message);
      }
      return; // Drop update
    }

    return next();
  });

  // 3. User Ban Check Middleware (Processed very early)
  bot.use(async (ctx, next) => {
    if (!ctx.from) return next();
    const userId = ctx.from.id.toString();

    try {
      const user = await User.findOne({ telegramId: userId });
      if (user && user.isBanned) {
        if (ctx.callbackQuery) {
          return ctx.answerCbQuery('🚫 حسابك محظور من استخدام هذا البوت.', { show_alert: true });
        }
        return ctx.reply('🚫 حسابك محظور من استخدام هذا البوت. يرجى التواصل مع الدعم الفني.');
      }
    } catch (error) {
      console.error('Ban middleware check error:', error);
    }
    await next();
  });

  // 4. Maintenance Mode Middleware (Processed early, before sessions/stages)
  bot.use(async (ctx, next) => {
    if (!ctx.from) return next();
    const adminGroupId = process.env.ADMIN_GROUP_ID;

    // If update originates from the Admin Group itself, allow it directly
    if (ctx.chat && adminGroupId && ctx.chat.id.toString() === adminGroupId.toString()) {
      return next();
    }

    try {
      const maintenanceSetting = await SystemConfig.findOne({ key: 'maintenanceMode' });
      const isMaintenance = maintenanceSetting ? !!maintenanceSetting.value : false;

      if (isMaintenance) {
        const isAdmin = await isUserAdmin(ctx, ctx.from.id);
        if (!isAdmin) {
          if (ctx.callbackQuery) {
            return ctx.answerCbQuery('⚠️ البوت في وضع الصيانة حالياً للتحديث. يرجى الانتظار.', { show_alert: true });
          }
          return ctx.replyWithHTML(
            `⚠️ <b>البوت في وضع الصيانة حالياً</b>\n\n` +
            `نعمل على بعض التحديثات والتحسينات السريعة للبوت. سنعود للعمل قريباً جداً! شكراً لتفهمك. 🙏`
          );
        }
      }
    } catch (err) {
      console.error('Maintenance middleware error:', err);
    }

    return next();
  });

  // 5. Persistent Sessions
  bot.use(mongooseSession());

  // 6. Wizard Stage Registration
  const stage = new Stage([rechargeWizard, gradGiftWizard, loveGiftWizard]);
  bot.use(stage.middleware());

  // 7. Cooldown Rate-Limiting Middleware (prevents command spam)
  const rateLimitMap = new Map();
  const COOLDOWN_MS = 1000;

  bot.use(async (ctx, next) => {
    if (!ctx.from) return next();

    // Skip rate limiting for messages in the Admin Group (to allow fast approvals & deliveries)
    const adminGroupId = process.env.ADMIN_GROUP_ID;
    if (ctx.chat && adminGroupId && ctx.chat.id.toString() === adminGroupId.toString()) {
      return next();
    }

    const userId = ctx.from.id.toString();
    const now = Date.now();

    if (rateLimitMap.has(userId)) {
      const lastRequest = rateLimitMap.get(userId);
      if (now - lastRequest < COOLDOWN_MS) {
        if (ctx.callbackQuery) {
          return ctx.answerCbQuery('⚠️ يرجى عدم إرسال الكثير من الأوامر متتالية! يوجد وقت انتظار.', { show_alert: true });
        }
        return ctx.reply('⚠️ يرجى الانتظار لحظة قبل إرسال رسالة أخرى.');
      }
    }

    rateLimitMap.set(userId, now);
    await next();
  });
};

module.exports = { registerMiddlewares };
