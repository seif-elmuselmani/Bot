const test = require('node:test');
const assert = require('node:assert');
const { escapeHTML, normalizeDigits, isUserAdmin, checkAdmin, getStatsHTML, getPromosHTML } = require('../bot/utils/helpers');

// Import models to mock their static methods
const User = require('../models/User');
const Deposit = require('../models/Deposit');
const Order = require('../models/Order');
const PromoCode = require('../models/PromoCode');

test('helpers.js - escapeHTML utility', () => {
  // Test basic escaping
  assert.strictEqual(escapeHTML('Hello <World> & Friends'), 'Hello &lt;World&gt; &amp; Friends');
  
  // Test null/undefined handling
  assert.strictEqual(escapeHTML(null), '');
  assert.strictEqual(escapeHTML(undefined), '');
  
  // Test numbers/booleans conversion
  assert.strictEqual(escapeHTML(123), '123');
  assert.strictEqual(escapeHTML(true), 'true');
  
  // Test empty string handling
  assert.strictEqual(escapeHTML(''), '');

  // Test special HTML characters
  assert.strictEqual(escapeHTML('Quotes: "hello" and \'world\''), 'Quotes: "hello" and \'world\''); // only escapes < > & in our helper
  
  // Test double escaping
  assert.strictEqual(escapeHTML('&amp;'), '&amp;amp;');
});

test('helpers.js - normalizeDigits utility', () => {
  // Test Eastern Arabic numerals
  assert.strictEqual(normalizeDigits('١٢٣٤٥٦٧٨٩٠'), '1234567890');
  
  // Test Persian numerals
  assert.strictEqual(normalizeDigits('۱۲۳۴۵۶۷۸۹۰'), '1234567890');
  
  // Test mixed digit string
  assert.strictEqual(normalizeDigits('السعر هو ١٥٠ جنيه'), 'السعر هو 150 جنيه');
  
  // Test null/undefined
  assert.strictEqual(normalizeDigits(null), '');
  assert.strictEqual(normalizeDigits(undefined), '');

  // Test empty string
  assert.strictEqual(normalizeDigits(''), '');

  // Test mixed digit formats (English, Arabic, Persian altogether)
  assert.strictEqual(normalizeDigits('Eng 123 + Arab ٤٥٦ + Pers ۷۸۹'), 'Eng 123 + Arab 456 + Pers 789');

  // Test string with no digits
  assert.strictEqual(normalizeDigits('Hello World! @#$'), 'Hello World! @#$');
});

test('helpers.js - isUserAdmin utility', async (t) => {
  const originalEnvAdminGroup = process.env.ADMIN_GROUP_ID;

  t.after(() => {
    process.env.ADMIN_GROUP_ID = originalEnvAdminGroup;
  });

  // Test Case 1: When ADMIN_GROUP_ID is not configured
  process.env.ADMIN_GROUP_ID = '';
  let ctx = {
    telegram: {
      getChatMember: t.mock.fn(async () => {
        return { status: 'creator' };
      })
    }
  };
  let result = await isUserAdmin(ctx, '12345');
  assert.strictEqual(result, false, 'Should return false when ADMIN_GROUP_ID is missing');
  assert.strictEqual(ctx.telegram.getChatMember.mock.calls.length, 0);

  // Setup valid environment for other test cases
  process.env.ADMIN_GROUP_ID = '-100123456';

  // Test Case 2: User is creator
  ctx.telegram.getChatMember = t.mock.fn(async (chatId, userId) => {
    assert.strictEqual(chatId, '-100123456');
    assert.strictEqual(userId, '12345');
    return { status: 'creator' };
  });
  result = await isUserAdmin(ctx, '12345');
  assert.strictEqual(result, true, 'Creator should be considered admin');

  // Test Case 3: User is administrator
  ctx.telegram.getChatMember = t.mock.fn(async () => {
    return { status: 'administrator' };
  });
  result = await isUserAdmin(ctx, '12345');
  assert.strictEqual(result, true, 'Administrator should be considered admin');

  // Test Case 4: User is normal member
  ctx.telegram.getChatMember = t.mock.fn(async () => {
    return { status: 'member' };
  });
  result = await isUserAdmin(ctx, '12345');
  assert.strictEqual(result, false, 'Member should not be considered admin');

  // Test Case 5: Telegram call throws an error
  ctx.telegram.getChatMember = t.mock.fn(async () => {
    throw new Error('Telegram connection timed out');
  });
  result = await isUserAdmin(ctx, '12345');
  assert.strictEqual(result, false, 'Should return false when Telegram API fails');
});

test('helpers.js - checkAdmin utility', async (t) => {
  const originalEnvAdminGroup = process.env.ADMIN_GROUP_ID;

  t.after(() => {
    process.env.ADMIN_GROUP_ID = originalEnvAdminGroup;
  });

  // Test Case 1: When ADMIN_GROUP_ID is not configured
  process.env.ADMIN_GROUP_ID = '';
  let ctx = {
    chat: { id: '-100123456' },
    from: { id: '12345' },
    telegram: {
      getChatMember: t.mock.fn(async () => ({ status: 'creator' }))
    }
  };
  let result = await checkAdmin(ctx);
  assert.strictEqual(result, false, 'Should return false when ADMIN_GROUP_ID is missing');

  // Setup valid environment
  process.env.ADMIN_GROUP_ID = '-100123456';

  // Test Case 2: When command does not originate in the admin group
  ctx.chat.id = '-9999999';
  result = await checkAdmin(ctx);
  assert.strictEqual(result, false, 'Should return false if chat ID does not match ADMIN_GROUP_ID');

  // Restore chat.id
  ctx.chat.id = '-100123456';

  // Test Case 3: User is admin creator in matching group
  ctx.telegram.getChatMember = t.mock.fn(async (chatId, userId) => {
    assert.strictEqual(chatId, '-100123456');
    assert.strictEqual(userId, '12345');
    return { status: 'creator' };
  });
  result = await checkAdmin(ctx);
  assert.strictEqual(result, true, 'Should return true if user is creator inside the admin group');

  // Test Case 4: User is member in matching group
  ctx.telegram.getChatMember = t.mock.fn(async () => ({ status: 'member' }));
  result = await checkAdmin(ctx);
  assert.strictEqual(result, false, 'Should return false if user is a regular member inside the admin group');

  // Test Case 5: Telegram call throws an error
  ctx.telegram.getChatMember = t.mock.fn(async () => {
    throw new Error('API failure');
  });
  result = await checkAdmin(ctx);
  assert.strictEqual(result, false, 'Should handle exceptions and return false');
});

test('helpers.js - getStatsHTML utility', async (t) => {
  // Mock User.countDocuments
  t.mock.method(User, 'countDocuments', async (query) => {
    if (query && query.isBanned === true) {
      return 3;
    }
    return 150; // total users
  });

  // Mock Order.countDocuments
  t.mock.method(Order, 'countDocuments', async (query) => {
    if (query && query.status === 'completed') {
      return 45;
    }
    if (query && query.status === 'in_progress') {
      return 5;
    }
    return 60; // total orders
  });

  // Mock Deposit.find
  t.mock.method(Deposit, 'find', async (query) => {
    assert.strictEqual(query.status, 'approved');
    
    // If it has updatedAt constraints (today's deposits)
    if (query.updatedAt) {
      return [
        { amount: 100 },
        { amount: 50.5 }
      ];
    }
    // All time deposits
    return [
      { amount: 100 },
      { amount: 50.5 },
      { amount: 500 }
    ];
  });

  const html = await getStatsHTML();

  // Assert expected stats are formatted correctly in HTML
  assert.ok(html.includes('150'), 'Should contain total users count');
  assert.ok(html.includes('3'), 'Should contain banned users count');
  assert.ok(html.includes('150.5 جنيه'), 'Should contain today\'s earnings');
  assert.ok(html.includes('650.5 جنيه'), 'Should contain all-time earnings');
  assert.ok(html.includes('3'), 'Should contain approved deposit count');
  assert.ok(html.includes('60'), 'Should contain total orders count');
  assert.ok(html.includes('45'), 'Should contain completed orders count');
  assert.ok(html.includes('5'), 'Should contain in-progress orders count');
});

test('helpers.js - getPromosHTML utility with empty promo list', async (t) => {
  t.mock.method(PromoCode, 'find', async () => []);
  const html = await getPromosHTML();
  assert.strictEqual(html, '💡 لا توجد أكواد ترويجية مضافة في النظام حالياً.');
});

test('helpers.js - getPromosHTML utility with active/expired promo list', async (t) => {
  t.mock.method(PromoCode, 'find', async () => {
    return [
      {
        code: 'PROMO100',
        rewardPoints: 100,
        maxUses: 10,
        usedBy: ['user1', 'user2']
      },
      {
        code: 'EXPIRED_CODE',
        rewardPoints: 50,
        maxUses: 1,
        usedBy: ['user3']
      }
    ];
  });

  const html = await getPromosHTML();
  assert.ok(html.includes('PROMO100'), 'Should list active promo code name');
  assert.ok(html.includes('+100 نقطة'), 'Should list reward points');
  assert.ok(html.includes('2/10'), 'Should list usage count');
  assert.ok(html.includes('✅ فعال'), 'Should label active code as active');

  assert.ok(html.includes('EXPIRED_CODE'), 'Should list expired promo code name');
  assert.ok(html.includes('+50 نقطة'), 'Should list expired reward points');
  assert.ok(html.includes('1/1'), 'Should list expired usage count');
  assert.ok(html.includes('🚫 منتهي الصلاحية'), 'Should label expired code as expired');
});