import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ScimService } from './scim.service';
import { ScimTokenGuard } from './scim-token.guard';

interface ScimRequest {
  user: { id: string; schoolId: string };
}

interface ScimUserBody {
  externalId?: string;
  userName: string;
  active?: boolean;
  name?: { givenName?: string; familyName?: string };
  roles?: Array<{ value?: string } | string>;
}

interface ScimPatchBody {
  Operations?: Array<{ op?: string; path?: string; value?: unknown }>;
}

@ApiTags('SCIM 2.0')
@Controller('scim/v2')
export class ScimController {
  constructor(private readonly scim: ScimService) {}

  @Get('ServiceProviderConfig')
  @Header('Content-Type', 'application/scim+json')
  serviceProviderConfig() {
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
      patch: { supported: true },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 200 },
      changePassword: { supported: false },
      sort: { supported: false },
      etag: { supported: false },
      authenticationSchemes: [
        { type: 'oauthbearertoken', name: 'Bearer Token', primary: true },
      ],
    };
  }

  @Get('ResourceTypes')
  @Header('Content-Type', 'application/scim+json')
  resourceTypes() {
    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: 1,
      Resources: [
        {
          schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
          id: 'User',
          name: 'User',
          endpoint: '/Users',
          schema: 'urn:ietf:params:scim:schemas:core:2.0:User',
        },
      ],
    };
  }

  @Get('Schemas')
  @Header('Content-Type', 'application/scim+json')
  schemas() {
    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: 1,
      Resources: [
        {
          id: 'urn:ietf:params:scim:schemas:core:2.0:User',
          name: 'User',
          description: 'ERP user account',
          attributes: [
            {
              name: 'userName',
              type: 'string',
              required: true,
              uniqueness: 'server',
            },
            { name: 'active', type: 'boolean', required: false },
            { name: 'name', type: 'complex', required: true },
            { name: 'emails', type: 'complex', multiValued: true },
            { name: 'roles', type: 'complex', multiValued: true },
          ],
          meta: { resourceType: 'Schema' },
        },
      ],
    };
  }

  @Get('Users')
  @UseGuards(ScimTokenGuard)
  @Header('Content-Type', 'application/scim+json')
  list(
    @Request() request: ScimRequest,
    @Query('filter') filter?: string,
    @Query('startIndex') startIndex?: string,
    @Query('count') count?: string,
  ) {
    return this.scim.listUsers(
      request.user.schoolId,
      filter,
      startIndex ? Number(startIndex) : 1,
      count ? Number(count) : 100,
    );
  }

  @Get('Users/:id')
  @UseGuards(ScimTokenGuard)
  @Header('Content-Type', 'application/scim+json')
  get(@Request() request: ScimRequest, @Param('id') id: string) {
    return this.scim.getUser(request.user.schoolId, id);
  }

  @Post('Users')
  @UseGuards(ScimTokenGuard)
  @Header('Content-Type', 'application/scim+json')
  @HttpCode(HttpStatus.CREATED)
  create(@Request() request: ScimRequest, @Body() body: ScimUserBody) {
    return this.scim.createUser(request.user.schoolId, request.user.id, body);
  }

  @Patch('Users/:id')
  @UseGuards(ScimTokenGuard)
  @Header('Content-Type', 'application/scim+json')
  patch(
    @Request() request: ScimRequest,
    @Param('id') id: string,
    @Body() body: ScimPatchBody,
  ) {
    return this.scim.patchUser(
      request.user.schoolId,
      request.user.id,
      id,
      body,
    );
  }

  @Put('Users/:id')
  @UseGuards(ScimTokenGuard)
  @Header('Content-Type', 'application/scim+json')
  replace(
    @Request() request: ScimRequest,
    @Param('id') id: string,
    @Body() body: ScimUserBody,
  ) {
    return this.scim.replaceUser(
      request.user.schoolId,
      request.user.id,
      id,
      body,
    );
  }

  @Delete('Users/:id')
  @UseGuards(ScimTokenGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Request() request: ScimRequest, @Param('id') id: string) {
    return this.scim.deleteUser(request.user.schoolId, request.user.id, id);
  }
}
