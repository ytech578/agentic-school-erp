import { Test, TestingModule } from '@nestjs/testing';
import { PlagiarismService, PeerSubmission } from './plagiarism.service';

describe('PlagiarismService', () => {
  let service: PlagiarismService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlagiarismService],
    }).compile();

    service = module.get<PlagiarismService>(PlagiarismService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateSimilarity', () => {
    it('returns 100% for identical texts', () => {
      const text = 'The photosynthesis process converts sunlight into glucose and oxygen in the chloroplast.';
      const score = service.calculateSimilarity(text, text);
      expect(score).toBe(100);
    });

    it('returns 0% for completely disjoint texts', () => {
      const textA = 'Quantum mechanics deals with wave particle duality and uncertainty principles.';
      const textB = 'The French revolution erupted due to social inequality economic distress and absolute monarchy.';
      const score = service.calculateSimilarity(textA, textB);
      expect(score).toBe(0);
    });

    it('detects moderate similarity for partially overlapping texts', () => {
      const textA = 'Newton formulated three laws of motion that govern classical mechanics and orbital physics.';
      const textB = 'Newton formulated three laws of motion that explain how planetary bodies move in space.';
      const score = service.calculateSimilarity(textA, textB);
      expect(score).toBeGreaterThan(20);
      expect(score).toBeLessThan(100);
    });
  });

  describe('generateOriginalityReport', () => {
    it('flags high peer collision when two students submit near-identical essays', () => {
      const peerSubmissions: PeerSubmission[] = [
        {
          id: 'sub-1',
          studentId: 'student-peer-1',
          studentName: 'Rohan Gupta',
          content: 'Mitochondria are the powerhouse of the cell responsible for generating ATP through cellular respiration and oxidative phosphorylation.',
        },
      ];

      const candidateSubmission =
        'Mitochondria are the powerhouse of the cell responsible for generating ATP through cellular respiration and oxidative phosphorylation in plant and animal tissues.';

      const report = service.generateOriginalityReport(
        candidateSubmission,
        'student-candidate-2',
        peerSubmissions,
      );

      expect(report.isPlagiarized).toBe(true);
      expect(report.overallSimilarityScore).toBeGreaterThanOrEqual(40);
      expect(report.status).toMatch(/HIGH_SIMILARITY|FLAGGED_PLAGIARISM/);
      expect(report.peerMatches.length).toBe(1);
      expect(report.peerMatches[0].peerStudentId).toBe('student-peer-1');
    });

    it('marks distinct, original work as CLEAN', () => {
      const peerSubmissions: PeerSubmission[] = [
        {
          id: 'sub-1',
          studentId: 'student-peer-1',
          studentName: 'Ananya Roy',
          content: 'The Harappan civilization was celebrated for its grid-pattern urban planning and sophisticated drainage systems.',
        },
      ];

      const candidateSubmission =
        'William Shakespeare revolutionized Renaissance theatre through plays like Hamlet, Othello, and Macbeth, exploring human psychology and ambition.';

      const report = service.generateOriginalityReport(
        candidateSubmission,
        'student-candidate-3',
        peerSubmissions,
      );

      expect(report.isPlagiarized).toBe(false);
      expect(report.overallSimilarityScore).toBe(0);
      expect(report.status).toBe('CLEAN');
      expect(report.peerMatches.length).toBe(0);
    });
  });
});
