
import request from 'supertest';
import app from './index.js';

describe('API Backend - Testes básicos', () => {
  it('GET /status deve retornar status do backend', async () => {
    const res = await request(app).get('/status');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('ready');
  });

  it('GET /contacts sem autenticação deve falhar', async () => {
    const res = await request(app).get('/contacts');
    expect([401, 403]).toContain(res.statusCode);
  });

  it('POST /send sem token deve falhar', async () => {
    const res = await request(app).post('/send').send({ message: 'Teste' });
    expect([401, 403]).toContain(res.statusCode);
  });
});

describe('API Backend - Funcionalidades principais', () => {
  it('POST /schedule sem token deve falhar', async () => {
    const res = await request(app).post('/schedule').send({ numbers: ["5511999999999"], message: "Teste", sendAt: new Date().toISOString() });
    expect([401, 403]).toContain(res.statusCode);
  });

  it('POST /upload sem token deve falhar', async () => {
    const res = await request(app).post('/upload').send({ filename: "teste.txt", base64: "dGVzdGU=", mime: "text/plain" });
    expect([401, 403]).toContain(res.statusCode);
  });

  it('POST /campaigns sem nome deve retornar erro', async () => {
    const res = await request(app).post('/campaigns').send({ message: "Teste" });
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('POST /groups/create sem dados deve retornar erro', async () => {
    const res = await request(app).post('/groups/create').send({});
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /replies deve retornar 200', async () => {
    const res = await request(app).get('/replies');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('replies');
  });
});
