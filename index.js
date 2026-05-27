/**
 * Localized SaveTimePro_bot Entry Point (Arabic)
 * Initializes configuration, establishes database connection, registers Telegraf middleware
 * (session, scenes, stages, rate-limiting, and ban checking), attaches admin actions and
 * commands (/ban, /unban, /broadcast), registers service triggers, and launches the Telegram bot.
 */

// Load environment variables
require('dotenv').config();

const { Telegraf, Scenes: { Stage } } = require('telegraf');
const connectDB = require('./config/db');
const User = require('./models/User');
const PromoCode = require('./models/PromoCode');
const Session = require('./models/Session');
const Deposit = require('./models/Deposit');
const Order = require('./models/Order');

// Load Scenes
const rechargeWizard = require('./bot/scenes/rechargeWizard');
const orderWizard = require('./bot/scenes/orderWizard');
const designWizard = require('./bot/scenes/designWizard');

// Load Handlers & Actions
const { registerAdminActions } = require('./bot/actions/adminActions');
const { setupAdminDelivery } = require('./bot/handlers/adminDelivery');

// Helper to escape HTML characters for Telegram HTML formatting
const escapeHTML = (str) => {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

const botToken = process.env.BOT_TOKEN;
if (!botToken) {
  console.error('CRITICAL: BOT_TOKEN is missing in environment variables.');
  process.exit(1);
}

// Initialize Telegraf Bot
const bot = new Telegraf(botToken);

// Connect to MongoDB
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

// 1. Debug Logger Middleware
bot.use(async (ctx, next) => {
  const start = Date.now();
  console.log(`📥 Received Update ${ctx.update.update_id}:`, JSON.stringify(ctx.update, null, 2));
  await next();
  const ms = Date.now() - start;
  console.log(`Update ${ctx.update.update_id} processed in ${ms}ms`);
});

// ============================================================
// SECURITY: Group Whitelist Middleware
// The bot ONLY operates in:
//   - Private chats (with real users)
//   - The designated Admin Group (ADMIN_GROUP_ID)
// Any other group/supergroup: bot immediately leaves and ignores all updates.
// ============================================================
bot.use(async (ctx, next) => {
  const adminGroupId = process.env.ADMIN_GROUP_ID;
  const chatType = ctx.chat?.type;

  // Allow private chats and channel posts through
  if (!chatType || chatType === 'private' || chatType === 'channel') {
    return next();
  }

  // For any group or supergroup: check if it's the whitelisted admin group
  if (chatType === 'group' || chatType === 'supergroup') {
    if (adminGroupId && ctx.chat.id.toString() === adminGroupId.toString()) {
      return next(); // ✅ Allowed - this is the admin group
    }

    // 🚫 Unauthorized group - leave immediately and silently
    console.warn(`⚠️ Bot detected in unauthorized group: ${ctx.chat.id} ("${ctx.chat.title}"). Leaving now.`);
    try {
      await ctx.telegram.leaveChat(ctx.chat.id);
    } catch (leaveErr) {
      console.error(`Failed to leave unauthorized group ${ctx.chat.id}:`, leaveErr.message);
    }
    return; // Drop the update - do not process anything
  }

  return next();
});

// 2. Cooldown Rate-Limiting Middleware (prevents command spam)
const rateLimitMap = new Map();
const COOLDOWN_MS = 1000; // 1-second delay between user interactions

bot.use(async (ctx, next) => {
  if (!ctx.from) return next();
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

// 3. User Ban Check Middleware (blocks banned users from commands/wizards)
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

bot.use(mongooseSession());

// Initialize Stage and register scenes
const stage = new Stage([rechargeWizard, orderWizard, designWizard]);
bot.use(stage.middleware());

// Register admin actions callback query listeners
registerAdminActions(bot);

// Register admin delivery replies listener
setupAdminDelivery(bot);

// Helper to determine if command sender is an Administrator
// SECURITY: Only 'creator' and 'administrator' roles are permitted.
// Regular group 'member' status does NOT grant admin privileges.
// Admin commands are ONLY executable from inside the admin group chat.
const checkAdmin = async (ctx) => {
  const adminGroupId = process.env.ADMIN_GROUP_ID;
  if (!adminGroupId) return false;

  // ONLY allow commands sent from within the admin group itself
  if (ctx.chat.id.toString() !== adminGroupId.toString()) {
    return false;
  }

  // Inside the admin group: verify sender has creator or administrator role
  try {
    const member = await ctx.telegram.getChatMember(adminGroupId, ctx.from.id);
    return ['creator', 'administrator'].includes(member.status);
  } catch (err) {
    console.error(`Admin role lookup failed for ${ctx.from.id}:`, err.message);
    return false;
  }
};

// Admin Command: /ban <telegramId_or_@username>
bot.command('ban', async (ctx) => {
  const isAdmin = await checkAdmin(ctx);
  if (!isAdmin) return; // Silent ignore for unauthorized users

  const text = ctx.message?.text?.trim() || '';
  const args = text.split(/\s+/);
  if (args.length < 2) {
    return ctx.reply('⚠️ طريقة الاستخدام: /ban <telegramId_أو_@اسم_المستخدم>');
  }

  const targetInput = args[1];
  let query = {};
  if (/^\d+$/.test(targetInput)) {
    query = { telegramId: targetInput };
  } else {
    const cleanUsername = targetInput.replace(/^@/, '');
    query = { username: new RegExp(`^${cleanUsername}$`, 'i') };
  }

  try {
    const user = await User.findOneAndUpdate(
      query,
      { isBanned: true },
      { new: true }
    );

    if (!user) {
      return ctx.reply(`❌ لم يتم العثور على مستخدم بالبيانات "${targetInput}" في قاعدة البيانات.`);
    }

    await ctx.reply(`✅ تم حظر المستخدم ${user.firstName || user.telegramId} (@${user.username || 'بدون_اسم_مستخدم'}) بنجاح.`);
  } catch (error) {
    console.error('Ban command error:', error);
    await ctx.reply('⚠️ حدث خطأ في قاعدة البيانات أثناء حظر المستخدم.');
  }
});

// Admin Command: /unban <telegramId_or_@username>
bot.command('unban', async (ctx) => {
  const isAdmin = await checkAdmin(ctx);
  if (!isAdmin) return; // Silent ignore for unauthorized users

  const text = ctx.message?.text?.trim() || '';
  const args = text.split(/\s+/);
  if (args.length < 2) {
    return ctx.reply('⚠️ طريقة الاستخدام: /unban <telegramId_أو_@اسم_المستخدم>');
  }

  const targetInput = args[1];
  let query = {};
  if (/^\d+$/.test(targetInput)) {
    query = { telegramId: targetInput };
  } else {
    const cleanUsername = targetInput.replace(/^@/, '');
    query = { username: new RegExp(`^${cleanUsername}$`, 'i') };
  }

  try {
    const user = await User.findOneAndUpdate(
      query,
      { isBanned: false },
      { new: true }
    );

    if (!user) {
      return ctx.reply(`❌ لم يتم العثور على مستخدم بالبيانات "${targetInput}" في قاعدة البيانات.`);
    }

    await ctx.reply(`✅ تم إلغاء حظر المستخدم ${user.firstName || user.telegramId} (@${user.username || 'بدون_اسم_مستخدم'}) بنجاح.`);
  } catch (error) {
    console.error('Unban command error:', error);
    await ctx.reply('⚠️ حدث خطأ في قاعدة البيانات أثناء إلغاء الحظر.');
  }
});

// Admin Command: /addpoints <telegramId_or_@username> <amount>
// Adds (positive) or deducts (negative) points from a user's balance
// Usage: /addpoints @username 150     → add 150 points (refund)
// Usage: /addpoints 123456789 -50     → deduct 50 points (correction)
bot.command('addpoints', async (ctx) => {
  const isAdmin = await checkAdmin(ctx);
  if (!isAdmin) return; // Silent ignore

  const text = ctx.message?.text?.trim() || '';
  const args = text.split(/\s+/);
  if (args.length < 3) {
    return ctx.replyWithHTML(
      `⚠️ <b>طريقة الاستخدام:</b>\n` +
      `<code>/addpoints &lt;telegramId_أو_@اسم_المستخدم&gt; &lt;عدد_النقاط&gt;</code>\n\n` +
      `<b>أمثلة:</b>\n` +
      `• <code>/addpoints @username 150</code> — إضافة 150 نقطة (استرداد)\n` +
      `• <code>/addpoints 123456789 -50</code> — خصم 50 نقطة (تصحيح)\n` +
      `• <code>/addpoints @username 0</code> — عرض الرصيد الحالي فقط`
    );
  }

  const targetInput = args[1];
  const pointsArg = parseFloat(args[2]);

  if (isNaN(pointsArg)) {
    return ctx.reply('❌ قيمة النقاط غير صالحة. أدخل رقماً صحيحاً (موجب للإضافة، سالب للخصم).');
  }

  let query = {};
  if (/^\d+$/.test(targetInput)) {
    query = { telegramId: targetInput };
  } else {
    const cleanUsername = targetInput.replace(/^@/, '');
    query = { username: new RegExp(`^${cleanUsername}$`, 'i') };
  }

  try {
    const user = await User.findOne(query);
    if (!user) {
      return ctx.reply(`❌ لم يتم العثور على مستخدم بالبيانات "${targetInput}" في قاعدة البيانات.`);
    }

    const balanceBefore = user.balance;

    if (pointsArg === 0) {
      // Just show balance
      return ctx.replyWithHTML(
        `📊 <b>رصيد المستخدم:</b>\n\n` +
        `• <b>الاسم:</b> ${escapeHTML(user.firstName || 'غير محدد')}\n` +
        `• <b>المعرّف:</b> <code>${user.telegramId}</code>\n` +
        `• <b>الرصيد الحالي:</b> <code>${user.balance} نقطة</code>`
      );
    }

    // Update balance
    const updatedUser = await User.findOneAndUpdate(
      query,
      { $inc: { balance: pointsArg } },
      { new: true }
    );

    const balanceAfter = updatedUser.balance;
    const action = pointsArg > 0 ? '➕ إضافة' : '➖ خصم';
    const emoji = pointsArg > 0 ? '✅' : '⚠️';

    // Notify the user about the balance change
    try {
      if (pointsArg > 0) {
        await ctx.telegram.sendMessage(user.telegramId,
          `💰 <b>تم إضافة نقاط لمحفظتك!</b>\n\n` +
          `• <b>النقاط المضافة:</b> <code>+${pointsArg} نقطة</code>\n` +
          `• <b>الرصيد السابق:</b> <code>${balanceBefore} نقطة</code>\n` +
          `• <b>الرصيد الجديد:</b> <code>${balanceAfter} نقطة</code>\n\n` +
          `يمكنك الآن إعادة اختيار الخدمة من زر <b>📂 الخدمات</b>.`,
          { parse_mode: 'HTML' }
        );
      } else {
        await ctx.telegram.sendMessage(user.telegramId,
          `💳 <b>تم تعديل رصيد محفظتك</b>\n\n` +
          `• <b>النقاط المخصومة:</b> <code>${pointsArg} نقطة</code>\n` +
          `• <b>الرصيد الجديد:</b> <code>${balanceAfter} نقطة</code>`,
          { parse_mode: 'HTML' }
        );
      }
    } catch (notifyErr) {
      console.error(`Failed to notify user ${user.telegramId} about point change:`, notifyErr.message);
    }

    // Confirm to admin group
    await ctx.replyWithHTML(
      `${emoji} <b>${action} نقاط بنجاح!</b>\n\n` +
      `• <b>المستخدم:</b> ${escapeHTML(user.firstName || 'غير محدد')} (<code>${user.telegramId}</code>)\n` +
      `• <b>النقاط المعدّلة:</b> <code>${pointsArg > 0 ? '+' : ''}${pointsArg} نقطة</code>\n` +
      `• <b>الرصيد قبل:</b> <code>${balanceBefore} نقطة</code>\n` +
      `• <b>الرصيد بعد:</b> <code>${balanceAfter} نقطة</code>\n\n` +
      `<i>تم إشعار العميل بتغيير رصيده تلقائياً.</i>`
    );

  } catch (error) {
    console.error('Addpoints command error:', error);
    await ctx.reply('⚠️ حدث خطأ في قاعدة البيانات أثناء تعديل الرصيد.');
  }
});

// Helper to generate and send stats data (used by command and button)
const getStatsHTML = async () => {
  const totalUsers = await User.countDocuments({});
  const bannedUsers = await User.countDocuments({ isBanned: true });
  
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const todayDeposits = await Deposit.find({
    status: 'approved',
    updatedAt: { $gte: startOfToday, $lte: endOfToday }
  });
  const todayEarnings = todayDeposits.reduce((sum, dep) => sum + dep.amount, 0);

  const allApprovedDeposits = await Deposit.find({ status: 'approved' });
  const allTimeEarnings = allApprovedDeposits.reduce((sum, dep) => sum + dep.amount, 0);

  const totalOrders = await Order.countDocuments({});
  const completedOrders = await Order.countDocuments({ status: 'completed' });
  const inProgressOrders = await Order.countDocuments({ status: 'in_progress' });

  return `📊 <b>تقرير إحصائيات وأرباح البوت</b>\n\n` +
    `👤 <b>المستخدمين المشتركين:</b>\n` +
    `• إجمالي المستخدمين: <code>${totalUsers}</code> مستخدم\n` +
    `• الحسابات المحظورة: <code>${bannedUsers}</code> حساب\n\n` +
    `💰 <b>إحصائيات الشحن والأرباح:</b>\n` +
    `• شحن اليوم: <code>${todayEarnings} جنيه (نقطة)</code>\n` +
    `• إجمالي الشحن الكلي: <code>${allTimeEarnings} جنيه (نقطة)</code>\n` +
    `• عدد عمليات الشحن الموافق عليها: <code>${allApprovedDeposits.length}</code> عملية\n\n` +
    `📦 <b>إحصائيات طلبات الخدمات:</b>\n` +
    `• إجمالي الطلبات: <code>${totalOrders}</code> طلب\n` +
    `• طلبات مكتملة: <code>${completedOrders}</code> طلب\n` +
    `• طلبات قيد المعالجة: <code>${inProgressOrders}</code> طلب`;
};

// Helper to generate and send promos data (used by command and button)
const getPromosHTML = async () => {
  const promoCodes = await PromoCode.find({});
  if (promoCodes.length === 0) {
    return '💡 لا توجد أكواد ترويجية مضافة في النظام حالياً.';
  }

  let promoListMsg = `🎟️ <b>قائمة الأكواد الترويجية في النظام:</b>\n\n`;
  for (const p of promoCodes) {
    promoListMsg += 
      `• <b>الكود:</b> <code>${escapeHTML(p.code)}</code>\n` +
      `  - النقاط: <code>+${p.rewardPoints} نقطة</code>\n` +
      `  - الاستخدامات: <code>${p.usedBy.length}/${p.maxUses}</code>\n` +
      `  - الحالة: ${p.usedBy.length >= p.maxUses ? '🚫 منتهي الصلاحية' : '✅ فعال'}\n\n`;
  }
  return promoListMsg;
};

// Admin Command: /stats
bot.command('stats', async (ctx) => {
  const isAdmin = await checkAdmin(ctx);
  if (!isAdmin) return; // Silent ignore

  try {
    const statsHTML = await getStatsHTML();
    await ctx.replyWithHTML(statsHTML);
  } catch (error) {
    console.error('Stats command error:', error);
    await ctx.reply('⚠️ حدث خطأ أثناء تجميع إحصائيات النظام.');
  }
});

// Admin Command: /userinfo <telegramId_or_@username>
bot.command('userinfo', async (ctx) => {
  const isAdmin = await checkAdmin(ctx);
  if (!isAdmin) return; // Silent ignore

  const text = ctx.message?.text?.trim() || '';
  const args = text.split(/\s+/);
  if (args.length < 2) {
    return ctx.reply('⚠️ طريقة الاستخدام: /userinfo <telegramId_أو_@اسم_المستخدم>');
  }

  const targetInput = args[1];
  let query = {};
  if (/^\d+$/.test(targetInput)) {
    query = { telegramId: targetInput };
  } else {
    const cleanUsername = targetInput.replace(/^@/, '');
    query = { username: new RegExp(`^${cleanUsername}$`, 'i') };
  }

  try {
    const user = await User.findOne(query);
    if (!user) {
      return ctx.reply(`❌ لم يتم العثور على مستخدم بالبيانات المدخلة "${targetInput}" في النظام.`);
    }

    // Get all approved deposits for this user
    const deposits = await Deposit.find({ telegramId: user.telegramId, status: 'approved' });
    const totalRecharged = deposits.reduce((sum, dep) => sum + dep.amount, 0);

    // Get order counts for this user
    const totalUserOrders = await Order.countDocuments({ telegramId: user.telegramId });

    const formattedDate = user.joinedAt.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const userInfoMsg =
      `👤 <b>تفاصيل حساب المستخدم: ${escapeHTML(user.firstName)}</b>\n\n` +
      `• <b>المعرّف (ID):</b> <code>${user.telegramId}</code>\n` +
      `• <b>اسم المستخدم:</b> @${escapeHTML(user.username || 'بدون_اسم_مستخدم')}\n` +
      `• <b>الاسم الأول:</b> ${escapeHTML(user.firstName || 'لا يوجد')}\n` +
      `• <b>الاسم الأخير:</b> ${escapeHTML(user.lastName || 'لا يوجد')}\n` +
      `• <b>حالة الحساب:</b> ${user.isBanned ? '🚫 محظور' : '✅ نشط'}\n` +
      `• <b>تاريخ الانضمام:</b> <code>${formattedDate}</code>\n\n` +
      `💰 <b>البيانات المالية والطلبات:</b>\n` +
      `• الرصيد الحالي للمحفظة: <code>${user.balance} نقطة</code>\n` +
      `• إجمالي المبالغ المشحونة: <code>${totalRecharged} جنيه</code>\n` +
      `• عدد مرات الشحن المعتمدة: <code>${deposits.length}</code> مرات\n` +
      `• إجمالي طلبات الخدمات المقدمة: <code>${totalUserOrders}</code> طلبات`;

    await ctx.replyWithHTML(userInfoMsg);
  } catch (error) {
    console.error('Userinfo command error:', error);
    await ctx.reply('⚠️ حدث خطأ أثناء جلب بيانات المستخدم.');
  }
});

// Admin Command: /promos
bot.command('promos', async (ctx) => {
  const isAdmin = await checkAdmin(ctx);
  if (!isAdmin) return; // Silent ignore

  try {
    const promoCodes = await PromoCode.find({});
    if (promoCodes.length === 0) {
      return ctx.reply('💡 لا توجد أكواد ترويجية مضافة في النظام حالياً.');
    }

    let promoListMsg = `🎟️ <b>قائمة الأكواد الترويجية في النظام:</b>\n\n`;
    for (const p of promoCodes) {
      promoListMsg += 
        `• <b>الكود:</b> <code>${escapeHTML(p.code)}</code>\n` +
        `  - النقاط: <code>+${p.rewardPoints} نقطة</code>\n` +
        `  - الاستخدامات: <code>${p.usedBy.length}/${p.maxUses}</code>\n` +
        `  - الحالة: ${p.usedBy.length >= p.maxUses ? '🚫 منتهي الصلاحية' : '✅ فعال'}\n\n`;
    }

    await ctx.replyWithHTML(promoListMsg);
  } catch (error) {
    console.error('Promos command error:', error);
    await ctx.reply('⚠️ حدث خطأ أثناء استرجاع الأكواد الترويجية.');
  }
});

// Admin Command: /adminhelp
bot.command('adminhelp', async (ctx) => {
  const isAdmin = await checkAdmin(ctx);
  if (!isAdmin) return;

  const adminHelpMsg = 
    `🛠️ <b>لوحة تحكم مشرفي SaveTimePro</b>\n\n` +
    `الأوامر المتاحة للإدارة:\n\n` +
    `📊 <b>الإحصائيات والتقارير:</b>\n` +
    `• /stats — عرض إحصائيات البوت والأرباح اليومية والكلية.\n` +
    `• /userinfo &lt;telegramId_أو_@اسم_المستخدم&gt; — عرض بيانات شحن مستخدم وتفاصيل حسابه.\n\n` +
    `🎟️ <b>إدارة الأكواد الترويجية:</b>\n` +
    `• /addpromo &lt;الكود&gt; &lt;النقاط&gt; &lt;أقصى_استخدامات&gt; — إنشاء كود هدية جديد.\n` +
    `• /promos — عرض جميع الأكواد الترويجية النشطة وحالة استخدامها.\n\n` +
    `💰 <b>إدارة رصيد المستخدمين:</b>\n` +
    `• /addpoints &lt;telegramId_أو_@اسم_المستخدم&gt; &lt;النقاط&gt; — إضافة أو استرداد نقاط.\n` +
    `  مثال: <code>/addpoints @user 150</code> (إضافة) | <code>/addpoints @user -50</code> (خصم)\n\n` +
    `🚫 <b>إدارة الحظر (المستخدمين):</b>\n` +
    `• /ban &lt;telegramId_أو_@اسم_المستخدم&gt; — حظر مستخدم من البوت.\n` +
    `• /unban &lt;telegramId_أو_@اسم_المستخدم&gt; — إلغاء حظر مستخدم.\n\n` +
    `📢 <b>البث الجماعي:</b>\n` +
    `• /broadcast &lt;نص_الرسالة&gt; — إرسال رسالة جماعية لكل المشتركين النشطين.\n\n` +
    `🛠️ <b>لوحة التحكم السريعة:</b>\n` +
    `• /admin — عرض لوحة التحكم السريعة (أزرار الاختصار) داخل الجروب.`;

  await ctx.replyWithHTML(adminHelpMsg);
});

// Admin Command: /admin - Only accessible inside the Admin Group (silently ignored elsewhere)
bot.command('admin', async (ctx) => {
  const adminGroupId = process.env.ADMIN_GROUP_ID;
  if (!adminGroupId) return; // No admin group configured - silent ignore

  // Silently ignore if not in the admin group (no response = no hint that this command exists)
  if (ctx.chat.id.toString() !== adminGroupId.toString()) {
    return;
  }

  await ctx.replyWithHTML(
    `🛠️ <b>لوحة تحكم مشرفي SaveTimePro</b>\n\n` +
    `مرحباً بك في لوحة التحكم السريعة للجروب. يرجى استخدام الأزرار أدناه لإجراء العمليات السريعة:`,
    {
      reply_markup: {
        keyboard: [
          [{ text: '📊 إحصائيات البوت' }, { text: '🎟️ الأكواد الترويجية' }],
          [{ text: '🛠️ مساعدة المسؤول' }, { text: '❌ إغلاق لوحة التحكم' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      }
    }
  );
});

// Admin Keyboard Hears Handlers - Verified with checkAdmin
bot.hears('📊 إحصائيات البوت', async (ctx) => {
  const isAdmin = await checkAdmin(ctx);
  if (!isAdmin) return;

  try {
    const statsHTML = await getStatsHTML();
    await ctx.replyWithHTML(statsHTML);
  } catch (error) {
    console.error('Stats button error:', error);
    await ctx.reply('⚠️ حدث خطأ أثناء تجميع إحصائيات النظام.');
  }
});

bot.hears('🎟️ الأكواد الترويجية', async (ctx) => {
  const isAdmin = await checkAdmin(ctx);
  if (!isAdmin) return;

  try {
    const promosHTML = await getPromosHTML();
    await ctx.replyWithHTML(promosHTML);
  } catch (error) {
    console.error('Promos button error:', error);
    await ctx.reply('⚠️ حدث خطأ أثناء استرجاع الأكواد الترويجية.');
  }
});

bot.hears('🛠️ مساعدة المسؤول', async (ctx) => {
  const isAdmin = await checkAdmin(ctx);
  if (!isAdmin) return;

  const adminHelpMsg = 
    `🛠️ <b>لوحة تحكم مشرفي SaveTimePro</b>\n\n` +
    `الأوامر المتاحة للإدارة:\n\n` +
    `📊 <b>الإحصائيات والتقارير:</b>\n` +
    `• /stats — عرض إحصائيات البوت والأرباح اليومية والكلية.\n` +
    `• /userinfo &lt;telegramId_أو_@اسم_المستخدم&gt; — عرض بيانات شحن مستخدم وتفاصيل حسابه.\n\n` +
    `🎟️ <b>إدارة الأكواد الترويجية:</b>\n` +
    `• /addpromo &lt;الكود&gt; &lt;النقاط&gt; &lt;أقصى_استخدامات&gt; — إنشاء كود هدية جديد.\n` +
    `• /promos — عرض جميع الأكواد الترويجية النشطة وحالة استخدامها.\n\n` +
    `🚫 <b>إدارة الحظر (المستخدمين):</b>\n` +
    `• /ban &lt;telegramId_أو_@اسم_المستخدم&gt; — حظر مستخدم من البوت.\n` +
    `• /unban &lt;telegramId_أو_@اسم_المستخدم&gt; — إلغاء حظر مستخدم.\n\n` +
    `📢 <b>البث الجماعي:</b>\n` +
    `• /broadcast &lt;نص_الرسالة&gt; — إرسال رسالة جماعية لكل المشتركين النشطين.\n\n` +
    `🛠️ <b>لوحة التحكم السريعة:</b>\n` +
    `• /admin — عرض لوحة التحكم السريعة (أزرار الاختصار) داخل الجروب.`;

  await ctx.replyWithHTML(adminHelpMsg);
});

bot.hears('❌ إغلاق لوحة التحكم', async (ctx) => {
  const isAdmin = await checkAdmin(ctx);
  if (!isAdmin) return;

  await ctx.reply('🔒 تم إغلاق لوحة التحكم وإخفاء الأزرار.', {
    reply_markup: {
      remove_keyboard: true
    }
  });
});

// Admin Command: /addpromo <CODE> <POINTS> <MAX_USES>
bot.command('addpromo', async (ctx) => {
  const isAdmin = await checkAdmin(ctx);
  if (!isAdmin) return; // Silent ignore

  const text = ctx.message?.text?.trim() || '';
  const args = text.split(/\s+/);
  if (args.length < 4) {
    return ctx.reply('⚠️ طريقة الاستخدام: /addpromo <الكود> <النقاط> <أقصى_استخدامات>');
  }

  const promoCode = args[1].toUpperCase();
  const points = parseFloat(args[2]);
  const maxUses = parseInt(args[3], 10);

  if (isNaN(points) || points <= 0 || isNaN(maxUses) || maxUses <= 0) {
    return ctx.reply('❌ خطأ: يرجى إدخال قيم نقاط واستخدامات صحيحة وأكبر من صفر.');
  }

  const escapeMarkdownLocal = (textStr) => {
    return textStr.toString()
      .replace(/_/g, '\\_')
      .replace(/\*/g, '\\*')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/~/g, '\\~')
      .replace(/`/g, '\\`')
      .replace(/>/g, '\\>')
      .replace(/#/g, '\\#')
      .replace(/\+/g, '\\+')
      .replace(/-/g, '\\-')
      .replace(/=/g, '\\=')
      .replace(/\|/g, '\\|')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/\./g, '\\.')
      .replace(/\!/g, '\\!');
  };

  try {
    // Check if code already exists
    let promo = await PromoCode.findOne({ code: promoCode });
    if (promo) {
      return ctx.reply(`❌ خطأ: الكود الترويجي ${promoCode} موجود بالفعل في النظام.`);
    }

    promo = new PromoCode({
      code: promoCode,
      rewardPoints: points,
      maxUses: maxUses,
      usedBy: []
    });
    await promo.save();

    await ctx.replyWithHTML(
      `✅ <b>تم إنشاء الكود الترويجي بنجاح!</b>\n\n` +
      `• <b>الكود:</b> <code>${escapeHTML(promoCode)}</code>\n` +
      `• <b>النقاط الممنوحة:</b> <code>${points} نقطة</code>\n` +
      `• <b>أقصى استخدامات:</b> <code>${maxUses}</code>`
    );

  } catch (error) {
    console.error('Error creating promo code:', error);
    await ctx.reply('⚠️ حدث خطأ أثناء إنشاء الكود الترويجي في قاعدة البيانات.');
  }
});

// Admin Command: /broadcast <message_text>
bot.command('broadcast', async (ctx) => {
  const isAdmin = await checkAdmin(ctx);
  if (!isAdmin) return; // Silent ignore

  const text = ctx.message?.text || '';
  const spaceIndex = text.indexOf(' ');
  
  if (spaceIndex === -1) {
    return ctx.reply('⚠️ طريقة الاستخدام: /broadcast <نص_الرسالة>');
  }

  const broadcastMessage = text.substring(spaceIndex + 1).trim();
  if (!broadcastMessage) {
    return ctx.reply('⚠️ لا يمكن إرسال رسالة بث فارغة.');
  }

  await ctx.reply('⏳ جارٍ إرسال رسالة البث الجماعي لجميع المستخدمين في الخلفية...');

  try {
    const users = await User.find({});
    let successCount = 0;
    
    // Custom sleep helper to throttle message distribution
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    for (const u of users) {
      // Do not send broadcasts to banned users
      if (u.isBanned) continue;

      try {
        await ctx.telegram.sendMessage(u.telegramId, broadcastMessage);
        successCount++;
      } catch (sendErr) {
        console.error(`Broadcast message delivery failed for user ${u.telegramId}: ${sendErr.message}`);
      }

      // Safe sleep window to stay clear of Telegram's limit (30 messages per second)
      await sleep(50);
    }

    await ctx.reply(`✅ اكتمل إرسال البث الجماعي. تم التسليم بنجاح إلى ${successCount}/${users.length} مستخدم نشط.`);
  } catch (error) {
    console.error('Broadcast command error:', error);
    await ctx.reply('⚠️ حدث خطأ في النظام أثناء إرسال البث الجماعي.');
  }
});

// Command /recharge and hears "💳 شحن المحفظة" triggers
bot.command('recharge', async (ctx) => {
  if (ctx.chat.type !== 'private') return;
  try {
    await ctx.scene.enter('recharge-wizard');
  } catch (error) {
    console.error('Failed to enter recharge wizard:', error);
    await ctx.reply('⚠️ تعذر بدء عملية الشحن حالياً. يرجى المحاولة مرة أخرى.');
  }
});

bot.hears('💳 شحن المحفظة', async (ctx) => {
  if (ctx.chat.type !== 'private') return;
  try {
    await ctx.scene.enter('recharge-wizard');
  } catch (error) {
    console.error('Failed to enter recharge wizard:', error);
    await ctx.reply('⚠️ تعذر بدء عملية الشحن حالياً. يرجى المحاولة مرة أخرى.');
  }
});

// Configuration mapping of bot callback strings to pricing and database models
const servicesConfig = {
  'similarity_60': { type: 'similarity_report', price: 60, name: 'تقرير فحص التشابه العلمي' },
  'ai_50': { type: 'ai_writing_report', price: 50, name: 'تقرير فحص الكتابة بالذكاء الاصطناعي' },
  'design_create_cv': { type: 'cv_design', price: 150, name: 'إنشاء سيرة ذاتية ATS (من سيرة قديمة)' },
  'design_edit_cv': { type: 'cv_design', price: 50, name: 'تعديل/تحديث سيرة ذاتية ATS' },
  'design_create_portfolio': { type: 'portfolio_design', price: 300, name: 'إنشاء بورتفوليو (من سيرة ATS)' },
  'design_edit_portfolio': { type: 'portfolio_design', price: 100, name: 'تعديل/تحديث بورتفوليو' }
};

// Services Menu Display Command / Hears
const showServicesMenu = async (ctx) => {
  try {
    const servicesMessage =
      `📂 <b>قائمة خدمات SaveTimePro المتاحة</b>\n\n` +
      `اختر الخدمة المطلوبة من القائمة أدناه. سيتم فحص رصيدك أولاً ثم مطالبتك برفع الملفات المطلوبة.\n\n` +
      `💳 <b>اختر الخدمة للمتابعة:</b>`;

    await ctx.replyWithHTML(servicesMessage, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📊 تقرير التشابه العلمي (60 نقطة)', callback_data: 'service_similarity_60' }
          ],
          [
            { text: '🤖 تقرير فحص الذكاء الاصطناعي (50 نقطة)', callback_data: 'service_ai_50' }
          ],
          [
            { text: '📄 إنشاء سيرة ATS جديدة (150 نقطة)', callback_data: 'service_design_create_cv' }
          ],
          [
            { text: '✏️ تعديل سيرة ATS الحالية (50 نقطة)', callback_data: 'service_design_edit_cv' }
          ],
          [
            { text: '💼 إنشاء بورتفوليو (300 نقطة)', callback_data: 'service_design_create_portfolio' }
          ],
          [
            { text: '🛠️ تعديل البورتفوليو الحالي (100 نقطة)', callback_data: 'service_design_edit_portfolio' }
          ]
        ]
      }
    });
  } catch (error) {
    console.error('Error in services menu route:', error);
    await ctx.reply('⚠️ تعذر تحميل قائمة الخدمات. يرجى المحاولة مرة أخرى لاحقاً.');
  }
};

bot.command('services', async (ctx) => {
  if (ctx.chat.type !== 'private') return;
  await showServicesMenu(ctx);
});
bot.hears('📂 الخدمات', async (ctx) => {
  if (ctx.chat.type !== 'private') return;
  await showServicesMenu(ctx);
});

// Unified configuration-driven callback resolver for selecting services
bot.action(/^service_(.+)$/, async (ctx) => {
  const serviceKey = ctx.match[1];
  const service = servicesConfig[serviceKey];

  if (!service) {
    return ctx.answerCbQuery('❌ اختيار خدمة غير معروف.', { show_alert: true });
  }

  const userId = ctx.from.id.toString();
  const price = service.price;

  try {
    // 1. Fetch user profile
    const user = await User.findOne({ telegramId: userId });
    if (!user) {
      return ctx.answerCbQuery('❌ الحساب غير مسجل. يرجى إرسال /start أولاً.', { show_alert: true });
    }

    // 2. Validate point balance
    if (user.balance < price) {
      await ctx.answerCbQuery('❌ رصيدك غير كافٍ!', { show_alert: false });
      await ctx.replyWithHTML(
        `❌ <b>رصيد نقاطك الحالي غير كافٍ!</b>\n\n` +
        `• <b>الخدمة:</b> <code>${escapeHTML(service.name)}</code>\n` +
        `• <b>التكلفة المطلوبة:</b> <code>${price} نقطة</code>\n` +
        `• <b>رصيدك الحالي:</b> <code>${user.balance} نقطة</code>\n\n` +
        `يرجى اختيار <b>شحن المحفظة</b> أو إرسال الأمر /recharge لإضافة نقاط لمستودعك.`
      );
      return;
    }

    // 3. Save selected service parameters to user session
    ctx.session.selectedService = service.type;
    ctx.session.selectedPrice = price;
    ctx.session.selectedServiceName = service.name;

    // Acknowledge callback query
    await ctx.answerCbQuery(`✅ تم اختيار: ${service.name}`);

    // 4. Send user into the appropriate wizard scene
    if (serviceKey.startsWith('design_')) {
      await ctx.scene.enter('design-wizard');
    } else {
      await ctx.scene.enter('order-wizard');
    }

  } catch (error) {
    console.error('Error handling service callback:', error);
    await ctx.answerCbQuery('⚠️ حدث خطأ أثناء معالجة الطلب.', { show_alert: true });
  }
});

// Profile Command / Hears trigger
const showUserProfile = async (ctx) => {
  const telegramId = ctx.from.id.toString();
  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return ctx.reply('❌ الحساب غير مسجل. يرجى إرسال /start أولاً لتسجيل حسابك.');
    }

    const formattedDate = user.joinedAt.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const profileMessage = 
      `👤 <b>بيانات الحساب الشخصي</b>\n\n` +
      `• <b>معرّف الحساب (ID):</b> <code>${user.telegramId}</code>\n` +
      `• <b>رصيد النقاط الحالي:</b> <code>${user.balance} نقطة</code>\n` +
      `• <b>تاريخ التسجيل في البوت:</b> <code>${formattedDate}</code>`;

    await ctx.replyWithHTML(profileMessage);
  } catch (error) {
    console.error('Error showing user profile:', error);
    await ctx.reply('⚠️ تعذر استرجاع بيانات الحساب حالياً.');
  }
};

bot.command('profile', async (ctx) => {
  if (ctx.chat.type !== 'private') return;
  await showUserProfile(ctx);
});
bot.hears('👤 حسابي الشخصي', async (ctx) => {
  if (ctx.chat.type !== 'private') return;
  await showUserProfile(ctx);
});

// Promo Code Redemption Command
bot.command('promo', async (ctx) => {
  if (ctx.chat.type !== 'private') return;
  const text = ctx.message?.text?.trim() || '';
  const args = text.split(/\s+/);
  
  if (args.length < 2) {
    return ctx.replyWithHTML('⚠️ <b>طريقة الاستخدام:</b> <code>/promo &lt;كود_الخصم&gt;</code>\n<i>لتفعيل أكواد الهدايا وإضافة نقاط لمحفظتك تلقائياً.</i>');
  }

  const promoCodeInput = args[1].toUpperCase();
  const telegramId = ctx.from.id.toString();

  try {
    // 1. Find promo code in DB
    const promo = await PromoCode.findOne({ code: promoCodeInput });
    if (!promo) {
      return ctx.reply('❌ كود ترويجي غير صالح. يرجى التأكد وإعادة المحاولة.');
    }

    // 2. Check if promo code has exceeded max use limits
    if (promo.usedBy.length >= promo.maxUses) {
      return ctx.reply('❌ لقد وصل هذا الكود للحد الأقصى من الاستخدام وانتهت صلاحيته.');
    }

    // 3. Check if user already claimed this code
    if (promo.usedBy.includes(telegramId)) {
      return ctx.reply('❌ لقد قمت بتفعيل هذا الكود الترويجي مسبقاً لحسابك.');
    }

    // 4. Update promo code usage lists
    promo.usedBy.push(telegramId);
    await promo.save();

    // 5. Increment user points balance in database
    const user = await User.findOneAndUpdate(
      { telegramId },
      { $inc: { balance: promo.rewardPoints } },
      { new: true }
    );

    if (!user) {
      return ctx.reply('❌ خطأ في النظام. يرجى إرسال /start لتسجيل حسابك أولاً.');
    }

    await ctx.replyWithHTML(
      `🎉 <b>تم تفعيل الكود بنجاح!</b>\n\n` +
      `• <b>النقاط المضافة:</b> <code>+${promo.rewardPoints} نقطة</code>\n` +
      `• <b>الرصيد الحالي للمحفظة:</b> <code>${user.balance} نقطة</code>`
    );

  } catch (error) {
    console.error('Promo Code Redemption Error:', error);
    await ctx.reply('⚠️ حدث خطأ في النظام أثناء تفعيل كود الهدية. يرجى المحاولة لاحقاً.');
  }
});

// Support Trigger Information
bot.hears('📞 الدعم الفني', async (ctx) => {
  if (ctx.chat.type !== 'private') return;
  await ctx.replyWithHTML(
    `📞 <b>الدعم الفني لبوت SaveTimePro</b>\n\n` +
    `للاستفسارات، أو مشاكل عمليات الشحن، أو طلبات الشراكة، يرجى التواصل مباشرة مع الإدارة.\n\n` +
    `💬 <b>حساب التواصل (واتساب):</b> <a href="https://wa.me/201223817860">+201223817860</a>`
  );
});

// Instructions of Use Trigger (Arabic)
const showInstructionsMenu = async (ctx) => {
  const instructionMessage = 
    `📌 <b>تعليمات الاستخدام لبوت SaveTimePro</b> 🤖\n\n` +
    `📊 <b>الخدمات المتاحة وأسعارها بالنقاط:</b>\n` +
    `• تقرير فحص التشابه العلمي 📊 — <b>60 نقطة</b>\n` +
    `• تقرير فحص الذكاء الاصطناعي 🤖 — <b>50 نقطة</b>\n` +
    `• إنشاء سيرة ذاتية ATS جديدة 📄 — <b>150 نقطة</b>\n` +
    `• تعديل سيرة ذاتية ATS حالية ✏️ — <b>50 نقطة</b>\n` +
    `• إنشاء بورتفوليو مهني 💼 — <b>300 نقطة</b>\n` +
    `• تعديل بورتفوليو حالي 🛠️ — <b>100 نقطة</b>\n\n` +
    `💡 <b>طريقة الاستخدام:</b>\n` +
    `1️⃣ اشحن نقاط أولاً من خلال زر <b>شحن المحفظة</b> (1 جنيه = 1 نقطة).\n` +
    `2️⃣ اختر الخدمة المطلوبة بالضغط على زر <b>الخدمات</b>.\n` +
    `3️⃣ ارفع الملف المطلوب بالصيغة المدعومة.\n\n` +
    `📂 <b>الصيغ المقبولة للمستندات الأكاديمية:</b>\n` +
    `<code>.doc, .docx, .pdf, .txt, .rtf, .odt, .htm, .html</code>\n\n` +
    `⚠️ <b>القيود والشروط:</b>\n` +
    `• الحد الأقصى لحجم الملف المرفوع: <b>20 ميجابايت (20 MB)</b>.\n` +
    `• <b>ممنوع إرسال:</b> الصور، الملفات المضغوطة (zip/rar)، أو ملفات PowerPoint.\n` +
    `• يُفضَّل تسمية الملف باللغة الإنجليزية.\n` +
    `• <b>ملاحظة عن عدد الكلمات:</b> أنظمة الفحص لا تقبل أي ملف يقل عن <b>300 كلمة</b> وسيتم رفضه تلقائياً.\n\n` +
    `❓ <b>أهم الأسئلة الشائعة:</b>\n` +
    `🔸 <b>أشحن بكام عشان أقدر أستخدمه؟</b>\n` +
    `  - اشحن بالرصيد اللي يناسبك، وأسعار الخدمات تبدأ من 50 نقطة فقط.\n` +
    `🔸 <b>هل الرصيد بيختفي مع الوقت؟</b>\n` +
    `  - لا، رصيد نقاطك بيفضل محفوظ في حسابك الشخصي دايماً.\n` +
    `🔸 <b>هل بتقلل اقتباس؟</b>\n` +
    `  - نعم، تواصل مع الدعم الفني والاتفاق بيكون حسب نوع وحجم الملف.\n` +
    `🔸 <b>ليه البوت عملي بلوك؟</b>\n` +
    `  - في حالة التلاعب في إيصال الدفع، أو إدخال قيمة شحن غير حقيقية، أو تكرار إرسال إيصالات غير صالحة.\n` +
    `🔸 <b>إزاي أفك البلوك وأرجع أستخدم البوت تاني؟</b>\n` +
    `  - تواصل مع الدعم الفني وقدم تفاصيل حسابك وسيتم حل المشكلة وتنشيط حسابك فوراً.\n` +
    `🔸 <b>ليه طلب الشحن بيتأخر أحياناً وبيتقبل في ثواني أحياناً تانية؟</b>\n` +
    `  - لأن تأكيد الدفع ومراجعة الإيصالات يتم بشكل يدوي من قبل الإدارة لضمان الدقة.\n` +
    `🔸 <b>هل بتشوفوا الرسايل والملفات الخاصة بيا؟</b>\n` +
    `  - لا، ملفاتك تعامل بسرية تامة وتُرسل مباشرة للإدارة لمعالجتها فقط ولا يتم مشاركتها.\n\n` +
    `⏱️ <b>الوقت المتوقع للطلب:</b> 10-15 دقيقة.\n` +
    `💼 يوجد لدينا خدمة تقليل اقتباس واعادة صياغة وتقليل نسبة الذكاء الاصطناعي، للحصول عليها تواصل معنا.\n\n` +
    `💬 <b>حساب التواصل والدعم (واتساب):</b> <a href="https://wa.me/201223817860">+201223817860</a>\n\n` +
    `اضغط على <b>شحن المحفظة</b> للبدء 👇`;

  await ctx.replyWithHTML(instructionMessage, { disable_web_page_preview: true });
};

bot.command('instructions', async (ctx) => {
  if (ctx.chat.type !== 'private') return;
  await showInstructionsMenu(ctx);
});
bot.hears('📌 تعليمات الاستخدام', async (ctx) => {
  if (ctx.chat.type !== 'private') return;
  await showInstructionsMenu(ctx);
});

// /start Command Handler
bot.start(async (ctx) => {
  if (ctx.chat.type !== 'private') return;
  const telegramId = ctx.from.id.toString();
  const username = ctx.from.username || '';
  const firstName = ctx.from.first_name || '';
  const lastName = ctx.from.last_name || '';
  
  try {
    // Upsert user into database to ensure they are registered
    let user = await User.findOne({ telegramId });

    if (!user) {
      user = new User({
        telegramId,
        username,
        firstName,
        lastName,
        balance: 0,
        isBanned: false,
      });
      await user.save();
      console.log(`New User registered: ${username || telegramId}`);
    } else {
      // Update names and username if changed
      user.username = username;
      user.firstName = firstName;
      user.lastName = lastName;
      await user.save();
    }

    // Modern styled greeting (Arabic) using HTML
    const welcomeMessage = 
      `✨ <b>مرحباً بك في بوت SaveTimePro، ${escapeHTML(firstName)}!</b> ✨\n\n` +
      `متجرك الشخصي والذكي لطلب الخدمات الأكاديمية والترجمة وخدمات التصميم.\n\n` +
      `💳 <b>رصيد نقاطك الحالي:</b> <code>${user.balance} نقطة</code>\n\n` +
      `💡 <b>ماذا تريد أن تفعل اليوم؟</b>\n` +
      `• اضغط على <b>شحن المحفظة</b> بالأسفل لإضافة نقاط لمحفظتك\n` +
      `• تصفح الخدمات المتاحة من خلال زر <b>الخدمات</b> بالأسفل\n\n` +
      `<i>للمساعدة والاستفسار، اضغط على زر <b>الدعم الفني</b> للتواصل مع الإدارة.</i>`;

    // Send welcome response with HTML styling and reply keyboard
    await ctx.replyWithHTML(welcomeMessage, {
      reply_markup: {
        keyboard: [
          [{ text: '💳 شحن المحفظة' }, { text: '📂 الخدمات' }],
          [{ text: '👤 حسابي الشخصي' }, { text: '📌 تعليمات الاستخدام' }],
          [{ text: '📞 الدعم الفني' }]
        ],
        resize_keyboard: true
      }
    });
  } catch (error) {
    console.error('Error in /start handler:', error);
    await ctx.reply('⚠️ حدث خطأ أثناء تهيئة حسابك الشخصي. يرجى المحاولة مرة أخرى لاحقاً.');
  }
});

// Catch-all message handler to guide users to use keyboard buttons (private chat only)
bot.on('message', async (ctx) => {
  if (ctx.chat.type !== 'private') return;
  // If user is inside a wizard scene, do not interrupt
  if (ctx.scene && ctx.scene.current) {
    return;
  }
  await ctx.reply('⚠️ يرجى استخدام الأزرار المتاحة في القائمة بالأسفل للتفاعل مع البوت.', {
    reply_markup: {
      keyboard: [
        [{ text: '💳 شحن المحفظة' }, { text: '📂 الخدمات' }],
        [{ text: '👤 حسابي الشخصي' }, { text: '📌 تعليمات الاستخدام' }],
        [{ text: '📞 الدعم الفني' }]
      ],
      resize_keyboard: true
    }
  });
});

// Group catch-all: remove stale user keyboard if any non-command text appears in the admin group
bot.on('message', async (ctx) => {
  const adminGroupId = process.env.ADMIN_GROUP_ID;
  if (!adminGroupId) return;
  if (ctx.chat.id.toString() !== adminGroupId.toString()) return;

  // Only act on plain text messages (not commands, files, etc.)
  const text = ctx.message?.text || '';
  if (!text || text.startsWith('/')) return;

  // If the text matches one of the old user-facing keyboard buttons, silently remove it
  const userButtons = [
    '💳 شحن المحفظة', '📂 الخدمات', '👤 حسابي الشخصي',
    '📌 تعليمات الاستخدام', '📞 الدعم الفني'
  ];
  if (userButtons.includes(text)) {
    await ctx.reply(
      '⚠️ هذا الزر خاص بالمستخدمين وليس بالجروب. استخدم /admin لعرض لوحة تحكم الإدارة.',
      { reply_markup: { remove_keyboard: true } }
    );
  }
});

// Register Telegram commands menu list
bot.telegram.setMyCommands([
  { command: 'start', description: 'بدء تشغيل البوت وتحديث الحساب' },
  { command: 'services', description: 'عرض قائمة الخدمات المتاحة' },
  { command: 'recharge', description: 'شحن نقاط المحفظة' },
  { command: 'instructions', description: '📌 تعليمات وطريقة استخدام البوت' },
  { command: 'profile', description: 'استعراض بيانات حسابك ورصيدك' },
  { command: 'promo', description: 'تفعيل أكواد الهدايا والنقاط' }
]).then(() => {
  console.log('✅ Bot commands menu registered successfully.');
}).catch((error) => {
  console.error('Failed to register bot commands menu:', error);
});
// Simple HTTP server for Render's health checks and to keep the bot alive
const http = require('http');
const port = process.env.PORT || 3000;
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
