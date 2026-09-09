import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import {
  BoardCategory,
  SubjectClassification,
  SubjectSelectionType,
} from '@prisma/client';

@Injectable()
export class CurriculumSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CurriculumSeedService.name);

  constructor(private prisma: PrismaService) {}

  async onApplicationBootstrap() {
    try {
      await this.seedAll();
    } catch (err) {
      this.logger.error('Failed to run curriculum seed:', err);
    }
  }

  async seedAll() {
    this.logger.log('Seeding Master Boards, Curriculums, Subject Groups & Subjects...');

    // 1. Seed Global Subjects Master
    const globalSubjectsData = [
      { code: 'ENG', name: 'English', category: SubjectClassification.LANGUAGE },
      { code: 'HIN', name: 'Hindi', category: SubjectClassification.LANGUAGE },
      { code: 'TEL', name: 'Telugu', category: SubjectClassification.LANGUAGE },
      { code: 'URD', name: 'Urdu', category: SubjectClassification.LANGUAGE },
      { code: 'SAN', name: 'Sanskrit', category: SubjectClassification.LANGUAGE },
      { code: 'MAT', name: 'Mathematics', category: SubjectClassification.CORE },
      { code: 'EVS', name: 'Environmental Studies', category: SubjectClassification.CORE },
      { code: 'SCI', name: 'General Science', category: SubjectClassification.CORE },
      { code: 'PHY_SCI', name: 'Physical Science', category: SubjectClassification.CORE },
      { code: 'BIO_SCI', name: 'Biological Science', category: SubjectClassification.CORE },
      { code: 'PHY', name: 'Physics', category: SubjectClassification.CORE },
      { code: 'CHE', name: 'Chemistry', category: SubjectClassification.CORE },
      { code: 'BIO', name: 'Biology', category: SubjectClassification.CORE },
      { code: 'SOC', name: 'Social Studies', category: SubjectClassification.CORE },
      { code: 'HIS_CIV', name: 'History & Civics', category: SubjectClassification.CORE },
      { code: 'GEO', name: 'Geography', category: SubjectClassification.CORE },
      { code: 'ECO', name: 'Economics', category: SubjectClassification.ELECTIVE },
      { code: 'COMM', name: 'Commercial Studies', category: SubjectClassification.ELECTIVE },
      { code: 'COMP_APP', name: 'Computer Applications', category: SubjectClassification.ELECTIVE },
      { code: 'IT', name: 'Information Technology', category: SubjectClassification.VOCATIONAL },
      { code: 'AI', name: 'Artificial Intelligence', category: SubjectClassification.VOCATIONAL },
      { code: 'ART', name: 'Art Education', category: SubjectClassification.CO_CURRICULAR },
      { code: 'MUSIC', name: 'Music', category: SubjectClassification.CO_CURRICULAR },
      { code: 'PHE', name: 'Physical & Health Education', category: SubjectClassification.INTERNAL_ASSESSMENT },
      { code: 'VAL_ED', name: 'Value Education', category: SubjectClassification.ADDITIONAL },
      { code: 'SUPW', name: 'SUPW & Community Service', category: SubjectClassification.INTERNAL_ASSESSMENT },
      { code: 'ROBOTICS', name: 'Robotics & STEM', category: SubjectClassification.ADDITIONAL },
      { code: 'SPOKEN_ENG', name: 'Spoken English & Communication', category: SubjectClassification.ADDITIONAL },
    ];

    const globalSubjectMap = new Map<string, string>();
    for (const gs of globalSubjectsData) {
      const record = await this.prisma.globalSubject.upsert({
        where: { code: gs.code },
        update: { name: gs.name, category: gs.category },
        create: {
          code: gs.code,
          name: gs.name,
          category: gs.category,
        },
      });
      globalSubjectMap.set(gs.code, record.id);
    }
    this.logger.log(`Upserted ${globalSubjectMap.size} Global Subjects.`);

    // 2. Seed Boards
    const boards = [
      {
        code: 'CBSE',
        name: 'Central Board of Secondary Education',
        category: BoardCategory.CBSE,
        stateCode: null,
        description: 'National board of education in India for public and private schools.',
      },
      {
        code: 'CISCE',
        name: 'Council for the Indian School Certificate Examinations (ICSE)',
        category: BoardCategory.CISCE,
        stateCode: null,
        description: 'National level private board of school education in India conducting the ICSE examination.',
      },
      {
        code: 'STATE_AP',
        name: 'Andhra Pradesh Board of Secondary Education (AP SSC)',
        category: BoardCategory.STATE,
        stateCode: 'AP',
        description: 'Directorate of Government Examinations, Andhra Pradesh (SSC Curriculum).',
      },
      {
        code: 'STATE_TS',
        name: 'Telangana Board of Secondary Education (TS SSC)',
        category: BoardCategory.STATE,
        stateCode: 'TS',
        description: 'Directorate of Government Examinations, Telangana (SSC Curriculum).',
      },
    ];

    const boardMap = new Map<string, string>();
    for (const b of boards) {
      const record = await this.prisma.board.upsert({
        where: { code: b.code },
        update: { name: b.name, category: b.category, stateCode: b.stateCode, description: b.description },
        create: {
          code: b.code,
          name: b.name,
          category: b.category,
          stateCode: b.stateCode,
          description: b.description,
        },
      });
      boardMap.set(b.code, record.id);
    }
    this.logger.log(`Upserted ${boardMap.size} Boards.`);

    // 3. Seed Curriculums
    const curriculums = [
      {
        boardCode: 'CBSE',
        code: 'CBSE_2026',
        name: 'CBSE Curriculum 2026-27',
        version: '2026-27',
        description: 'Comprehensive CBSE framework for Classes 1 to 10 following NEP 2020 guidelines.',
      },
      {
        boardCode: 'CISCE',
        code: 'ICSE_2026',
        name: 'ICSE Curriculum 2026-27',
        version: '2026-27',
        description: 'CISCE ICSE academic framework for Classes 1 to 10 with Groups I, II, and III selection structure.',
      },
      {
        boardCode: 'STATE_AP',
        code: 'AP_SSC_2026',
        name: 'Andhra Pradesh SSC Curriculum 2026-27',
        version: '2026-27',
        description: 'SCERT Andhra Pradesh state curriculum with bifurcated Physical & Biological Sciences in Classes 8-10.',
      },
      {
        boardCode: 'STATE_TS',
        code: 'TS_SSC_2026',
        name: 'Telangana SSC Curriculum 2026-27',
        version: '2026-27',
        description: 'SCERT Telangana state curriculum with 3-language formula and core sciences for Classes 1-10.',
      },
    ];

    const curriculumMap = new Map<string, string>();
    for (const c of curriculums) {
      const boardId = boardMap.get(c.boardCode)!;
      const record = await this.prisma.curriculum.upsert({
        where: { code: c.code },
        update: { name: c.name, version: c.version, description: c.description, boardId },
        create: {
          boardId,
          code: c.code,
          name: c.name,
          version: c.version,
          description: c.description,
        },
      });
      curriculumMap.set(c.code, record.id);
    }
    this.logger.log(`Upserted ${curriculumMap.size} Curriculums.`);

    // 4. Seed Subject Groups & Curriculum Subjects for each curriculum
    await this.seedCbseCurriculum(curriculumMap.get('CBSE_2026')!, globalSubjectMap);
    await this.seedIcseCurriculum(curriculumMap.get('ICSE_2026')!, globalSubjectMap);
    await this.seedApCurriculum(curriculumMap.get('AP_SSC_2026')!, globalSubjectMap);
    await this.seedTsCurriculum(curriculumMap.get('TS_SSC_2026')!, globalSubjectMap);

    this.logger.log('Curriculum baseline seeding completed successfully.');
  }

  // -------------------------------------------------------------
  // CBSE Curriculum Configuration (Classes 1-10)
  // -------------------------------------------------------------
  private async seedCbseCurriculum(curriculumId: string, gsMap: Map<string, string>) {
    // Subject Groups
    const groups = [
      { code: 'LANGUAGES', name: 'Languages (Group L)', minSelection: 2, isRequired: true, sortOrder: 1 },
      { code: 'MAIN_SUBJECTS', name: 'Main Academic Subjects', minSelection: 3, isRequired: true, sortOrder: 2 },
      { code: 'SKILL_ELECTIVES', name: 'Skill Electives (Group S)', minSelection: 0, maxSelection: 1, isRequired: false, sortOrder: 3 },
      { code: 'INTERNAL_ASSESSMENT', name: 'Internal Assessment (Co-Scholastic)', minSelection: 2, isRequired: true, sortOrder: 4 },
      { code: 'CO_CURRICULAR', name: 'Co-Curricular & Other School Activities', minSelection: 0, isRequired: false, sortOrder: 5 },
    ];

    const groupMap = new Map<string, string>();
    for (const g of groups) {
      const r = await this.prisma.subjectGroup.upsert({
        where: { curriculumId_code: { curriculumId, code: g.code } },
        update: { name: g.name, minSelection: g.minSelection, maxSelection: g.maxSelection, isRequired: g.isRequired, sortOrder: g.sortOrder },
        create: { curriculumId, code: g.code, name: g.name, minSelection: g.minSelection, maxSelection: g.maxSelection, isRequired: g.isRequired, sortOrder: g.sortOrder },
      });
      groupMap.set(g.code, r.id);
    }

    const subjects = [
      // Primary (1-5)
      { gs: 'ENG', code: 'CBSE-ENG-PRI', name: 'English', gFrom: 1, gTo: 5, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.MANDATORY, grp: 'LANGUAGES', periods: 6, maxM: 100, passM: 35 },
      { gs: 'HIN', code: 'CBSE-HIN-PRI', name: 'Hindi', gFrom: 1, gTo: 5, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.MANDATORY, grp: 'LANGUAGES', periods: 5, maxM: 100, passM: 35 },
      { gs: 'TEL', code: 'CBSE-TEL-PRI', name: 'Regional Language (Telugu)', gFrom: 1, gTo: 5, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.OPTIONAL, grp: 'LANGUAGES', periods: 4, maxM: 100, passM: 35 },
      { gs: 'MAT', code: 'CBSE-MAT-PRI', name: 'Mathematics', gFrom: 1, gTo: 5, type: SubjectClassification.CORE, sel: SubjectSelectionType.MANDATORY, grp: 'MAIN_SUBJECTS', periods: 6, maxM: 100, passM: 35 },
      { gs: 'EVS', code: 'CBSE-EVS-PRI', name: 'Environmental Studies (EVS)', gFrom: 1, gTo: 5, type: SubjectClassification.CORE, sel: SubjectSelectionType.MANDATORY, grp: 'MAIN_SUBJECTS', periods: 5, maxM: 100, passM: 35 },
      { gs: 'COMP_APP', code: 'CBSE-COMP-PRI', name: 'Computer / Digital Literacy', gFrom: 1, gTo: 5, type: SubjectClassification.ADDITIONAL, sel: SubjectSelectionType.OPTIONAL, grp: 'CO_CURRICULAR', periods: 2, maxM: 50, passM: 18 },
      { gs: 'ART', code: 'CBSE-ART-PRI', name: 'Art Education', gFrom: 1, gTo: 5, type: SubjectClassification.CO_CURRICULAR, sel: SubjectSelectionType.MANDATORY, grp: 'CO_CURRICULAR', periods: 2, maxM: 50, passM: 18, exam: false },
      { gs: 'PHE', code: 'CBSE-PHE-PRI', name: 'Physical & Health Education', gFrom: 1, gTo: 5, type: SubjectClassification.INTERNAL_ASSESSMENT, sel: SubjectSelectionType.MANDATORY, grp: 'INTERNAL_ASSESSMENT', periods: 2, maxM: 50, passM: 18, exam: false },

      // Middle (6-8)
      { gs: 'ENG', code: 'CBSE-ENG-MID', name: 'English', gFrom: 6, gTo: 8, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.MANDATORY, grp: 'LANGUAGES', periods: 6, maxM: 100, passM: 33 },
      { gs: 'HIN', code: 'CBSE-HIN-MID', name: 'Hindi (Course A / B)', gFrom: 6, gTo: 8, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.MANDATORY, grp: 'LANGUAGES', periods: 5, maxM: 100, passM: 33 },
      { gs: 'TEL', code: 'CBSE-TEL-MID', name: 'Third Language (Telugu)', gFrom: 6, gTo: 8, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.CHOICE, grp: 'LANGUAGES', periods: 4, maxM: 100, passM: 33 },
      { gs: 'SAN', code: 'CBSE-SAN-MID', name: 'Third Language (Sanskrit)', gFrom: 6, gTo: 8, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.CHOICE, grp: 'LANGUAGES', periods: 4, maxM: 100, passM: 33 },
      { gs: 'MAT', code: 'CBSE-MAT-MID', name: 'Mathematics', gFrom: 6, gTo: 8, type: SubjectClassification.CORE, sel: SubjectSelectionType.MANDATORY, grp: 'MAIN_SUBJECTS', periods: 6, maxM: 100, passM: 33 },
      { gs: 'SCI', code: 'CBSE-SCI-MID', name: 'General Science', gFrom: 6, gTo: 8, type: SubjectClassification.CORE, sel: SubjectSelectionType.MANDATORY, grp: 'MAIN_SUBJECTS', periods: 6, maxM: 100, passM: 33, practical: true },
      { gs: 'SOC', code: 'CBSE-SOC-MID', name: 'Social Science', gFrom: 6, gTo: 8, type: SubjectClassification.CORE, sel: SubjectSelectionType.MANDATORY, grp: 'MAIN_SUBJECTS', periods: 5, maxM: 100, passM: 33 },
      { gs: 'AI', code: 'CBSE-AI-MID', name: 'Artificial Intelligence & Coding', gFrom: 6, gTo: 8, type: SubjectClassification.VOCATIONAL, sel: SubjectSelectionType.OPTIONAL, grp: 'SKILL_ELECTIVES', periods: 2, maxM: 50, passM: 17 },
      { gs: 'PHE', code: 'CBSE-PHE-MID', name: 'Health & Physical Education', gFrom: 6, gTo: 8, type: SubjectClassification.INTERNAL_ASSESSMENT, sel: SubjectSelectionType.MANDATORY, grp: 'INTERNAL_ASSESSMENT', periods: 2, maxM: 100, passM: 33, exam: false },

      // Secondary (9-10)
      { gs: 'ENG', code: '184', name: 'English Language & Literature (184)', gFrom: 9, gTo: 10, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.MANDATORY, grp: 'LANGUAGES', periods: 6, maxM: 100, passM: 33, internal: true },
      { gs: 'HIN', code: '002', name: 'Hindi Course A (002)', gFrom: 9, gTo: 10, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.CHOICE, grp: 'LANGUAGES', periods: 5, maxM: 100, passM: 33, internal: true },
      { gs: 'TEL', code: '007', name: 'Telugu (007)', gFrom: 9, gTo: 10, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.CHOICE, grp: 'LANGUAGES', periods: 5, maxM: 100, passM: 33, internal: true },
      { gs: 'SAN', code: '122', name: 'Sanskrit (122)', gFrom: 9, gTo: 10, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.CHOICE, grp: 'LANGUAGES', periods: 5, maxM: 100, passM: 33, internal: true },
      { gs: 'MAT', code: '041', name: 'Mathematics Standard (041)', gFrom: 9, gTo: 10, type: SubjectClassification.CORE, sel: SubjectSelectionType.MANDATORY, grp: 'MAIN_SUBJECTS', periods: 7, maxM: 100, passM: 33, internal: true },
      { gs: 'SCI', code: '086', name: 'Science (086)', gFrom: 9, gTo: 10, type: SubjectClassification.CORE, sel: SubjectSelectionType.MANDATORY, grp: 'MAIN_SUBJECTS', periods: 7, maxM: 100, passM: 33, practical: true, internal: true },
      { gs: 'SOC', code: '087', name: 'Social Science (087)', gFrom: 9, gTo: 10, type: SubjectClassification.CORE, sel: SubjectSelectionType.MANDATORY, grp: 'MAIN_SUBJECTS', periods: 6, maxM: 100, passM: 33, internal: true },
      { gs: 'IT', code: '402', name: 'Information Technology (402)', gFrom: 9, gTo: 10, type: SubjectClassification.VOCATIONAL, sel: SubjectSelectionType.ELECTIVE, grp: 'SKILL_ELECTIVES', periods: 4, maxM: 100, passM: 33, practical: true },
      { gs: 'AI', code: '417', name: 'Artificial Intelligence (417)', gFrom: 9, gTo: 10, type: SubjectClassification.VOCATIONAL, sel: SubjectSelectionType.ELECTIVE, grp: 'SKILL_ELECTIVES', periods: 4, maxM: 100, passM: 33, practical: true },
      { gs: 'PHE', code: '506', name: 'Health & Physical Education (506)', gFrom: 9, gTo: 10, type: SubjectClassification.INTERNAL_ASSESSMENT, sel: SubjectSelectionType.MANDATORY, grp: 'INTERNAL_ASSESSMENT', periods: 2, maxM: 100, passM: 33, exam: false, internal: true },
      { gs: 'ART', code: '507', name: 'Art Education (507)', gFrom: 9, gTo: 10, type: SubjectClassification.INTERNAL_ASSESSMENT, sel: SubjectSelectionType.MANDATORY, grp: 'INTERNAL_ASSESSMENT', periods: 2, maxM: 100, passM: 33, exam: false, internal: true },
    ];

    await this.upsertCurriculumSubjects(curriculumId, subjects, groupMap, gsMap);
  }

  // -------------------------------------------------------------
  // CISCE / ICSE Curriculum Configuration (Classes 1-10)
  // -------------------------------------------------------------
  private async seedIcseCurriculum(curriculumId: string, gsMap: Map<string, string>) {
    const groups = [
      { code: 'GROUP_I', name: 'Group I (Compulsory Subjects)', minSelection: 3, maxSelection: 3, isRequired: true, sortOrder: 1 },
      { code: 'GROUP_II', name: 'Group II (Electives - Any 2)', minSelection: 2, maxSelection: 2, isRequired: true, sortOrder: 2 },
      { code: 'GROUP_III', name: 'Group III (Applied & Technical - Any 1)', minSelection: 1, maxSelection: 1, isRequired: true, sortOrder: 3 },
      { code: 'INTERNAL_ASSESSMENT', name: 'SUPW & Community Service', minSelection: 1, isRequired: true, sortOrder: 4 },
      { code: 'LOWER_GRADES', name: 'Junior Academic Framework (Classes 1-8)', minSelection: 0, isRequired: false, sortOrder: 5 },
    ];

    const groupMap = new Map<string, string>();
    for (const g of groups) {
      const r = await this.prisma.subjectGroup.upsert({
        where: { curriculumId_code: { curriculumId, code: g.code } },
        update: { name: g.name, minSelection: g.minSelection, maxSelection: g.maxSelection, isRequired: g.isRequired, sortOrder: g.sortOrder },
        create: { curriculumId, code: g.code, name: g.name, minSelection: g.minSelection, maxSelection: g.maxSelection, isRequired: g.isRequired, sortOrder: g.sortOrder },
      });
      groupMap.set(g.code, r.id);
    }

    const subjects = [
      // Primary & Middle (1-8)
      { gs: 'ENG', code: 'ICSE-ENG-JNR', name: 'English Language & Literature', gFrom: 1, gTo: 8, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.MANDATORY, grp: 'LOWER_GRADES', periods: 7, maxM: 100, passM: 35 },
      { gs: 'HIN', code: 'ICSE-HIN-JNR', name: 'Second Language (Hindi)', gFrom: 1, gTo: 8, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.CHOICE, grp: 'LOWER_GRADES', periods: 5, maxM: 100, passM: 35 },
      { gs: 'TEL', code: 'ICSE-TEL-JNR', name: 'Second Language (Telugu)', gFrom: 1, gTo: 8, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.CHOICE, grp: 'LOWER_GRADES', periods: 5, maxM: 100, passM: 35 },
      { gs: 'MAT', code: 'ICSE-MAT-JNR', name: 'Mathematics', gFrom: 1, gTo: 8, type: SubjectClassification.CORE, sel: SubjectSelectionType.MANDATORY, grp: 'LOWER_GRADES', periods: 6, maxM: 100, passM: 35 },
      { gs: 'SCI', code: 'ICSE-SCI-JNR', name: 'General Science', gFrom: 1, gTo: 7, type: SubjectClassification.CORE, sel: SubjectSelectionType.MANDATORY, grp: 'LOWER_GRADES', periods: 6, maxM: 100, passM: 35, practical: true },
      { gs: 'SOC', code: 'ICSE-SOC-JNR', name: 'History, Civics & Geography', gFrom: 1, gTo: 8, type: SubjectClassification.CORE, sel: SubjectSelectionType.MANDATORY, grp: 'LOWER_GRADES', periods: 5, maxM: 100, passM: 35 },
      { gs: 'COMP_APP', code: 'ICSE-COMP-JNR', name: 'Computer Studies', gFrom: 1, gTo: 8, type: SubjectClassification.CORE, sel: SubjectSelectionType.OPTIONAL, grp: 'LOWER_GRADES', periods: 3, maxM: 100, passM: 35, practical: true },

      // ICSE Secondary (9-10) — Group I (Compulsory)
      { gs: 'ENG', code: 'ICSE-01', name: 'English (Language & Literature)', gFrom: 9, gTo: 10, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.MANDATORY, grp: 'GROUP_I', periods: 7, maxM: 100, passM: 33, internal: true },
      { gs: 'HIN', code: 'ICSE-02H', name: 'Second Language (Hindi)', gFrom: 9, gTo: 10, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.CHOICE, grp: 'GROUP_I', periods: 5, maxM: 100, passM: 33, internal: true },
      { gs: 'TEL', code: 'ICSE-02T', name: 'Second Language (Telugu)', gFrom: 9, gTo: 10, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.CHOICE, grp: 'GROUP_I', periods: 5, maxM: 100, passM: 33, internal: true },
      { gs: 'HIS_CIV', code: 'ICSE-03', name: 'History, Civics & Geography (H.C.G.)', gFrom: 9, gTo: 10, type: SubjectClassification.CORE, sel: SubjectSelectionType.MANDATORY, grp: 'GROUP_I', periods: 6, maxM: 100, passM: 33, internal: true },

      // Group II (Electives - Choose 2)
      { gs: 'MAT', code: 'ICSE-51', name: 'Mathematics (51)', gFrom: 9, gTo: 10, type: SubjectClassification.CORE, sel: SubjectSelectionType.ELECTIVE, grp: 'GROUP_II', periods: 6, maxM: 100, passM: 33, internal: true },
      { gs: 'SCI', code: 'ICSE-52', name: 'Science (Physics, Chemistry, Biology)', gFrom: 9, gTo: 10, type: SubjectClassification.CORE, sel: SubjectSelectionType.ELECTIVE, grp: 'GROUP_II', periods: 8, maxM: 100, passM: 33, practical: true, internal: true },
      { gs: 'ECO', code: 'ICSE-64', name: 'Economics (64)', gFrom: 9, gTo: 10, type: SubjectClassification.ELECTIVE, sel: SubjectSelectionType.ELECTIVE, grp: 'GROUP_II', periods: 5, maxM: 100, passM: 33, internal: true },
      { gs: 'COMM', code: 'ICSE-63', name: 'Commercial Studies (63)', gFrom: 9, gTo: 10, type: SubjectClassification.ELECTIVE, sel: SubjectSelectionType.ELECTIVE, grp: 'GROUP_II', periods: 5, maxM: 100, passM: 33, internal: true },

      // Group III (Technical & Applied - Choose 1)
      { gs: 'COMP_APP', code: 'ICSE-86', name: 'Computer Applications (86)', gFrom: 9, gTo: 10, type: SubjectClassification.ELECTIVE, sel: SubjectSelectionType.ELECTIVE, grp: 'GROUP_III', periods: 4, maxM: 100, passM: 33, practical: true, internal: true },
      { gs: 'ART', code: 'ICSE-87', name: 'Art / Performing Arts', gFrom: 9, gTo: 10, type: SubjectClassification.ELECTIVE, sel: SubjectSelectionType.ELECTIVE, grp: 'GROUP_III', periods: 4, maxM: 100, passM: 33, practical: true },
      { gs: 'PHE', code: 'ICSE-88', name: 'Physical Education (88)', gFrom: 9, gTo: 10, type: SubjectClassification.ELECTIVE, sel: SubjectSelectionType.ELECTIVE, grp: 'GROUP_III', periods: 4, maxM: 100, passM: 33, practical: true },

      // Internal SUPW
      { gs: 'SUPW', code: 'ICSE-SUPW', name: 'Socially Useful Productive Work (SUPW)', gFrom: 9, gTo: 10, type: SubjectClassification.INTERNAL_ASSESSMENT, sel: SubjectSelectionType.MANDATORY, grp: 'INTERNAL_ASSESSMENT', periods: 2, maxM: 100, passM: 33, exam: false, internal: true },
    ];

    await this.upsertCurriculumSubjects(curriculumId, subjects, groupMap, gsMap);
  }

  // -------------------------------------------------------------
  // Andhra Pradesh State Board (AP SSC Classes 1-10)
  // -------------------------------------------------------------
  private async seedApCurriculum(curriculumId: string, gsMap: Map<string, string>) {
    const groups = [
      { code: 'LANGUAGES', name: 'Languages (1st, 2nd, 3rd)', minSelection: 3, maxSelection: 3, isRequired: true, sortOrder: 1 },
      { code: 'CORE_ACADEMIC', name: 'Core Academic Subjects', minSelection: 4, isRequired: true, sortOrder: 2 },
      { code: 'SCHOOL_ADDITIONAL', name: 'School-Level & Co-Curricular Offerings', minSelection: 0, isRequired: false, sortOrder: 3 },
    ];

    const groupMap = new Map<string, string>();
    for (const g of groups) {
      const r = await this.prisma.subjectGroup.upsert({
        where: { curriculumId_code: { curriculumId, code: g.code } },
        update: { name: g.name, minSelection: g.minSelection, maxSelection: g.maxSelection, isRequired: g.isRequired, sortOrder: g.sortOrder },
        create: { curriculumId, code: g.code, name: g.name, minSelection: g.minSelection, maxSelection: g.maxSelection, isRequired: g.isRequired, sortOrder: g.sortOrder },
      });
      groupMap.set(g.code, r.id);
    }

    const subjects = [
      // Classes 1-2
      { gs: 'TEL', code: 'AP-01T-P1', name: 'First Language Telugu', gFrom: 1, gTo: 2, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.MANDATORY, grp: 'LANGUAGES', periods: 6, maxM: 100, passM: 35 },
      { gs: 'ENG', code: 'AP-13E-P1', name: 'English', gFrom: 1, gTo: 2, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.MANDATORY, grp: 'LANGUAGES', periods: 6, maxM: 100, passM: 35 },
      { gs: 'MAT', code: 'AP-15M-P1', name: 'Mathematics', gFrom: 1, gTo: 2, type: SubjectClassification.CORE, sel: SubjectSelectionType.MANDATORY, grp: 'CORE_ACADEMIC', periods: 6, maxM: 100, passM: 35 },

      // Classes 3-5
      { gs: 'TEL', code: 'AP-01T-P2', name: 'First Language Telugu', gFrom: 3, gTo: 5, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.MANDATORY, grp: 'LANGUAGES', periods: 6, maxM: 100, passM: 35 },
      { gs: 'ENG', code: 'AP-13E-P2', name: 'English', gFrom: 3, gTo: 5, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.MANDATORY, grp: 'LANGUAGES', periods: 6, maxM: 100, passM: 35 },
      { gs: 'MAT', code: 'AP-15M-P2', name: 'Mathematics', gFrom: 3, gTo: 5, type: SubjectClassification.CORE, sel: SubjectSelectionType.MANDATORY, grp: 'CORE_ACADEMIC', periods: 6, maxM: 100, passM: 35 },
      { gs: 'EVS', code: 'AP-EVS-P2', name: 'Environmental Studies', gFrom: 3, gTo: 5, type: SubjectClassification.CORE, sel: SubjectSelectionType.MANDATORY, grp: 'CORE_ACADEMIC', periods: 5, maxM: 100, passM: 35 },

      // Classes 6-7
      { gs: 'TEL', code: 'AP-01T-M', name: 'First Language (Telugu / Composite)', gFrom: 6, gTo: 7, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.MANDATORY, grp: 'LANGUAGES', periods: 6, maxM: 100, passM: 35 },
      { gs: 'HIN', code: 'AP-09H-M', name: 'Second Language (Hindi)', gFrom: 6, gTo: 7, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.MANDATORY, grp: 'LANGUAGES', periods: 5, maxM: 100, passM: 35 },
      { gs: 'ENG', code: 'AP-13E-M', name: 'Third Language (English)', gFrom: 6, gTo: 7, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.MANDATORY, grp: 'LANGUAGES', periods: 6, maxM: 100, passM: 35 },
      { gs: 'MAT', code: 'AP-15M-M', name: 'Mathematics', gFrom: 6, gTo: 7, type: SubjectClassification.CORE, sel: SubjectSelectionType.MANDATORY, grp: 'CORE_ACADEMIC', periods: 6, maxM: 100, passM: 35 },
      { gs: 'SCI', code: 'AP-SCI-M', name: 'General Science', gFrom: 6, gTo: 7, type: SubjectClassification.CORE, sel: SubjectSelectionType.MANDATORY, grp: 'CORE_ACADEMIC', periods: 6, maxM: 100, passM: 35, practical: true },
      { gs: 'SOC', code: 'AP-18S-M', name: 'Social Studies', gFrom: 6, gTo: 7, type: SubjectClassification.CORE, sel: SubjectSelectionType.MANDATORY, grp: 'CORE_ACADEMIC', periods: 5, maxM: 100, passM: 35 },

      // Classes 8-10 (AP SSC with bifurcated Physical & Biological Science)
      { gs: 'TEL', code: '01T', name: 'First Language (Telugu 01T)', gFrom: 8, gTo: 10, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.CHOICE, grp: 'LANGUAGES', periods: 6, maxM: 100, passM: 35, internal: true },
      { gs: 'URD', code: '01U', name: 'First Language (Urdu 01U)', gFrom: 8, gTo: 10, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.CHOICE, grp: 'LANGUAGES', periods: 6, maxM: 100, passM: 35, internal: true },
      { gs: 'HIN', code: '09H', name: 'Second Language (Hindi 09H)', gFrom: 8, gTo: 10, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.MANDATORY, grp: 'LANGUAGES', periods: 5, maxM: 100, passM: 35, internal: true },
      { gs: 'ENG', code: '13E', name: 'Third Language (English 13E)', gFrom: 8, gTo: 10, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.MANDATORY, grp: 'LANGUAGES', periods: 6, maxM: 100, passM: 35, internal: true },
      { gs: 'MAT', code: '15E', name: 'Mathematics (15E)', gFrom: 8, gTo: 10, type: SubjectClassification.CORE, sel: SubjectSelectionType.MANDATORY, grp: 'CORE_ACADEMIC', periods: 7, maxM: 100, passM: 35, internal: true },
      { gs: 'PHY_SCI', code: '16E', name: 'Physical Science (16E)', gFrom: 8, gTo: 10, type: SubjectClassification.CORE, sel: SubjectSelectionType.MANDATORY, grp: 'CORE_ACADEMIC', periods: 4, maxM: 50, passM: 18, practical: true, internal: true },
      { gs: 'BIO_SCI', code: '17E', name: 'Biological Science (17E)', gFrom: 8, gTo: 10, type: SubjectClassification.CORE, sel: SubjectSelectionType.MANDATORY, grp: 'CORE_ACADEMIC', periods: 4, maxM: 50, passM: 18, practical: true, internal: true },
      { gs: 'SOC', code: '18E', name: 'Social Studies (18E)', gFrom: 8, gTo: 10, type: SubjectClassification.CORE, sel: SubjectSelectionType.MANDATORY, grp: 'CORE_ACADEMIC', periods: 6, maxM: 100, passM: 35, internal: true },

      // School additions
      { gs: 'COMP_APP', code: 'AP-COMP', name: 'Computer Education', gFrom: 1, gTo: 10, type: SubjectClassification.ADDITIONAL, sel: SubjectSelectionType.OPTIONAL, grp: 'SCHOOL_ADDITIONAL', periods: 2, maxM: 50, passM: 18 },
      { gs: 'PHE', code: 'AP-PHE', name: 'Physical Education & Yoga', gFrom: 1, gTo: 10, type: SubjectClassification.CO_CURRICULAR, sel: SubjectSelectionType.MANDATORY, grp: 'SCHOOL_ADDITIONAL', periods: 2, maxM: 50, passM: 18, exam: false },
      { gs: 'VAL_ED', code: 'AP-VAL', name: 'Moral Science & Life Skills', gFrom: 1, gTo: 10, type: SubjectClassification.ADDITIONAL, sel: SubjectSelectionType.OPTIONAL, grp: 'SCHOOL_ADDITIONAL', periods: 1, maxM: 50, passM: 18, exam: false },
    ];

    await this.upsertCurriculumSubjects(curriculumId, subjects, groupMap, gsMap);
  }

  // -------------------------------------------------------------
  // Telangana State Board (TS SSC Classes 1-10)
  // -------------------------------------------------------------
  private async seedTsCurriculum(curriculumId: string, gsMap: Map<string, string>) {
    const groups = [
      { code: 'LANGUAGES', name: 'Languages (1st, 2nd, 3rd)', minSelection: 3, maxSelection: 3, isRequired: true, sortOrder: 1 },
      { code: 'CORE_ACADEMIC', name: 'Core Academic Subjects', minSelection: 4, isRequired: true, sortOrder: 2 },
      { code: 'SCHOOL_ADDITIONAL', name: 'School-Level & Co-Curricular Offerings', minSelection: 0, isRequired: false, sortOrder: 3 },
    ];

    const groupMap = new Map<string, string>();
    for (const g of groups) {
      const r = await this.prisma.subjectGroup.upsert({
        where: { curriculumId_code: { curriculumId, code: g.code } },
        update: { name: g.name, minSelection: g.minSelection, maxSelection: g.maxSelection, isRequired: g.isRequired, sortOrder: g.sortOrder },
        create: { curriculumId, code: g.code, name: g.name, minSelection: g.minSelection, maxSelection: g.maxSelection, isRequired: g.isRequired, sortOrder: g.sortOrder },
      });
      groupMap.set(g.code, r.id);
    }

    const subjects = [
      // Classes 1-5
      { gs: 'TEL', code: 'TS-01T-P', name: 'First Language Telugu', gFrom: 1, gTo: 5, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.MANDATORY, grp: 'LANGUAGES', periods: 6, maxM: 100, passM: 35 },
      { gs: 'ENG', code: 'TS-13E-P', name: 'English', gFrom: 1, gTo: 5, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.MANDATORY, grp: 'LANGUAGES', periods: 6, maxM: 100, passM: 35 },
      { gs: 'MAT', code: 'TS-15M-P', name: 'Mathematics', gFrom: 1, gTo: 5, type: SubjectClassification.CORE, sel: SubjectSelectionType.MANDATORY, grp: 'CORE_ACADEMIC', periods: 6, maxM: 100, passM: 35 },
      { gs: 'EVS', code: 'TS-EVS-P', name: 'Environmental Studies', gFrom: 3, gTo: 5, type: SubjectClassification.CORE, sel: SubjectSelectionType.MANDATORY, grp: 'CORE_ACADEMIC', periods: 5, maxM: 100, passM: 35 },

      // Classes 6-7
      { gs: 'TEL', code: 'TS-01T-M', name: 'First Language (Telugu / Urdu)', gFrom: 6, gTo: 7, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.MANDATORY, grp: 'LANGUAGES', periods: 6, maxM: 100, passM: 35 },
      { gs: 'HIN', code: 'TS-09H-M', name: 'Second Language (Hindi)', gFrom: 6, gTo: 7, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.MANDATORY, grp: 'LANGUAGES', periods: 5, maxM: 100, passM: 35 },
      { gs: 'ENG', code: 'TS-13E-M', name: 'Third Language (English)', gFrom: 6, gTo: 7, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.MANDATORY, grp: 'LANGUAGES', periods: 6, maxM: 100, passM: 35 },
      { gs: 'MAT', code: 'TS-15M-M', name: 'Mathematics', gFrom: 6, gTo: 7, type: SubjectClassification.CORE, sel: SubjectSelectionType.MANDATORY, grp: 'CORE_ACADEMIC', periods: 6, maxM: 100, passM: 35 },
      { gs: 'SCI', code: 'TS-SCI-M', name: 'General Science', gFrom: 6, gTo: 7, type: SubjectClassification.CORE, sel: SubjectSelectionType.MANDATORY, grp: 'CORE_ACADEMIC', periods: 6, maxM: 100, passM: 35, practical: true },
      { gs: 'SOC', code: 'TS-18S-M', name: 'Social Studies', gFrom: 6, gTo: 7, type: SubjectClassification.CORE, sel: SubjectSelectionType.MANDATORY, grp: 'CORE_ACADEMIC', periods: 5, maxM: 100, passM: 35 },

      // Classes 8-10 (TS SSC)
      { gs: 'TEL', code: 'TS-01T', name: 'First Language (Telugu 01T)', gFrom: 8, gTo: 10, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.CHOICE, grp: 'LANGUAGES', periods: 6, maxM: 100, passM: 35, internal: true },
      { gs: 'URD', code: 'TS-01U', name: 'First Language (Urdu 01U)', gFrom: 8, gTo: 10, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.CHOICE, grp: 'LANGUAGES', periods: 6, maxM: 100, passM: 35, internal: true },
      { gs: 'HIN', code: 'TS-09H', name: 'Second Language (Hindi 09H)', gFrom: 8, gTo: 10, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.MANDATORY, grp: 'LANGUAGES', periods: 5, maxM: 100, passM: 35, internal: true },
      { gs: 'ENG', code: 'TS-13E', name: 'Third Language (English 13E)', gFrom: 8, gTo: 10, type: SubjectClassification.LANGUAGE, sel: SubjectSelectionType.MANDATORY, grp: 'LANGUAGES', periods: 6, maxM: 100, passM: 35, internal: true },
      { gs: 'MAT', code: 'TS-15E', name: 'Mathematics (15E)', gFrom: 8, gTo: 10, type: SubjectClassification.CORE, sel: SubjectSelectionType.MANDATORY, grp: 'CORE_ACADEMIC', periods: 7, maxM: 100, passM: 35, internal: true },
      { gs: 'PHY_SCI', code: 'TS-19E', name: 'Physical Science (19E)', gFrom: 8, gTo: 10, type: SubjectClassification.CORE, sel: SubjectSelectionType.MANDATORY, grp: 'CORE_ACADEMIC', periods: 4, maxM: 50, passM: 18, practical: true, internal: true },
      { gs: 'BIO_SCI', code: 'TS-20E', name: 'Biological Science (20E)', gFrom: 8, gTo: 10, type: SubjectClassification.CORE, sel: SubjectSelectionType.MANDATORY, grp: 'CORE_ACADEMIC', periods: 4, maxM: 50, passM: 18, practical: true, internal: true },
      { gs: 'SOC', code: 'TS-21E', name: 'Social Studies (21E)', gFrom: 8, gTo: 10, type: SubjectClassification.CORE, sel: SubjectSelectionType.MANDATORY, grp: 'CORE_ACADEMIC', periods: 6, maxM: 100, passM: 35, internal: true },

      // School Additions
      { gs: 'COMP_APP', code: 'TS-COMP', name: 'Computer Science & ICT', gFrom: 1, gTo: 10, type: SubjectClassification.ADDITIONAL, sel: SubjectSelectionType.OPTIONAL, grp: 'SCHOOL_ADDITIONAL', periods: 2, maxM: 50, passM: 18 },
      { gs: 'PHE', code: 'TS-PHE', name: 'Physical & Health Education', gFrom: 1, gTo: 10, type: SubjectClassification.CO_CURRICULAR, sel: SubjectSelectionType.MANDATORY, grp: 'SCHOOL_ADDITIONAL', periods: 2, maxM: 50, passM: 18, exam: false },
    ];

    await this.upsertCurriculumSubjects(curriculumId, subjects, groupMap, gsMap);
  }

  private async upsertCurriculumSubjects(
    curriculumId: string,
    subjects: any[],
    groupMap: Map<string, string>,
    gsMap: Map<string, string>,
  ) {
    for (const s of subjects) {
      const globalSubjectId = gsMap.get(s.gs);
      if (!globalSubjectId) continue;
      const subjectGroupId = groupMap.get(s.grp) || null;

      await this.prisma.curriculumSubject.upsert({
        where: {
          curriculumId_subjectCode_gradeFrom_gradeTo: {
            curriculumId,
            subjectCode: s.code,
            gradeFrom: s.gFrom,
            gradeTo: s.gTo,
          },
        },
        update: {
          displayName: s.name,
          subjectGroupId,
          subjectType: s.type,
          selectionType: s.sel,
          periodsPerWeek: s.periods,
          maxMarks: s.maxM,
          passMarks: s.passM,
          theoryEnabled: true,
          practicalEnabled: !!s.practical,
          internalAssessmentEnabled: !!s.internal,
          examEnabled: s.exam !== false,
        },
        create: {
          curriculumId,
          globalSubjectId,
          subjectGroupId,
          subjectCode: s.code,
          displayName: s.name,
          gradeFrom: s.gFrom,
          gradeTo: s.gTo,
          subjectType: s.type,
          selectionType: s.sel,
          periodsPerWeek: s.periods,
          maxMarks: s.maxM,
          passMarks: s.passM,
          theoryEnabled: true,
          practicalEnabled: !!s.practical,
          internalAssessmentEnabled: !!s.internal,
          examEnabled: s.exam !== false,
        },
      });
    }
  }
}
