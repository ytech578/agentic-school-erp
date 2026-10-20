import { NotFoundException } from '@nestjs/common';
import { TenantCacheService } from './tenant-cache.service';

describe('School-scoped reference cache', () => {
  function setup() {
    const values = new Map<string, string>();
    const redis = {
      get: jest.fn((key: string) => Promise.resolve(values.get(key) ?? null)),
      set: jest.fn((key: string, value: string) => {
        values.set(key, value);
        return Promise.resolve();
      }),
      del: jest.fn((key: string) => {
        values.delete(key);
        return Promise.resolve();
      }),
    };
    const db = {
      academicYear: { findFirst: jest.fn().mockResolvedValue(null) },
      department: { findMany: jest.fn().mockResolvedValue([]) },
      designation: { findMany: jest.fn().mockResolvedValue([]) },
      class: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return {
      service: new TenantCacheService(redis as never, db as never),
      redis,
      db,
      values,
    };
  }

  it('resolves a requested year within its school and reuses only that school cache', async () => {
    const { service, redis, db } = setup();
    db.academicYear.findFirst.mockResolvedValueOnce({ id: 'school-a-year' });
    expect(await service.resolveActiveYear('school-a', ' AY-2026-2027 ')).toBe(
      'school-a-year',
    );
    expect(db.academicYear.findFirst).toHaveBeenCalledWith({
      where: {
        schoolId: 'school-a',
        OR: [
          { id: 'AY-2026-2027' },
          { name: 'AY-2026-2027' },
          { name: '2026-2027' },
        ],
      },
    });
    expect(redis.set).toHaveBeenCalledWith(
      'school:school-a:ay_res:AY-2026-2027',
      'school-a-year',
      86400,
    );
    expect(await service.resolveActiveYear('school-a', 'AY-2026-2027')).toBe(
      'school-a-year',
    );
    expect(db.academicYear.findFirst).toHaveBeenCalledTimes(1);
    await expect(
      service.resolveActiveYear('school-b', 'AY-2026-2027'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([undefined, '', '   ', 'undefined', 'null'])(
    'uses the active school year for an empty selection %s',
    async (selection) => {
      const { service, db } = setup();
      db.academicYear.findFirst.mockResolvedValue({ id: 'active-year' });
      expect(await service.resolveActiveYear('school-a', selection)).toBe(
        'active-year',
      );
      expect(db.academicYear.findFirst).toHaveBeenCalledWith({
        where: { schoolId: 'school-a', isActive: true },
      });
    },
  );

  it('falls back to the latest school year and invalidates the active selection', async () => {
    const { service, db, redis } = setup();
    db.academicYear.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'latest-year' });
    expect(await service.resolveActiveYear('school-a')).toBe('latest-year');
    expect(db.academicYear.findFirst).toHaveBeenLastCalledWith({
      where: { schoolId: 'school-a' },
      orderBy: { startDate: 'desc' },
    });
    expect(await service.resolveActiveYear('school-a')).toBe('latest-year');
    expect(db.academicYear.findFirst).toHaveBeenCalledTimes(2);
    await service.invalidateActiveYear('school-a');
    expect(redis.del).toHaveBeenCalledWith('school:school-a:ay_active');
    await expect(service.resolveActiveYear('school-a')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('falls back to the active year when the requested identifier is not found', async () => {
    const { service, db } = setup();
    db.academicYear.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'active-year' });
    expect(await service.resolveActiveYear('school-a', 'unknown')).toBe(
      'active-year',
    );
    expect(db.academicYear.findFirst).toHaveBeenLastCalledWith({
      where: { schoolId: 'school-a', isActive: true },
    });
  });

  it('caches departments separately per school and refreshes after invalidation', async () => {
    const { service, db, redis } = setup();
    const a = [{ id: 'dept-a', schoolId: 'school-a', name: 'Science' }];
    const b = [{ id: 'dept-b', schoolId: 'school-b', name: 'Languages' }];
    db.department.findMany.mockResolvedValueOnce(a).mockResolvedValueOnce(b);
    expect(await service.getDepartments('school-a')).toEqual(a);
    expect(await service.getDepartments('school-b')).toEqual(b);
    expect(await service.getDepartments('school-a')).toEqual(a);
    expect(db.department.findMany).toHaveBeenCalledTimes(2);
    expect(db.department.findMany).toHaveBeenCalledWith({
      where: { schoolId: 'school-a' },
      orderBy: { name: 'asc' },
    });
    expect(redis.set).toHaveBeenCalledWith(
      'school:school-a:departments',
      JSON.stringify(a),
      604800,
    );
    await service.invalidateDepartments('school-a');
    expect(await service.getDepartments('school-a')).toEqual([]);
    expect(await service.getDepartments('school-b')).toEqual(b);
  });

  it('loads only active school designations and invalidates their cache', async () => {
    const { service, db, redis } = setup();
    const rows = [{ id: 'designation', schoolId: 'school-a', isActive: true }];
    db.designation.findMany.mockResolvedValueOnce(rows);
    expect(await service.getDesignations('school-a')).toEqual(rows);
    expect(await service.getDesignations('school-a')).toEqual(rows);
    expect(db.designation.findMany).toHaveBeenCalledTimes(1);
    expect(db.designation.findMany).toHaveBeenCalledWith({
      where: { schoolId: 'school-a', isActive: true },
      orderBy: { name: 'asc' },
    });
    await service.invalidateDesignations('school-a');
    expect(redis.del).toHaveBeenCalledWith('school:school-a:designations');
    expect(await service.getDesignations('school-a')).toEqual([]);
  });

  it('loads ordered school classes with sections and invalidates their cache', async () => {
    const { service, db, redis } = setup();
    const rows = [
      { id: 'class-a', schoolId: 'school-a', sections: [{ id: 'section-a' }] },
    ];
    db.class.findMany.mockResolvedValueOnce(rows);
    expect(await service.getClassesAndSections('school-a')).toEqual(rows);
    expect(await service.getClassesAndSections('school-a')).toEqual(rows);
    expect(db.class.findMany).toHaveBeenCalledTimes(1);
    expect(db.class.findMany).toHaveBeenCalledWith({
      where: { schoolId: 'school-a' },
      orderBy: { numericLevel: 'asc' },
      include: { sections: { orderBy: { name: 'asc' } } },
    });
    await service.invalidateClassesAndSections('school-a');
    expect(redis.del).toHaveBeenCalledWith('school:school-a:classes_sections');
    expect(await service.getClassesAndSections('school-a')).toEqual([]);
  });

  it('does not query or cache another tenant when its database lookup fails', async () => {
    const { service, db, redis } = setup();
    db.department.findMany.mockRejectedValue(new Error('Database unavailable'));
    await expect(service.getDepartments('school-a')).rejects.toThrow(
      'Database unavailable',
    );
    expect(redis.set).not.toHaveBeenCalled();
    expect(db.department.findMany).toHaveBeenCalledTimes(1);
  });
});
