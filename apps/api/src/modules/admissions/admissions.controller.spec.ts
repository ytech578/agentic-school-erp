import { Test, TestingModule } from '@nestjs/testing';
import { AdmissionsController } from './admissions.controller';
import { AdmissionsService } from './admissions.service';

describe('AdmissionsController', () => {
  let controller: AdmissionsController;
  let mockService: Partial<AdmissionsService>;

  beforeEach(async () => {
    mockService = {
      findAllEnquiries: jest.fn(),
      createEnquiry: jest.fn(),
      updateEnquiryStatus: jest.fn(),
      findAllApplications: jest.fn(),
      getApplicationById: jest.fn(),
      createApplication: jest.fn(),
      updateApplicationStatus: jest.fn(),
      convertApplicationToStudent: jest.fn(),
      getAnalytics: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdmissionsController],
      providers: [{ provide: AdmissionsService, useValue: mockService }],
    }).compile();

    controller = module.get<AdmissionsController>(AdmissionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
