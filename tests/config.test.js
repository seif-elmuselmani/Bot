const test = require('node:test');
const assert = require('node:assert');
const servicesConfig = require('../bot/config/services');

test('services.js - verify servicesConfig schema and prices', () => {
  // Config should be an object
  assert.strictEqual(typeof servicesConfig, 'object');
  assert.notStrictEqual(servicesConfig, null);

  // Core services should exist
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
    const service = servicesConfig[key];
    
    assert.strictEqual(typeof service.name, 'string', `Service "${key}" name should be a string`);
    assert.strictEqual(typeof service.type, 'string', `Service "${key}" type should be a string`);
    assert.strictEqual(typeof service.price, 'number', `Service "${key}" price should be a number`);
    
    // Verify price constraints
    assert.ok(service.price >= 0, `Service "${key}" price must be non-negative`);
  });

  // Verify hand-priced service (ai_reduction) has 0 placeholder price in config
  assert.strictEqual(servicesConfig.ai_reduction.price, 0);
});
