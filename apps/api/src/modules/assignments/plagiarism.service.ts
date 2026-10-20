import { Injectable, Logger } from '@nestjs/common';

export interface PeerSubmission {
  id?: string;
  submissionId?: string;
  studentId: string;
  studentName?: string;
  content: string;
}

export interface PeerMatchDetail {
  peerSubmissionId: string;
  peerStudentId: string;
  peerStudentName?: string;
  similarityScore: number; // 0 to 100
  matchedPhrases: string[];
}

export interface OriginalityReport {
  overallSimilarityScore: number; // 0 to 100
  status:
    | 'CLEAN'
    | 'ACCEPTABLE'
    | 'MODERATE_SIMILARITY'
    | 'HIGH_SIMILARITY'
    | 'FLAGGED_PLAGIARISM';
  isPlagiarized: boolean;
  highestMatchPercentage: number;
  peerMatches: PeerMatchDetail[];
  wordCount: number;
  evaluatedAt: string;
  summary: string;
}

@Injectable()
export class PlagiarismService {
  private readonly logger = new Logger(PlagiarismService.name);

  /**
   * Generates n-grams (default 3-word shingles) from normalized text.
   */
  private generateNgrams(text: string, n = 3): Set<string> {
    const tokens = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter((w) => w.length > 1);

    const ngrams = new Set<string>();
    if (tokens.length < n) {
      if (tokens.length > 0) ngrams.add(tokens.join(' '));
      return ngrams;
    }

    for (let i = 0; i <= tokens.length - n; i++) {
      ngrams.add(tokens.slice(i, i + n).join(' '));
    }
    return ngrams;
  }

  /**
   * Extracts consecutive verbatim matching phrases (minimum 4 words).
   */
  private extractVerbatimMatches(
    textA: string,
    textB: string,
    minWords = 4,
  ): string[] {
    const wordsA = textA
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(Boolean);
    const wordsB = textB
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(Boolean);

    const matches: string[] = [];
    const windowSize = minWords;

    if (wordsA.length < windowSize || wordsB.length < windowSize) {
      return matches;
    }

    const bShingles = new Set<string>();
    for (let j = 0; j <= wordsB.length - windowSize; j++) {
      bShingles.add(wordsB.slice(j, j + windowSize).join(' '));
    }

    for (let i = 0; i <= wordsA.length - windowSize; i++) {
      const shingle = wordsA.slice(i, i + windowSize).join(' ');
      if (bShingles.has(shingle) && !matches.includes(shingle)) {
        matches.push(shingle);
      }
    }

    return matches.slice(0, 5); // top 5 matched sample phrases
  }

  /**
   * Calculates Jaccard similarity score between two texts (0 to 100).
   */
  calculateSimilarity(textA: string, textB: string): number {
    if (!textA || !textB) return 0;
    const a = textA.trim();
    const b = textB.trim();
    if (a.toLowerCase() === b.toLowerCase()) return 100;

    const ngramsA = this.generateNgrams(a);
    const ngramsB = this.generateNgrams(b);

    if (ngramsA.size === 0 || ngramsB.size === 0) return 0;

    let intersectionCount = 0;
    for (const gram of ngramsA) {
      if (ngramsB.has(gram)) {
        intersectionCount++;
      }
    }

    const unionCount = ngramsA.size + ngramsB.size - intersectionCount;
    if (unionCount === 0) return 0;

    const score = (intersectionCount / unionCount) * 100;
    return Math.round(score * 100) / 100;
  }

  /**
   * Checks candidate submission text against all peer submissions in the class.
   */
  checkPeerCollisions(
    candidateText: string,
    candidateStudentId: string,
    peerSubmissions: PeerSubmission[],
  ): { highestScore: number; peerMatches: PeerMatchDetail[] } {
    const peerMatches: PeerMatchDetail[] = [];
    let highestScore = 0;

    for (const peer of peerSubmissions) {
      if (peer.studentId === candidateStudentId || !peer.content) continue;

      const score = this.calculateSimilarity(candidateText, peer.content);
      if (score >= 15) {
        // 15% threshold for noticeable similarity
        const matchedPhrases = this.extractVerbatimMatches(
          candidateText,
          peer.content,
        );
        peerMatches.push({
          peerSubmissionId: peer.id || peer.submissionId || 'peer',
          peerStudentId: peer.studentId,
          peerStudentName: peer.studentName,
          similarityScore: score,
          matchedPhrases,
        });

        if (score > highestScore) {
          highestScore = score;
        }
      }
    }

    peerMatches.sort((a, b) => b.similarityScore - a.similarityScore);

    return { highestScore, peerMatches };
  }

  /**
   * Generates a comprehensive originality report for a submission.
   */
  generateOriginalityReport(
    content: string,
    candidateStudentId: string,
    peerSubmissions: PeerSubmission[] = [],
  ): OriginalityReport {
    const words = content.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    if (wordCount < 10) {
      return {
        overallSimilarityScore: 0,
        status: 'CLEAN',
        isPlagiarized: false,
        highestMatchPercentage: 0,
        peerMatches: [],
        wordCount,
        evaluatedAt: new Date().toISOString(),
        summary:
          'Submission text is too short for meaningful plagiarism evaluation.',
      };
    }

    const { highestScore, peerMatches } = this.checkPeerCollisions(
      content,
      candidateStudentId,
      peerSubmissions,
    );

    let status: OriginalityReport['status'] = 'CLEAN';
    let isPlagiarized = false;
    let summary =
      'Work demonstrates high original thought with no peer collisions detected.';

    if (highestScore >= 50) {
      status = 'FLAGGED_PLAGIARISM';
      isPlagiarized = true;
      summary = `Severe peer collision detected (${highestScore}% match with peer submission). Manual teacher review required.`;
    } else if (highestScore >= 35) {
      status = 'HIGH_SIMILARITY';
      isPlagiarized = true;
      summary = `Significant similarity detected (${highestScore}% match). Possible collaborative overlap or verbatim copying.`;
    } else if (highestScore >= 20) {
      status = 'MODERATE_SIMILARITY';
      summary = `Moderate phrase overlap observed (${highestScore}%). Common formulas or standardized phrasing detected.`;
    } else if (highestScore > 0) {
      status = 'ACCEPTABLE';
      summary = 'Low similarity within acceptable classroom margin.';
    }

    this.logger.log(
      `Originality report generated for student ${candidateStudentId}: Score ${highestScore}%, Status: ${status}`,
    );

    return {
      overallSimilarityScore: highestScore,
      status,
      isPlagiarized,
      highestMatchPercentage: highestScore,
      peerMatches,
      wordCount,
      evaluatedAt: new Date().toISOString(),
      summary,
    };
  }

  /**
   * High-level helper analyzing originality against peers.
   */
  analyzeOriginality(
    content: string,
    peerSubmissions: PeerSubmission[] = [],
    candidateStudentId = 'current',
  ): OriginalityReport {
    return this.generateOriginalityReport(
      content,
      candidateStudentId,
      peerSubmissions,
    );
  }
}
