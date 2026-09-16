import { cleanLatexMath, formatCopilotMarkdown } from './latex-formatter';

describe('latex-formatter (Agent 1 & Agent 4)', () => {
  describe('cleanLatexMath', () => {
    it('converts common LaTeX fraction commands into clean Unicode/ASCII', () => {
      expect(cleanLatexMath('\\frac{1}{2}')).toBe('(1 / 2)');
      expect(cleanLatexMath('\\frac{a+b}{c}')).toBe('(a+b / c)');
    });

    it('converts sqrt notation cleanly', () => {
      expect(cleanLatexMath('\\sqrt{16}')).toBe('√(16)');
      expect(cleanLatexMath('\\sqrt[3]{27}')).toBe('(27)^(1/3)');
    });

    it('converts mathematical symbols (times, div, pi, pm)', () => {
      expect(cleanLatexMath('3 \\times 4')).toBe('3 × 4');
      expect(cleanLatexMath('12 \\div 3')).toBe('12 ÷ 3');
      expect(cleanLatexMath('2 \\pi r')).toBe('2 π r');
      expect(cleanLatexMath('\\pm 5')).toBe('± 5');
    });

    it('strips LaTeX delimiters and text styling wrappers', () => {
      expect(cleanLatexMath('$$\\text{Area} = l \\times b$$')).toBe('Area = l × b');
      expect(cleanLatexMath('\\(x^2 + y^2 = r^2\\)')).toBe('x² + y² = r²');
    });

    it('handles null and undefined gracefully', () => {
      expect(cleanLatexMath('')).toBe('');
      expect(cleanLatexMath(null as any)).toBe('');
    });

    it('correctly expands LaTeX spacing tokens', () => {
      expect(cleanLatexMath('a\\quad b')).toBe('a    b');
      expect(cleanLatexMath('a\\,b')).toBe('a b');
      expect(cleanLatexMath('a\\ b')).toBe('a b');
    });
  });

  describe('formatCopilotMarkdown', () => {
    it('preserves clean markdown while sanitizing inner equations', () => {
      const input = '### Problem 1\nFind \\frac{3}{4} of 100.';
      const output = formatCopilotMarkdown(input);
      expect(output).toContain('(3 / 4) of 100');
    });

    it('ensures clean word-to-word spacing between question numbers, options, and text', () => {
      const input = 'Q1.Find the root of $x^2-4=0$.\n(a)Two\n(b)Three';
      const output = formatCopilotMarkdown(input);
      expect(output).toContain('Q1. Find the root');
      expect(output).toContain('(a) Two');
      expect(output).toContain('(b) Three');
    });

    it('separates inline math from directly touching words', () => {
      const input = 'Value is$x=5$and$y=10$here.';
      const output = formatCopilotMarkdown(input);
      expect(output).toContain('Value is x=5 and y=10 here.');
    });
  });
});
