import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthService } from './services/auth.service';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { LoginThrottleGuard } from './guards/login-throttle.guard';

import { APP_GUARD } from '@nestjs/core';


@Module({
  imports: [
    ConfigModule, // ← necesario para usar ConfigService aquí
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: configService.get<string>('jwt.accessExpiration', '15m'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    AuthService,
    TokenBlacklistService,
    JwtStrategy,
    LoginThrottleGuard,
  ],
  exports: [
    AuthService,
    TokenBlacklistService,
    LoginThrottleGuard,
  ],
})
export class AuthModule {}