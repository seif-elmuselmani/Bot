const test = require('node:test');
const assert = require('node:assert');
const User = require('../models/User');
const Order = require('../models/Order');
const Deposit = require('../models/Deposit');

test('Database Models - User Schema Validations', () => {
  // Test valid user structure validation
  const user = new User({
    telegramId: '12345678',
    username: 'test_user',
    firstName: 'Saif',
    balance: 100
  });

  const err = user.validateSync();
  assert.strictEqual(err, undefined, 'Valid user should not throw validation errors');

  // Test default values
  assert.strictEqual(user.isBanned, false);
  assert.strictEqual(user.referralRewardClaimed, false);
});

test('Database Models - Deposit Schema Validations', () => {
  // Test valid deposit validation
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

  // Test invalid status value throws validation error
  const invalidDeposit = new Deposit({
    depositId: 'DEP-12345678-1234',
    telegramId: '12345678',
    amount: 150,
    senderPhone: '01012345678',
    receiptFileId: 'file_id_abc',
    status: 'invalid_status_value'
  });

  const validationErr = invalidDeposit.validateSync();
  assert.ok(validationErr, 'Invalid status should trigger validation failure');
  assert.ok(validationErr.errors.status, 'Validation error should be related to status field');
});

test('Database Models - Order Schema Validations', () => {
  // Test default order status and validation
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
});
