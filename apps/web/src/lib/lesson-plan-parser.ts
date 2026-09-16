/**
 * Utility to parse and isolate structured sections from AI-generated Lesson Plans.
 * Enables segmented printing/exporting of teacher lesson notes vs student activity handouts.
 */

export interface ParsedLessonPlanSections {
  cleanPlanContent: string;
  studentWorksheetContent: string;
  tlmKitContent: string;
}

export function parseLessonPlanSections(lessonPlanContent: string): ParsedLessonPlanSections {
  if (!lessonPlanContent) {
    return { cleanPlanContent: "", studentWorksheetContent: "", tlmKitContent: "" };
  }

  // Identify the Student Activity Handout section
  const worksheetHeaderRegex = /(?:^|\n)(?:---+|\*\*\*+)?\s*(#{1,3}\s*(?:📄\s*)?(?:Student\s+Classroom\s+Activity\s+Handout|Student\s+Activity\s+Handout|Student\s+Worksheet)[^\n]*)/i;
  const worksheetMatch = lessonPlanContent.match(worksheetHeaderRegex);

  let planOnly = lessonPlanContent;
  let worksheet = "";

  if (worksheetMatch && worksheetMatch.index !== undefined) {
    planOnly = lessonPlanContent.slice(0, worksheetMatch.index).trim();
    worksheet = lessonPlanContent.slice(worksheetMatch.index).trim();
  }

  // Extract TLM Kit section if present
  const tlmHeaderRegex = /(?:^|\n)\s*(#{1,3}\s*(?:📦\s*)?[^\n]*(?:Teaching\s+Learning\s+Material|TLM)[^\n]*)/i;
  const tlmMatch = lessonPlanContent.match(tlmHeaderRegex);
  let tlmSection = "";

  if (tlmMatch && tlmMatch.index !== undefined) {
    const hashOffset = tlmMatch[0].indexOf("#");
    const startIndex = tlmMatch.index + (hashOffset !== -1 ? hashOffset : 0);
    const contentFromHeader = lessonPlanContent.slice(startIndex);

    const firstNewline = contentFromHeader.indexOf("\n");
    if (firstNewline !== -1) {
      const rest = contentFromHeader.slice(firstNewline);
      const nextHeadingRegex = /\n(?:\s*---+|\s*\*\*\*+)?\s*(?=#{1,3}\s+)/i;
      const nextHeadingMatch = rest.match(nextHeadingRegex);
      if (nextHeadingMatch && nextHeadingMatch.index !== undefined) {
        tlmSection = contentFromHeader.slice(0, firstNewline + nextHeadingMatch.index).trim();
      } else {
        tlmSection = contentFromHeader.trim();
      }
    } else {
      tlmSection = contentFromHeader.trim();
    }
  }

  return {
    cleanPlanContent: planOnly,
    studentWorksheetContent: worksheet,
    tlmKitContent: tlmSection,
  };
}
