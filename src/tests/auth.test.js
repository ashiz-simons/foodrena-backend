const request = require('supertest');
const app = require('../server');

describe('Auth', () => {
  it('registers a user', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Test', email: `t${Date.now()}@test.com`, password: 'pass123' });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('token');
  }, 20000);
});
