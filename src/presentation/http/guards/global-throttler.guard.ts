import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
  InjectThrottlerOptions,
  InjectThrottlerStorage,
} from '@nestjs/throttler';

/**
 * Global throttler guard that applies only the 'global' throttler.
 * The 'login' throttler is intentionally excluded here — it is applied
 * exclusively by LoginThrottleGuard on the auth/login endpoint.
 *
 * NOTE: The filter must be applied in onModuleInit() (not just the constructor)
 * because ThrottlerGuard.onModuleInit() re-initializes this.throttlers from options.
 */
@Injectable()
export class GlobalThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
  ) {
    super(options, storageService, reflector);
  }

  async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    if (Array.isArray(this.throttlers)) {
      const globalThrottlers = this.throttlers.filter(
        (t: any) => t.name === 'global',
      );
      if (globalThrottlers.length > 0) {
        this.throttlers = globalThrottlers;
      }
    }
  }
}
