import request from 'supertest';
// Certifique-se de que seu index.js exporta o 'app' (ex: export default app ou module.exports = app)
import app from './index.js'; 

describe('API Backend - Testes Básicos', () => {
  
  it('GET /status deve retornar status do backend', async () => {
    const res = await request(app).get('/status');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('ready');
  });

  it('GET /contacts sem autenticação deve retornar 401', async () => {
    const res = await request(app).get('/contacts');
    // Agora que você corrigiu a rota no index.js, ela deve retornar 401 ou 403
    expect([401, 403]).toContain(res.statusCode);
  });

  it('POST /send sem token deve falhar', async () => {
    const res = await request(app).post('/send').send({
      number: '5511999999999',
      message: 'Teste'
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});