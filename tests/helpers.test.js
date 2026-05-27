const test = require('node:test');
const assert = require('node:assert');
const { escapeHTML, normalizeDigits } = require('../bot/utils/helpers');

test('helpers.js - escapeHTML utility', () => {
  // Test basic escaping
  assert.strictEqual(escapeHTML('Hello <World> & Friends'), 'Hello &lt;World&gt; &amp; Friends');
  
  // Test null/undefined handling
  assert.strictEqual(escapeHTML(null), '');
  assert.strictEqual(escapeHTML(undefined), '');
  
  // Test numbers/booleans conversion
  assert.strictEqual(escapeHTML(123), '123');
  assert.strictEqual(escapeHTML(true), 'true');
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
});
