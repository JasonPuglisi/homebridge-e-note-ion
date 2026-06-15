import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { generateSecret, hashSecret, isHash, verifySecret } from '../src/secret';

describe('secret', () => {
  it('generates distinct, high-entropy secrets', () => {
    const a = generateSecret();
    const b = generateSecret();
    assert.notEqual(a, b);
    assert.ok(a.length >= 24);
  });

  it('hashSecret produces a scrypt-prefixed, salted hash', () => {
    const h1 = hashSecret('hello');
    const h2 = hashSecret('hello');
    assert.ok(h1.startsWith('scrypt:'));
    assert.notEqual(h1, h2); // different salt each time
  });

  it('verifies the correct secret', () => {
    const p = generateSecret();
    assert.equal(verifySecret(p, hashSecret(p)), true);
  });

  it('rejects the wrong secret', () => {
    assert.equal(verifySecret('wrong', hashSecret('right')), false);
  });

  it('isHash recognizes our hash but not plaintext or the dropped legacy format', () => {
    assert.equal(isHash(hashSecret('x')), true);
    assert.equal(isHash('plaintext'), false);
    assert.equal(isHash('sha256:deadbeef'), false);
  });

  it('rejects malformed hashes without throwing', () => {
    assert.equal(verifySecret('x', 'scrypt:onlyonepart'), false);
    assert.equal(verifySecret('x', 'not-a-hash'), false);
    assert.equal(verifySecret('x', ''), false);
  });
});
