const test = require('node:test');
const assert = require('node:assert');
const User = require('../models/User');
const Order = require('../models/Order');
const Deposit = require('../models/Deposit');
const PromoCode = require('../models/PromoCode');
const Session = require('../models/Session');
const SystemConfig = require('../models/SystemConfig');

test('Database Models - User Schema Validations', () => {
  // 1. Test valid user structure validation
  const user = new User({
    telegramId: '12345678',
    username: 'test_user',
    firstName: 'Saif',
    balance: 100
  });

  const err = user.validateSync();
  assert.strictEqual(err, undefined, 'Valid user should not throw validation errors');

  // Test default values
  assert.strictEqual(user.isBanned, false, 'isBanned should default to false');
  assert.strictEqual(user.referralRewardClaimed, false, 'referralRewardClaimed should default to false');
  assert.strictEqual(user.referredBy, null, 'referredBy should default to null');
  assert.strictEqual(user.balance, 100, 'Balance should match initialized value');

  // 2. Test missing required fields (telegramId is required)
  const invalidUserMissingId = new User({
    username: 'no_id_user',
    balance: 50
  });
  const valErr1 = invalidUserMissingId.validateSync();
  assert.ok(valErr1, 'Missing telegramId should trigger validation failure');
  assert.ok(valErr1.errors.telegramId, 'Error should reside on the telegramId field');

  // 3. Test negative balance throws error
  const invalidUserNegativeBalance = new User({
    telegramId: '87654321',
    balance: -0.01
  });
  const valErr2 = invalidUserNegativeBalance.validateSync();
  assert.ok(valErr2, 'Negative balance should trigger validation failure');
  assert.ok(valErr2.errors.balance, 'Error should reside on the balance field');
  assert.strictEqual(valErr2.errors.balance.message, 'Balance cannot be negative.');

  // 4. Test boundary balance (0 is allowed)
  const boundaryUser = new User({
    telegramId: '11223344',
    balance: 0
  });
  const valErr3 = boundaryUser.validateSync();
  assert.strictEqual(valErr3, undefined, 'Balance of 0 should be perfectly valid');

  // 5. Test virtual field `fullName` under multiple conditions
  // Case A: Both firstName and lastName are present
  const userBothNames = new User({
    telegramId: '1',
    firstName: 'Ahmed',
    lastName: 'Ali'
  });
  assert.strictEqual(userBothNames.fullName, 'Ahmed Ali', 'fullName virtual should combine first and last name');

  // Case B: Only firstName is present
  const userOnlyFirstName = new User({
    telegramId: '2',
    firstName: 'Ahmed'
  });
  assert.strictEqual(userOnlyFirstName.fullName, 'Ahmed', 'fullName virtual should fall back to firstName');

  // Case C: Only username is present
  const userOnlyUsername = new User({
    telegramId: '3',
    username: 'ahmed_usr'
  });
  assert.strictEqual(userOnlyUsername.fullName, 'ahmed_usr', 'fullName virtual should fall back to username when firstName is missing');

  // Case D: None of them are present
  const userAnonymous = new User({
    telegramId: '4'
  });
  assert.strictEqual(userAnonymous.fullName, 'Anonymous User', 'fullName virtual should fall back to Anonymous User when no identifiers exist');
});

test('Database Models - Deposit Schema Validations', () => {
  // 1. Test valid deposit validation
  const deposit = new Deposit({
    depositId: 'DEP-12345678-1234',
    telegramId: '12345678',
    amount: 150,
    senderPhone: '01012345678',
    receiptFileId: 'file_id_abc',
    status: 'pending'
  });

  const err = deposit.validateSync();
  assert.strictEqual(err, undefined, 'Valid deposit should pass validation checks');
  assert.strictEqual(deposit.status, 'pending', 'Status should match initialized value');

  // 2. Test status defaults to 'pending'
  const depositDefaultStatus = new Deposit({
    depositId: 'DEP-12345678-9999',
    telegramId: '12345678',
    amount: 50,
    senderPhone: '01012345678',
    receiptFileId: 'file_id_abc'
  });
  const errDefault = depositDefaultStatus.validateSync();
  assert.strictEqual(errDefault, undefined, 'Should be valid even without status');
  assert.strictEqual(depositDefaultStatus.status, 'pending', 'Status should default to pending');

  // 3. Test invalid status value throws validation error
  const invalidDepositStatus = new Deposit({
    depositId: 'DEP-12345678-1234',
    telegramId: '12345678',
    amount: 150,
    senderPhone: '01012345678',
    receiptFileId: 'file_id_abc',
    status: 'invalid_status_value'
  });

  const valErr1 = invalidDepositStatus.validateSync();
  assert.ok(valErr1, 'Invalid status should trigger validation failure');
  assert.ok(valErr1.errors.status, 'Validation error should be related to status field');
  assert.ok(valErr1.errors.status.message.includes('is not a valid deposit status.'));

  // 4. Test required fields: depositId, telegramId, amount, senderPhone, receiptFileId
  const requiredFields = ['depositId', 'telegramId', 'amount', 'senderPhone', 'receiptFileId'];
  requiredFields.forEach(field => {
    const rawData = {
      depositId: 'DEP-12345678-1234',
      telegramId: '12345678',
      amount: 150,
      senderPhone: '01012345678',
      receiptFileId: 'file_id_abc'
    };
    delete rawData[field];
    const incompleteDeposit = new Deposit(rawData);
    const valErr = incompleteDeposit.validateSync();
    assert.ok(valErr, `Missing required field "${field}" should trigger validation failure`);
    assert.ok(valErr.errors[field], `Error should reside on the "${field}" field`);
  });

  // 5. Test amount constraints (min: 0.01)
  // Case A: 0 amount should fail
  const zeroAmountDeposit = new Deposit({
    depositId: 'DEP-12345678-1234',
    telegramId: '12345678',
    amount: 0,
    senderPhone: '01012345678',
    receiptFileId: 'file_id_abc'
  });
  const valErrZero = zeroAmountDeposit.validateSync();
  assert.ok(valErrZero, 'Deposit amount of 0 should fail validation');
  assert.ok(valErrZero.errors.amount);
  assert.strictEqual(valErrZero.errors.amount.message, 'Recharge amount must be greater than zero.');

  // Case B: Negative amount should fail
  const negativeAmountDeposit = new Deposit({
    depositId: 'DEP-12345678-1234',
    telegramId: '12345678',
    amount: -10,
    senderPhone: '01012345678',
    receiptFileId: 'file_id_abc'
  });
  const valErrNegative = negativeAmountDeposit.validateSync();
  assert.ok(valErrNegative, 'Negative deposit amount should fail validation');
  assert.ok(valErrNegative.errors.amount);

  // Case C: 0.01 amount should succeed (minimum threshold)
  const minAmountDeposit = new Deposit({
    depositId: 'DEP-12345678-1234',
    telegramId: '12345678',
    amount: 0.01,
    senderPhone: '01012345678',
    receiptFileId: 'file_id_abc'
  });
  const valErrMin = minAmountDeposit.validateSync();
  assert.strictEqual(valErrMin, undefined, 'Deposit amount of 0.01 should be valid');
});

test('Database Models - Order Schema Validations', () => {
  // 1. Test valid order validation
  const order = new Order({
    orderId: 'ORD-20260527-1234',
    telegramId: '12345678',
    serviceType: 'similarity_report',
    price: 45,
    fileId: 'file_123',
    status: 'in_progress'
  });

  const err = order.validateSync();
  assert.strictEqual(err, undefined, 'Valid order should pass validation checks');
  assert.strictEqual(order.status, 'in_progress', 'Status should match configured value');

  // 2. Test status default values (defaults to 'paid')
  const orderDefaultStatus = new Order({
    orderId: 'ORD-20260527-1234',
    telegramId: '12345678',
    serviceType: 'similarity_report',
    price: 45
  });
  const errDefault = orderDefaultStatus.validateSync();
  assert.strictEqual(errDefault, undefined, 'Should validate without status');
  assert.strictEqual(orderDefaultStatus.status, 'paid', 'Status should default to paid');

  // 3. Test required fields: orderId, telegramId, serviceType, price
  const requiredFields = ['orderId', 'telegramId', 'serviceType', 'price'];
  requiredFields.forEach(field => {
    const rawData = {
      orderId: 'ORD-20260527-1234',
      telegramId: '12345678',
      serviceType: 'similarity_report',
      price: 45
    };
    delete rawData[field];
    const incompleteOrder = new Order(rawData);
    const valErr = incompleteOrder.validateSync();
    assert.ok(valErr, `Missing required field "${field}" should trigger validation failure`);
    assert.ok(valErr.errors[field], `Error should reside on the "${field}" field`);
  });

  // 4. Test serviceType enum validation
  // Case A: Valid enum values
  const validServiceTypes = [
    'similarity_report',
    'similarity_exclude_report',
    'ai_writing_report',
    'both_reports',
    'cv_design',
    'portfolio_design',
    'pdf_to_word',
    'translation',
    'ai_reduction'
  ];
  validServiceTypes.forEach(srvType => {
    const orderInstance = new Order({
      orderId: `ORD-${srvType}`,
      telegramId: '12345678',
      serviceType: srvType,
      price: 10
    });
    assert.strictEqual(orderInstance.validateSync(), undefined, `Service type "${srvType}" must be valid`);
  });

  // Case B: Invalid enum value
  const invalidOrderService = new Order({
    orderId: 'ORD-INVALID',
    telegramId: '12345678',
    serviceType: 'some_random_unsupported_service',
    price: 10
  });
  const valErrService = invalidOrderService.validateSync();
  assert.ok(valErrService, 'Unsupported serviceType should trigger validation failure');
  assert.ok(valErrService.errors.serviceType);
  assert.ok(valErrService.errors.serviceType.message.includes('is not a supported service type.'));

  // 5. Test status enum validation
  // Case A: Valid statuses
  const validStatuses = ['pending_payment', 'paid', 'in_progress', 'completed', 'cancelled'];
  validStatuses.forEach(st => {
    const orderInstance = new Order({
      orderId: `ORD-${st}`,
      telegramId: '12345678',
      serviceType: 'similarity_report',
      price: 10,
      status: st
    });
    assert.strictEqual(orderInstance.validateSync(), undefined, `Status "${st}" must be valid`);
  });

  // Case B: Invalid status
  const invalidOrderStatus = new Order({
    orderId: 'ORD-INVALID-STATUS',
    telegramId: '12345678',
    serviceType: 'similarity_report',
    price: 10,
    status: 'shipped_out_by_courier'
  });
  const valErrStatus = invalidOrderStatus.validateSync();
  assert.ok(valErrStatus, 'Unsupported status should trigger validation failure');
  assert.ok(valErrStatus.errors.status);
  assert.ok(valErrStatus.errors.status.message.includes('is not a valid order status.'));

  // 6. Test price constraints (min: 0)
  // Case A: Negative price should fail
  const negativePriceOrder = new Order({
    orderId: 'ORD-NEG-PRICE',
    telegramId: '12345678',
    serviceType: 'similarity_report',
    price: -0.01
  });
  const valErrPriceNeg = negativePriceOrder.validateSync();
  assert.ok(valErrPriceNeg, 'Negative price should fail validation');
  assert.ok(valErrPriceNeg.errors.price);
  assert.strictEqual(valErrPriceNeg.errors.price.message, 'Service price cannot be negative.');

  // Case B: 0 price is allowed (e.g. for hand-priced ai_reduction)
  const freeOrder = new Order({
    orderId: 'ORD-FREE',
    telegramId: '12345678',
    serviceType: 'ai_reduction',
    price: 0
  });
  assert.strictEqual(freeOrder.validateSync(), undefined, 'Price of 0 should be perfectly valid');
});

test('Database Models - PromoCode Schema Validations', () => {
  // 1. Test valid PromoCode
  const promo = new PromoCode({
    code: 'SAVE50',
    rewardPoints: 50,
    maxUses: 5,
    usedBy: ['11111', '22222']
  });

  const err = promo.validateSync();
  assert.strictEqual(err, undefined, 'Valid promo code should pass validation checks');

  // Test defaults
  assert.strictEqual(promo.code, 'SAVE50');
  assert.strictEqual(promo.rewardPoints, 50);
  assert.strictEqual(promo.maxUses, 5);

  const promoDefaults = new PromoCode({
    code: 'WELCOME'
  });
  const errDefaults = promoDefaults.validateSync();
  assert.strictEqual(errDefaults, undefined, 'Promo code with default values should validate');
  assert.strictEqual(promoDefaults.rewardPoints, 0, 'rewardPoints should default to 0');
  assert.strictEqual(promoDefaults.maxUses, 1, 'maxUses should default to 1');
  assert.strictEqual(Array.isArray(promoDefaults.usedBy), true, 'usedBy should default to an array');
  assert.strictEqual(promoDefaults.usedBy.length, 0, 'usedBy should default to empty');

  // 2. Test required fields
  const requiredFields = ['code'];
  requiredFields.forEach(field => {
    const rawData = {
      code: 'TESTCODE'
    };
    delete rawData[field];
    const incompletePromo = new PromoCode(rawData);
    const valErr = incompletePromo.validateSync();
    assert.ok(valErr, `Missing required field "${field}" should trigger validation failure`);
    assert.ok(valErr.errors[field], `Error should reside on the "${field}" field`);
  });

  // 3. Test rewardPoints constraints (min: 0)
  const negativeRewardPromo = new PromoCode({
    code: 'NEG_REWARD',
    rewardPoints: -5
  });
  const valErrReward = negativeRewardPromo.validateSync();
  assert.ok(valErrReward, 'Negative reward points should trigger validation failure');
  assert.ok(valErrReward.errors.rewardPoints);
  assert.strictEqual(valErrReward.errors.rewardPoints.message, 'Reward points cannot be negative.');

  // 4. Test maxUses constraints (min: 1)
  // Case A: 0 maxUses should fail
  const zeroMaxUsesPromo = new PromoCode({
    code: 'ZERO_MAX',
    maxUses: 0
  });
  const valErrMaxZero = zeroMaxUsesPromo.validateSync();
  assert.ok(valErrMaxZero, '0 max uses should fail');
  assert.ok(valErrMaxZero.errors.maxUses);
  assert.strictEqual(valErrMaxZero.errors.maxUses.message, 'Maximum usage must be at least 1.');

  // Case B: Negative maxUses should fail
  const negMaxUsesPromo = new PromoCode({
    code: 'NEG_MAX',
    maxUses: -3
  });
  const valErrMaxNeg = negMaxUsesPromo.validateSync();
  assert.ok(valErrMaxNeg, 'Negative max uses should fail');
  assert.ok(valErrMaxNeg.errors.maxUses);

  // 5. Test virtual field `isValid`
  // Case A: usedBy.length < maxUses -> isValid returns true
  const validPromoVirtual = new PromoCode({
    code: 'VALID_VIR',
    maxUses: 3,
    usedBy: ['user1', 'user2']
  });
  assert.strictEqual(validPromoVirtual.isValid, true, 'Promo should be valid if it has remaining uses');

  // Case B: usedBy.length === maxUses -> isValid returns false
  const limitReachedPromo = new PromoCode({
    code: 'LIMIT_REACHED',
    maxUses: 2,
    usedBy: ['user1', 'user2']
  });
  assert.strictEqual(limitReachedPromo.isValid, false, 'Promo should be invalid if usage reaches the limit');

  // Case C: usedBy.length > maxUses -> isValid returns false
  const exceededPromo = new PromoCode({
    code: 'EXCEEDED',
    maxUses: 1,
    usedBy: ['user1', 'user2']
  });
  assert.strictEqual(exceededPromo.isValid, false, 'Promo should be invalid if usage exceeds the limit');
});

test('Database Models - Session Schema Validations', () => {
  // 1. Test valid Session structure
  const session = new Session({
    key: 'user_session:12345678',
    data: { step: 'awaiting_amount', amount: 150 }
  });

  const err = session.validateSync();
  assert.strictEqual(err, undefined, 'Valid session should not throw validation errors');
  assert.strictEqual(session.key, 'user_session:12345678');
  assert.strictEqual(session.data.step, 'awaiting_amount');

  // 2. Test defaults
  const sessionDefaults = new Session({
    key: 'user_session:default'
  });
  const errDefaults = sessionDefaults.validateSync();
  assert.strictEqual(errDefaults, undefined, 'Default session should validate');
  assert.deepStrictEqual(sessionDefaults.data, {}, 'Data should default to empty object');

  // 3. Test required fields
  const missingKeySession = new Session({
    data: { temp: 'xyz' }
  });
  const valErr = missingKeySession.validateSync();
  assert.ok(valErr, 'Missing session key should trigger validation failure');
  assert.ok(valErr.errors.key);
});

test('Database Models - SystemConfig Schema Validations', () => {
  // 1. Test valid SystemConfig structure
  const config = new SystemConfig({
    key: 'maintenance_mode',
    value: true
  });

  const err = config.validateSync();
  assert.strictEqual(err, undefined, 'Valid system configuration should validate');
  assert.strictEqual(config.key, 'maintenance_mode');
  assert.strictEqual(config.value, true);

  // Mixed type permits objects, strings, numbers, booleans
  const configObject = new SystemConfig({
    key: 'admin_notification_settings',
    value: { channels: ['group1', 'group2'], notifyOnDeposit: true }
  });
  assert.strictEqual(configObject.validateSync(), undefined, 'Objects should be valid mixed values');

  // 2. Test required fields
  const missingKeyConfig = new SystemConfig({
    value: 'some_val'
  });
  const valErrKey = missingKeyConfig.validateSync();
  assert.ok(valErrKey, 'Missing key should fail');
  assert.ok(valErrKey.errors.key);

  const missingValConfig = new SystemConfig({
    key: 'some_key'
  });
  const valErrVal = missingValConfig.validateSync();
  assert.ok(valErrVal, 'Missing value should fail');
  assert.ok(valErrVal.errors.value);
});
