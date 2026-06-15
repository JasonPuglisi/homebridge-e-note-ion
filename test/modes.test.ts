import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { actionFor } from '../src/modes';

describe('actionFor', () => {
  it('maps the Quiet switch', () => {
    assert.equal(actionFor('quiet', true), 'quiet');
    assert.equal(actionFor('quiet', false), 'wake');
  });

  it('maps the Public switch (on = private content hidden)', () => {
    assert.equal(actionFor('public', true), 'public');
    assert.equal(actionFor('public', false), 'private');
  });
});
