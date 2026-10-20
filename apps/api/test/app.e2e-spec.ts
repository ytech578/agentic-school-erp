import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Application health (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((response) => {
        const body = (response as { body: { status?: unknown } }).body;
        expect(body.status).toBe('ok');
      });
  });

  it('/auth/login rejects invalid payloads with 400', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'not-an-email', password: '' })
      .expect(400)
      .expect((response) => {
        const body = (response as { body: { error?: unknown } }).body;
        expect(body.error).toBe('VALIDATION_ERROR');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
