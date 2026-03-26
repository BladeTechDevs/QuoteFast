import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

// Minimal user fixture
const mockUser = {
  id: 'user-uuid-1',
  email: 'test@example.com',
  passwordHash: '',
  name: 'Test User',
  refreshToken: null,
  plan: 'FREE',
  company: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('mock-token'),
            verify: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwtService = module.get(JwtService);
  });

  describe('register', () => {
    it('should throw ConflictException (409) when email is already in use', async () => {
      // Simulate existing user found in DB
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException (401) when password is incorrect', async () => {
      // Hash a different password so comparison fails
      const hash = await bcrypt.hash('correct-password', 12);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        passwordHash: hash,
      });

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException (401) when user does not exist', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nonexistent@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('should throw UnauthorizedException (401) when refresh token is invalid (bad signature)', async () => {
      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('invalid signature');
      });

      await expect(service.refresh('invalid.refresh.token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException (401) when refresh token does not match stored hash', async () => {
      // Token verifies OK but hash comparison fails
      (jwtService.verify as jest.Mock).mockReturnValue({
        sub: mockUser.id,
        email: mockUser.email,
      });

      const differentTokenHash = await bcrypt.hash('different-token', 12);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        refreshToken: differentTokenHash,
      });

      await expect(service.refresh('valid.but.mismatched.token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException (401) when user has no stored refresh token', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({
        sub: mockUser.id,
        email: mockUser.email,
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        refreshToken: null,
      });

      await expect(service.refresh('some.refresh.token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
