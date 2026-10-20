import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BreakGlassService } from './break-glass.service';
import { EnterpriseIdentityController } from './enterprise-identity.controller';
import { FederationController } from './federation.controller';
import { FederationService } from './federation.service';
import { IdentityProviderService } from './identity-provider.service';
import { ScimController } from './scim.controller';
import { ScimService } from './scim.service';
import { ScimTokenGuard } from './scim-token.guard';
import { SessionAdministrationService } from './session-administration.service';

@Module({
  imports: [AuthModule],
  controllers: [
    EnterpriseIdentityController,
    FederationController,
    ScimController,
  ],
  providers: [
    BreakGlassService,
    FederationService,
    IdentityProviderService,
    ScimService,
    ScimTokenGuard,
    SessionAdministrationService,
  ],
})
export class EnterpriseIdentityModule {}
