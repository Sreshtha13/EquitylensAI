import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { memoryStore } from '../src/db/userRepository.js';
import { memoryPortfolioStore } from '../src/portfolio/repositories/portfolioRepository.js';
import { memoryResearchProjectStore } from '../src/research/repositories/researchProjectRepository.js';

describe('Security & Multi-Tenant Authorization Isolation', () => {
  const app = createApp();
  const USER_A = 'user-alpha-1111-1111';
  const USER_B = 'user-bravo-2222-2222';

  it('prevents User B from accessing, modifying, or deleting User A watchlists', async () => {
    memoryStore.clear();

    // User A creates a watchlist
    const createRes = await request(app)
      .post('/api/v1/watchlists')
      .set('x-test-user-id', USER_A)
      .send({ name: 'Alpha Focus Tech', description: 'User A private list' });

    expect(createRes.status).toBe(201);
    const watchlistId = createRes.body.data.id;

    // User B attempts to GET User A's watchlist
    const getRes = await request(app)
      .get(`/api/v1/watchlists/${watchlistId}`)
      .set('x-test-user-id', USER_B);

    expect([403, 404]).toContain(getRes.status);

    // User B attempts to DELETE User A's watchlist
    const delRes = await request(app)
      .delete(`/api/v1/watchlists/${watchlistId}`)
      .set('x-test-user-id', USER_B);

    expect([403, 404]).toContain(delRes.status);
  });

  it('prevents User B from accessing or creating transactions in User A portfolios', async () => {
    memoryPortfolioStore.clear();

    // User A creates portfolio
    const createRes = await request(app)
      .post('/api/v1/portfolios')
      .set('x-test-user-id', USER_A)
      .send({ name: 'Retirement Alpha', baseCurrency: 'INR' });

    expect(createRes.status).toBe(201);
    const portfolioId = createRes.body.data.id;

    // User B attempts to access User A's portfolio
    const getRes = await request(app)
      .get(`/api/v1/portfolios/${portfolioId}`)
      .set('x-test-user-id', USER_B);

    expect([403, 404]).toContain(getRes.status);

    // User B attempts to record a transaction in User A's portfolio
    const txRes = await request(app)
      .post(`/api/v1/portfolios/${portfolioId}/transactions`)
      .set('x-test-user-id', USER_B)
      .send({
        type: 'BUY',
        symbol: 'RELIANCE',
        exchange: 'NSE',
        quantity: 10,
        price: 2500,
        currency: 'INR',
        tradeDate: new Date().toISOString(),
      });

    expect([403, 404]).toContain(txRes.status);
  });

  it('prevents User B from accessing User A research projects and reports', async () => {
    memoryResearchProjectStore.clear();

    // User A creates research project
    const projRes = await request(app)
      .post('/api/v1/research')
      .set('x-test-user-id', USER_A)
      .send({
        title: 'Project Alpha Confidential',
        symbol: 'INFY',
        exchange: 'NSE',
      });

    expect(projRes.status).toBe(201);
    const projectId = projRes.body.data.id;

    // User B attempts to view project
    const getRes = await request(app)
      .get(`/api/v1/research/${projectId}`)
      .set('x-test-user-id', USER_B);

    expect([403, 404]).toContain(getRes.status);

    // User B attempts to delete project
    const delRes = await request(app)
      .delete(`/api/v1/research/${projectId}`)
      .set('x-test-user-id', USER_B);

    expect([403, 404]).toContain(delRes.status);
  });

  it('rejects unauthenticated requests to protected resources', async () => {
    const unauthWatchlist = await request(app).get('/api/v1/watchlists');
    expect(unauthWatchlist.status).toBe(401);

    const unauthPortfolio = await request(app).get('/api/v1/portfolios');
    expect(unauthPortfolio.status).toBe(401);

    const unauthResearch = await request(app).get('/api/v1/research');
    expect(unauthResearch.status).toBe(401);

    const unauthAlerts = await request(app).get('/api/v1/alerts');
    expect(unauthAlerts.status).toBe(401);
  });
});
