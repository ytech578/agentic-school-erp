import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import * as bcrypt from 'bcryptjs';
import { requireSchoolId, assertSchoolAccess } from '../../core/tenant/tenant.util';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string, schoolId?: string, isGlobal = false) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        avatarUrl: true,
        lastLoginAt: true,
        createdAt: true,
        schoolId: true,
        school: { select: { id: true, name: true, code: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!isGlobal && schoolId && user.schoolId !== schoolId) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  async findAll(
    schoolId: string,
    query: {
      page?: number;
      limit?: number;
      role?: string;
      status?: string;
      search?: string;
    },
    requestingUser?: any,
  ) {
    const { page = 1, limit = 20, role, status, search } = query;
    const skip = (page - 1) * limit;

    const isGlobal = requestingUser?.role === 'SUPER_ADMIN';
    const effectiveSchoolId =
      isGlobal && !schoolId ? undefined : requireSchoolId(schoolId, 'List users');

    const where: any = effectiveSchoolId ? { schoolId: effectiveSchoolId } : {};
    if (role) where.role = role;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          phone: true,
          avatarUrl: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async createUser(
    schoolId: string,
    data: {
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      phone?: string;
      password?: string;
    },
    requestingUser?: any,
  ) {
    if (requestingUser?.role !== 'SUPER_ADMIN') {
      schoolId = requireSchoolId(schoolId, 'Create user');
    }

    if (requestingUser?.role === 'SCHOOL_ADMIN' && (data.role === 'SUPER_ADMIN' || data.role === 'SCHOOL_ADMIN')) {
      throw new ForbiddenException('School Admins cannot create Super Admins or other School Admins');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });
    if (existing) throw new ConflictException('Email already exists');

    const password =
      data.password || Math.random().toString(36).slice(-10) + 'A1!';
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await this.prisma.user.create({
      data: {
        schoolId,
        email: data.email.toLowerCase(),
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role as any,
        phone: data.phone,
        passwordHash,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    return { ...user, temporaryPassword: data.password ? undefined : password };
  }

  async updateProfile(id: string, data: { avatarUrl?: string; phone?: string; firstName?: string; lastName?: string }) {
    return this.prisma.user.update({
      where: { id },
      data: {
        avatarUrl: data.avatarUrl,
        phone: data.phone,
        firstName: data.firstName,
        lastName: data.lastName,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatarUrl: true,
      },
    });
  }

  async updateUser(
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      role?: string;
    },
    requestingUser?: any,
  ) {
    const targetUser = await this.prisma.user.findUnique({ where: { id } });
    if (!targetUser) throw new NotFoundException('User not found');

    if (requestingUser?.role !== 'SUPER_ADMIN') {
      assertSchoolAccess(requestingUser?.schoolId, targetUser.schoolId);
    }

    if (requestingUser?.role === 'SCHOOL_ADMIN' && (data.role === 'SUPER_ADMIN' || data.role === 'SCHOOL_ADMIN')) {
      throw new ForbiddenException('School Admins cannot assign Super Admin or School Admin roles');
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: data.role as any,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
      },
    });
  }

  async updateStatus(id: string, status: string, requestingUser?: any) {
    const targetUser = await this.prisma.user.findUnique({ where: { id } });
    if (!targetUser) throw new NotFoundException('User not found');

    if (requestingUser?.role !== 'SUPER_ADMIN') {
      assertSchoolAccess(requestingUser?.schoolId, targetUser.schoolId);
    }

    return this.prisma.user.update({
      where: { id },
      data: { status: status as any },
      select: { id: true, status: true },
    });
  }

  async resetPassword(id: string, newPassword: string, requestingUser?: any) {
    const targetUser = await this.prisma.user.findUnique({ where: { id } });
    if (!targetUser) throw new NotFoundException('User not found');

    if (requestingUser?.role !== 'SUPER_ADMIN') {
      assertSchoolAccess(requestingUser?.schoolId, targetUser.schoolId);
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    return { message: 'Password reset successfully' };
  }

  async deactivateUser(id: string, requestingUser?: any) {
    const targetUser = await this.prisma.user.findUnique({ where: { id } });
    if (!targetUser) throw new NotFoundException('User not found');

    if (requestingUser?.role !== 'SUPER_ADMIN') {
      assertSchoolAccess(requestingUser?.schoolId, targetUser.schoolId);
    }

    return this.prisma.user.update({
      where: { id },
      data: { status: 'INACTIVE' },
      select: { id: true, status: true },
    });
  }
}
