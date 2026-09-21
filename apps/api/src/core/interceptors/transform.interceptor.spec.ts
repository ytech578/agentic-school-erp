import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, firstValueFrom } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<any>;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  const createMockContext = (statusCode = 200) => {
    return {
      switchToHttp: () => ({
        getResponse: () => ({ statusCode }),
      }),
    } as unknown as ExecutionContext;
  };

  it('preserves meta and unwraps data when data and meta are present', async () => {
    const handlerResult = {
      data: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ],
      meta: { total: 50, page: 1, limit: 15, totalPages: 4 },
      message: 'Users loaded',
    };
    const callHandler: CallHandler = {
      handle: () => of(handlerResult),
    };

    const res = await firstValueFrom(
      interceptor.intercept(createMockContext(200), callHandler),
    );

    expect(res.success).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(res.data).toEqual(handlerResult.data);
    expect(res.meta).toEqual(handlerResult.meta);
    expect(res.message).toBe('Users loaded');
  });

  it('wraps raw object when no data key is present', async () => {
    const handlerResult = { foo: 'bar' };
    const callHandler: CallHandler = {
      handle: () => of(handlerResult),
    };

    const res = await firstValueFrom(
      interceptor.intercept(createMockContext(201), callHandler),
    );

    expect(res.success).toBe(true);
    expect(res.statusCode).toBe(201);
    expect(res.data).toEqual({ foo: 'bar' });
  });
});
