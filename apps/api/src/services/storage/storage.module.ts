import { Module, Global } from '@nestjs/common';
import { StorageService } from './storage.service';
import { DocumentSecurityService } from './document-security.service';
import { DocumentSecurityController } from './document-security.controller';

@Global()
@Module({
  controllers: [DocumentSecurityController],
  providers: [StorageService, DocumentSecurityService],
  exports: [StorageService, DocumentSecurityService],
})
export class StorageModule {}
