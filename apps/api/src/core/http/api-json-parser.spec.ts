import express from 'express';
import request from 'supertest';
import { apiJsonParser } from './api-json-parser';

describe('API protocol JSON parser', () => {
  const app = express();
  app.use(apiJsonParser());
  app.all('/protocol', (req, res) => res.json(req.body ?? null));

  it.each(['POST', 'PUT', 'PATCH'])(
    'parses real SCIM %s payloads with the registered media type',
    async (method) => {
      const response = await request(app)
        [method.toLowerCase() as 'post' | 'put' | 'patch']('/protocol')
        .set('Content-Type', 'application/scim+json; charset=utf-8')
        .send(
          JSON.stringify({
            userName: 'synthetic@school.invalid',
            active: true,
          }),
        )
        .expect(200);
      expect(response.body).toEqual({
        userName: 'synthetic@school.invalid',
        active: true,
      });
    },
  );

  it('preserves ordinary JSON support', async () => {
    const response = await request(app)
      .post('/protocol')
      .send({ example: true })
      .expect(200);
    expect(response.body).toEqual({ example: true });
  });

  it('rejects malformed SCIM JSON rather than passing an empty body', async () => {
    await request(app)
      .post('/protocol')
      .set('Content-Type', 'application/scim+json')
      .send('{invalid')
      .expect(400);
  });

  it('does not parse unrelated content types as JSON', async () => {
    const response = await request(app)
      .post('/protocol')
      .set('Content-Type', 'text/plain')
      .send('{"example":true}')
      .expect(200);
    expect(response.body).toBeNull();
  });
});
