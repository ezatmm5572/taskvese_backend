import test from 'node:test';
import assert from 'node:assert/strict';

process.env.ENCRYPTION_KEY_ENV ||= '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const { encrypt, decrypt } = await import('../src/commn/utils/security/encrypt.js');
const { revoke_key, get_revoke_key } = await import('../src/DB/redis/redise.service.js');
const { normalizeTaskStatus, TaskStatusEnum } = await import('../src/commn/enums/task.enums.js');
const { getMemberTeamRole, isTeamManager, canManageTask } = await import('../src/commn/utils/permissions.js');

test('AES encryption round-trips and uses a fresh IV', () => {
  const value = 'TaskVerse secure payload';
  const encrypted1 = encrypt(value);
  const encrypted2 = encrypt(value);
  assert.equal(decrypt(encrypted1), value);
  assert.notEqual(encrypted1, encrypted2);
});

test('AES decrypt rejects malformed ciphertext', () => {
  assert.throws(() => decrypt('not-an-encrypted-value'), /format/i);
});

test('revocation key helpers accept userId and legacy memberId', () => {
  assert.equal(revoke_key({ userId: 'u1', jti: 'j1' }), 'revoked_token::u1::j1');
  assert.equal(revoke_key({ memberId: 'u1', jti: 'j1' }), 'revoked_token::u1::j1');
  assert.equal(get_revoke_key({ memberId: 'u1' }), 'revoked_token::u1::');
});

test('task status aliases normalize consistently', () => {
  assert.equal(normalizeTaskStatus('complete'), TaskStatusEnum.COMPLETED);
  assert.equal(normalizeTaskStatus('fail'), TaskStatusEnum.FAILED);
  assert.equal(normalizeTaskStatus('inProgress'), TaskStatusEnum.IN_PROGRESS);
});

test('an admin cannot manage another admin tenant team by role alone', () => {
  const team = { _id: 'team-1', addedBy: 'admin-a', teamAdims: ['admin-a'], teamMembers: ['member-a'] };
  const otherAdmin = { _id: 'admin-b', role: 'admin', teams: [] };
  const owner = { _id: 'admin-a', role: 'admin', teams: [] };
  assert.equal(getMemberTeamRole(team, otherAdmin), null);
  assert.equal(isTeamManager(team, otherAdmin), false);
  assert.equal(isTeamManager(team, owner), true);
  assert.equal(canManageTask(otherAdmin, { createdBy: 'admin-a' }, team), false);
});
