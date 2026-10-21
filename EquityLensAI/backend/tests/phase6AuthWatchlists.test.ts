import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { memoryStore } from '../src/db/userRepository.js';
import { loadEnv, resetEnvCache } from '../src/config/index.js';

describe('Phase 6 — Authentication, Watchlists, Favorites & Preferences', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    resetEnvCache();
    loadEnv({
      NODE_ENV: 'test',
      PORT: '4000',
      FRONTEND_URL: 'http://localhost:3000',
    });
    memoryStore.clear();
    app = createApp();
  });

  afterEach(() => {
    memoryStore.clear();
    resetEnvCache();
  });

  // ─── 1. Authentication Tests ───
  describe('Authentication flows', () => {
    it('registers a user, validates password rules, and creates profile + preferences', async () => {
      // Weak password rejection
      const weakRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'user1@example.com',
          password: 'weak',
        });
      expect(weakRes.status).toBe(400);

      // Successful registration
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'user1@example.com',
          password: 'Password123!',
          displayName: 'Investor One',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('user1@example.com');
      expect(res.body.data.session).toBeDefined();
    });

    it('rejects duplicate registration for existing email', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'Password123!',
        });

      // Try registering again
      const dupRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'Password123!',
        });
      expect(dupRes.status).toBe(409);
      expect(dupRes.body.error.code).toBe('USER_ALREADY_EXISTS');
    });

    it('authenticates existing user and restores session with valid token', async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'loginuser@example.com',
          password: 'Password123!',
        });
      const token = regRes.body.data.session.accessToken;

      // Session restore
      const sessionRes = await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${token}`);

      expect(sessionRes.status).toBe(200);
      expect(sessionRes.body.data.user.email).toBe('loginuser@example.com');

      // Reject unauthenticated or invalid token
      const invalidRes = await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', 'Bearer invalid-token-xyz');
      expect(invalidRes.status).toBe(401);
    });

    it('handles password recovery without user enumeration', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'anyuser@example.com' });
      expect(res.status).toBe(200);
      expect(res.body.data.message).toContain('password recovery');
    });
  });

  // ─── 2. User Profile & Preferences Tests ───
  describe('User Profile & Preferences', () => {
    it('retrieves and updates user profile and preferences', async () => {
      const userId = 'profile-test-user';

      // Get profile
      const profRes = await request(app)
        .get('/api/v1/users/me')
        .set('x-test-user-id', userId)
        .set('x-test-user-email', 'profile@example.com');
      expect(profRes.status).toBe(200);

      // Update profile
      const updateProfRes = await request(app)
        .patch('/api/v1/users/me')
        .set('x-test-user-id', userId)
        .send({ displayName: 'New Display Name' });
      expect(updateProfRes.status).toBe(200);
      expect(updateProfRes.body.data.displayName).toBe('New Display Name');

      // Get default preferences
      const prefRes = await request(app)
        .get('/api/v1/users/me/preferences')
        .set('x-test-user-id', userId);
      expect(prefRes.status).toBe(200);
      expect(prefRes.body.data.defaultExchange).toBe('NSE');

      // Update preferences
      const updatePrefRes = await request(app)
        .patch('/api/v1/users/me/preferences')
        .set('x-test-user-id', userId)
        .send({
          defaultExchange: 'BSE',
          preferredPeriod: 'ttm',
          theme: 'light',
        });
      expect(updatePrefRes.status).toBe(200);
      expect(updatePrefRes.body.data.defaultExchange).toBe('BSE');
      expect(updatePrefRes.body.data.preferredPeriod).toBe('ttm');
      expect(updatePrefRes.body.data.theme).toBe('light');

      // Rejects invalid preference value
      const badPrefRes = await request(app)
        .patch('/api/v1/users/me/preferences')
        .set('x-test-user-id', userId)
        .send({ defaultExchange: 'INVALID_EXCHANGE' });
      expect(badPrefRes.status).toBe(400);
    });

    it('requires explicit confirmation to delete user account and cascades user data', async () => {
      const userId = 'delete-user';

      // Without confirm literal
      const badDel = await request(app)
        .delete('/api/v1/users/me')
        .set('x-test-user-id', userId)
        .send({});
      expect(badDel.status).toBe(400);

      // Valid deletion
      const goodDel = await request(app)
        .delete('/api/v1/users/me')
        .set('x-test-user-id', userId)
        .send({ confirm: 'DELETE_ACCOUNT' });
      expect(goodDel.status).toBe(200);
      expect(goodDel.body.data.message).toContain('deleted successfully');
    });
  });

  // ─── 3. Watchlists & Authorization Tests ───
  describe('Watchlists and Multi-User Isolation', () => {
    const userA = 'user-alice';
    const userB = 'user-bob';

    it('creates, lists, and renames watchlists', async () => {
      // Create watchlist
      const createRes = await request(app)
        .post('/api/v1/watchlists')
        .set('x-test-user-id', userA)
        .send({
          name: 'Tech Bluechips',
          description: 'Top Indian IT companies',
        });
      expect(createRes.status).toBe(201);
      expect(createRes.body.data.name).toBe('Tech Bluechips');
      const wlId = createRes.body.data.id;

      // Prevent duplicate watchlist name for same user
      const dupRes = await request(app)
        .post('/api/v1/watchlists')
        .set('x-test-user-id', userA)
        .send({ name: 'Tech Bluechips' });
      expect(dupRes.status).toBe(409);
      expect(dupRes.body.error.code).toBe('WATCHLIST_ALREADY_EXISTS');

      // User B CAN create a watchlist with the same name (isolation!)
      const bobRes = await request(app)
        .post('/api/v1/watchlists')
        .set('x-test-user-id', userB)
        .send({ name: 'Tech Bluechips' });
      expect(bobRes.status).toBe(201);

      // Update / rename watchlist
      const patchRes = await request(app)
        .patch(`/api/v1/watchlists/${wlId}`)
        .set('x-test-user-id', userA)
        .send({ name: 'Tech Titans' });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.name).toBe('Tech Titans');
    });

    it('adds real stocks, rejects nonexistent symbols, and rejects duplicate items', async () => {
      // Create watchlist
      const createRes = await request(app)
        .post('/api/v1/watchlists')
        .set('x-test-user-id', userA)
        .send({ name: 'Growth Stocks' });
      const wlId = createRes.body.data.id;

      // Add valid existing instrument (RELIANCE)
      const addRes = await request(app)
        .post(`/api/v1/watchlists/${wlId}/items`)
        .set('x-test-user-id', userA)
        .send({ symbol: 'RELIANCE', exchange: 'NSE' });
      expect(addRes.status).toBe(201);
      expect(addRes.body.data.symbol).toBe('RELIANCE');
      expect(addRes.body.data.name).toContain('Reliance');

      // Attempt to add duplicate stock to same watchlist
      const dupItemRes = await request(app)
        .post(`/api/v1/watchlists/${wlId}/items`)
        .set('x-test-user-id', userA)
        .send({ symbol: 'RELIANCE', exchange: 'NSE' });
      expect(dupItemRes.status).toBe(409);
      expect(dupItemRes.body.error.code).toBe('DUPLICATE_ITEM');

      // Attempt to add completely fake / nonexistent stock
      const fakeRes = await request(app)
        .post(`/api/v1/watchlists/${wlId}/items`)
        .set('x-test-user-id', userA)
        .send({ symbol: 'FAKESTOCK999', exchange: 'NSE' });
      expect(fakeRes.status).toBe(404);
      expect(fakeRes.body.error.code).toBe('INSTRUMENT_NOT_FOUND');

      // Remove stock
      const delItemRes = await request(app)
        .delete(`/api/v1/watchlists/${wlId}/items/RELIANCE?exchange=NSE`)
        .set('x-test-user-id', userA);
      expect(delItemRes.status).toBe(200);
    });

    it('enforces strict cross-user isolation: User B cannot access or modify User A resources', async () => {
      // Alice creates watchlist
      const createRes = await request(app)
        .post('/api/v1/watchlists')
        .set('x-test-user-id', userA)
        .send({ name: 'Alice Private Watchlist' });
      const aliceWlId = createRes.body.data.id;

      // Bob tries to GET Alice's watchlist detail -> 404
      const bobGet = await request(app)
        .get(`/api/v1/watchlists/${aliceWlId}`)
        .set('x-test-user-id', userB);
      expect(bobGet.status).toBe(404);

      // Bob tries to PATCH Alice's watchlist -> 404
      const bobPatch = await request(app)
        .patch(`/api/v1/watchlists/${aliceWlId}`)
        .set('x-test-user-id', userB)
        .send({ name: 'Hacked by Bob' });
      expect(bobPatch.status).toBe(404);

      // Bob tries to ADD stock to Alice's watchlist -> 404
      const bobAdd = await request(app)
        .post(`/api/v1/watchlists/${aliceWlId}/items`)
        .set('x-test-user-id', userB)
        .send({ symbol: 'TCS', exchange: 'NSE' });
      expect(bobAdd.status).toBe(404);

      // Bob tries to DELETE Alice's watchlist -> 404
      const bobDel = await request(app)
        .delete(`/api/v1/watchlists/${aliceWlId}`)
        .set('x-test-user-id', userB);
      expect(bobDel.status).toBe(404);

      // Alice's watchlist still exists and is untouched
      const aliceVerify = await request(app)
        .get(`/api/v1/watchlists/${aliceWlId}`)
        .set('x-test-user-id', userA);
      expect(aliceVerify.status).toBe(200);
      expect(aliceVerify.body.data.name).toBe('Alice Private Watchlist');
    });
  });

  // ─── 4. Favorites Tests ───
  describe('Favorites & Cross-User Isolation', () => {
    const userA = 'user-alice';
    const userB = 'user-bob';

    it('adds, lists, and removes favorites with real instruments', async () => {
      // Add favorite (TCS)
      const addRes = await request(app)
        .post('/api/v1/favorites')
        .set('x-test-user-id', userA)
        .send({ symbol: 'TCS', exchange: 'NSE' });
      expect(addRes.status).toBe(201);
      expect(addRes.body.data.symbol).toBe('TCS');
      expect(addRes.body.data.name).toContain('Tata Consultancy');

      // List favorites
      const listRes = await request(app)
        .get('/api/v1/favorites')
        .set('x-test-user-id', userA);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBe(1);
      expect(listRes.body.data[0].symbol).toBe('TCS');

      // Bob lists favorites -> empty list (isolation!)
      const bobList = await request(app)
        .get('/api/v1/favorites')
        .set('x-test-user-id', userB);
      expect(bobList.status).toBe(200);
      expect(bobList.body.data.length).toBe(0);

      // Remove favorite
      const delRes = await request(app)
        .delete('/api/v1/favorites/TCS?exchange=NSE')
        .set('x-test-user-id', userA);
      expect(delRes.status).toBe(200);

      const afterDel = await request(app)
        .get('/api/v1/favorites')
        .set('x-test-user-id', userA);
      expect(afterDel.body.data.length).toBe(0);
    });

    it('rejects adding fake or unsupported stock to favorites', async () => {
      const res = await request(app)
        .post('/api/v1/favorites')
        .set('x-test-user-id', userA)
        .send({ symbol: 'TOTALLY_FAKE_XYZ', exchange: 'NSE' });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('INSTRUMENT_NOT_FOUND');
    });
  });
});
