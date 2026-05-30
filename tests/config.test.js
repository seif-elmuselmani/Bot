const test = require('node:test');
const assert = require('node:assert');
const servicesConfig = require('../bot/config/services');
const Order = require('../models/Order');

test('services.js - verify servicesConfig schema, prices, and schema alignment', () => {
  // Config must be an object
  assert.strictEqual(typeof servicesConfig, 'object', 'Configuration must be an object');
  assert.notStrictEqual(servicesConfig, null, 'Configuration must not be null');

  // Verify all expected services keys exist
  const expectedServices = [
    'similarity_report',
    'similarity_exclude',
    'ai_writing',
    'both_reports',
    'design_create_cv',
    'design_edit_cv',
    'design_create_portfolio',
    'design_edit_portfolio',
    'ai_reduction'
  ];

  expectedServices.forEach(key => {
    assert.ok(servicesConfig[key], `Service config for "${key}" should exist`);
  });

  // Get allowed service types enum from the database Order schema dynamically
  const allowedDbServiceTypes = Order.schema.path('serviceType').enumValues;
  assert.ok(Array.isArray(allowedDbServiceTypes), 'Order schema serviceType enum values should be an array');
  assert.ok(allowedDbServiceTypes.length > 0, 'Order schema serviceType enum should not be empty');

  // Check each configured service in detail
  for (const [key, service] of Object.entries(servicesConfig)) {
    // 1. Structure Checks
    assert.ok(service, `Service "${key}" config object should be defined`);
    assert.strictEqual(typeof service.name, 'string', `Service "${key}" name must be a string`);
    assert.ok(service.name.trim().length > 0, `Service "${key}" name must not be empty`);
    
    assert.strictEqual(typeof service.type, 'string', `Service "${key}" type must be a string`);
    assert.strictEqual(typeof service.price, 'number', `Service "${key}" price must be a number`);

    // 2. Strict key verification: config object shouldn't contain unexpected extra fields
    const serviceKeys = Object.keys(service);
    const expectedKeys = ['name', 'type', 'price'];
    serviceKeys.forEach(k => {
      assert.ok(expectedKeys.includes(k), `Service "${key}" config contains unexpected key: "${k}"`);
    });

    // 3. Price boundary conditions
    assert.ok(service.price >= 0, `Service "${key}" price must be non-negative. Found: ${service.price}`);
    assert.ok(Number.isFinite(service.price), `Service "${key}" price must be a finite number`);

    // 4. Database schema alignment check
    // This asserts that the "type" field specified in the services configuration exactly matches
    // one of the allowed serviceType enum values in the Mongoose Order model.
    assert.ok(
      allowedDbServiceTypes.includes(service.type),
      `Service "${key}" type "${service.type}" is NOT defined in the Order database schema enum values: [${allowedDbServiceTypes.join(', ')}]`
    );
  }

  // Verify hand-priced service (ai_reduction) has 0 placeholder price in config
  assert.strictEqual(servicesConfig.ai_reduction.price, 0, 'ai_reduction price must be 0 (hand-priced)');
});
