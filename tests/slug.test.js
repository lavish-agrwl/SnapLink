const mongoose = require('mongoose');
const {
  BASE62_ALPHABET,
  encodeBase62,
  generateDefaultSlug,
  generateUniqueSlug,
} = require('../src/utils/slug');

describe('Slug utilities', () => {
  test('encodeBase62 encodes known values', () => {
    expect(encodeBase62(0n)).toBe('0');
    expect(encodeBase62(1n)).toBe('1');
    expect(encodeBase62(61n)).toBe('Z'); // 61 → 'Z'
    expect(encodeBase62(62n)).toBe('10');
  });

  test('generateDefaultSlug returns deterministic slug for known ObjectId', () => {
    const objectId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
    const slug = generateDefaultSlug(objectId);
    const expected = encodeBase62(BigInt(`0x${objectId.toHexString()}`)).slice(0, 7);
    expect(slug).toBe(expected);
    expect(slug).toHaveLength(7);
  });

  test('generateUniqueSlug returns a slug when not existing', async () => {
    const existsFn = jest.fn().mockResolvedValue(false);
    const slug = await generateUniqueSlug(existsFn, { objectId: new mongoose.Types.ObjectId('000000000000000000000001') });
    expect(existsFn).toHaveBeenCalledTimes(1);
    expect(slug).toHaveLength(7);
  });

  test('generateUniqueSlug throws after max attempts', async () => {
    const existsFn = jest.fn().mockResolvedValue(true);
    await expect(
      generateUniqueSlug(existsFn, { maxAttempts: 3 })
    ).rejects.toThrow('Unable to generate a unique slug');
    expect(existsFn).toHaveBeenCalledTimes(3);
  });
});
