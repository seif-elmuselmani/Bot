/**
 * Bot Utility Helpers
 * Houses HTML escaping, admin group membership verification, and statistics aggregation lookups.
 */

const User = require('../../models/User');
const Deposit = require('../../models/Deposit');
const Order = require('../../models/Order');
const PromoCode = require('../../models/PromoCode');

/**
 * Escapes special HTML tags to prevent breaking Telegram message formats.
 * @param {string} str 
 * @returns {string}
 */
const escapeHTML = (str) => {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

/**
 * Verifies if a user is an administrator of the designated group.
 * Used for checking admin status from private chats.
 * @param {Context} ctx 
 * @param {string|number} userId 
 * @returns {Promise<boolean>}
 */
const isUserAdmin = async (ctx, userId) => {
  const adminGroupId = process.env.ADMIN_GROUP_ID;
  if (!adminGroupId) return false;
  try {
    const member = await ctx.telegram.getChatMember(adminGroupId, userId);
    return ['creator', 'administrator'].includes(member.status);
  } catch (err) {
    return false;
  }
};

/**
 * Strictly verifies if a command or action originates from the Admin Group and the sender is an admin.
 * @param {Context} ctx 
 * @returns {Promise<boolean>}
 */
const checkAdmin = async (ctx) => {
  const adminGroupId = process.env.ADMIN_GROUP_ID;
  if (!adminGroupId) return false;

  // ONLY allow commands sent from within the admin group itself
  if (ctx.chat.id.toString() !== adminGroupId.toString()) {
    return false;
  }

  try {
    const member = await ctx.telegram.getChatMember(adminGroupId, ctx.from.id);
    return ['creator', 'administrator'].includes(member.status);
  } catch (err) {
    console.error(`Admin role lookup failed for ${ctx.from.id}:`, err.message);
    return false;
  }
};

/**
 * Generates Arabic HTML formatted summary of bot user counts and overall financials.
 * @returns {Promise<string>}
 */
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

/**
 * Generates HTML formatted list of promo codes.
 * @returns {Promise<string>}
 */
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

/**
 * Normalizes Eastern Arabic and Persian numerals to Western Arabic numerals (e.g. ١٢٣ -> 123)
 * @param {string} str 
 * @returns {string}
 */
const normalizeDigits = (str) => {
  if (!str) return '';
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  
  let normalized = str.toString();
  for (let i = 0; i < 10; i++) {
    normalized = normalized.replace(new RegExp(arabicDigits[i], 'g'), i);
    normalized = normalized.replace(new RegExp(persianDigits[i], 'g'), i);
  }
  return normalized;
};

module.exports = {
  escapeHTML,
  isUserAdmin,
  checkAdmin,
  getStatsHTML,
  getPromosHTML,
  normalizeDigits
};
