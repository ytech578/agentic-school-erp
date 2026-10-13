export interface FallbackQuestionPaperParams {
  schoolName: string;
  board: string;
  subject: string;
  grade: string;
  totalMarks: number;
  duration: string;
  difficulty: string;
  topics: string;
  includeAnswerKey?: boolean;
}

/**
 * Generates a formal, standardized fallback examination paper with optional marking scheme.
 * Modularized out of AIService to reduce bloat and support deterministic curriculum testing.
 */
export function buildFallbackQuestionPaper(params: FallbackQuestionPaperParams): string {
  const {
    schoolName,
    board,
    subject,
    grade,
    totalMarks,
    duration,
    difficulty,
    topics,
    includeAnswerKey = true,
  } = params;

  let paper = `# ${schoolName.toUpperCase()}
**Annual Summative Examination — Session 2026-27**
**Affiliated to ${board} | Nursery – Grade 10 Curriculum**

---

| **Subject:** ${subject} | **Grade / Level:** ${grade} |
| :--- | :--- |
| **Max. Marks:** ${totalMarks} | **Time Allowed:** ${duration} |
| **Difficulty Tier:** ${difficulty} | **Coverage:** ${topics} |

---

### 📋 General Instructions
1. This question paper comprises **Five Sections** (Sections A, B, C, D, and E).
2. **Section A** contains 5 Multiple Choice Questions (MCQs) carrying 1 mark each.
3. **Section B** contains 3 Short Answer Type-I (SA-I) questions carrying 2 marks each.
4. **Section C** contains 3 Short Answer Type-II (SA-II) questions carrying 3 marks each.
5. **Section D** contains 2 Long Answer (LA) questions carrying 5 marks each with internal choice.
6. **Section E** contains 1 Case/Source-based integrated unit of assessment carrying 4 marks.
7. All questions are compulsory. Use of calculators or electronic devices is strictly prohibited.
8. Write all answers neatly with necessary calculation steps and labelled diagrams.

---

### SECTION A: Objective & Multiple Choice Questions (1 Mark Each)
*All questions are compulsory. Select the correct option.*

**Q1.** *[Remembering]* Which of the following fundamental principles or definitions correctly applies to **${subject}** in ${grade}?
- (A) Option Alpha: The standard base value remains invariant under uniform translation.
- (B) Option Beta: The rate of variation is directly proportional to external impetus.
- (C) Option Gamma: The net equilibrium sum vanishes in closed cyclical states.
- (D) Option Delta: The resultant magnitude quadruples when factor input doubles.

**Q2.** *[Understanding]* Consider the relationship between primary components in the study of **${topics}**. If the boundary condition is halved, what is the consequence on the system?
- (A) The system remains strictly unaltered.
- (B) The resultant decreases by a factor of 2.
- (C) The equilibrium point shifts toward the origin.
- (D) The system exhibits exponential divergent oscillation.

**Q3.** *[Applying]* A student needs to verify an experimental result involving **${subject}**. Which step ensures experimental validity and prevents systematic error?
- (A) Neglecting ambient calibration temperature.
- (B) Recording triple trials and taking the arithmetic mean.
- (C) Rounding raw measurements before arithmetic computation.
- (D) Eliminating control groups from comparative observation.

**Q4.** *[Remembering]* In ${board} curriculum standards for ${grade}, the standardized unit or benchmark metric for measuring energy or output is:
- (A) Newton-meter or Joule
- (B) Pascal per second
- (C) Volt-ampere inverse
- (D) Hertz-radian

**Q5.** *[Understanding]* An assertion (A) and reason (R) are given:
- **Assertion (A):** The core theorem holds true for all rational values within the specified domain.
- **Reason (R):** Continuous differentiability guarantees local existence of critical points.
Choose the correct option:
- (A) Both (A) and (R) are true and (R) is the correct explanation of (A).
- (B) Both (A) and (R) are true but (R) is NOT the correct explanation of (A).
- (C) (A) is true but (R) is false.
- (D) (A) is false but (R) is true.

---

### SECTION B: Short Answer Questions — Type I (2 Marks Each)

**Q6.** *[Understanding]* State the two essential criteria required to validate the core theorem in **${topics}**. Give one real-life example illustrating this in action.  
*(2 Marks)*

**Q7.** *[Applying]* Solve the following standard problem: If a variable quantity P is inversely related to Q, and P = 24 when Q = 3, calculate the value of P when Q = 8. Show all derivation steps.  
*(2 Marks)*

**Q8.** *[Analyzing]* Differentiate between primary and secondary characteristics of **${subject}** studied in ${grade}. Present your answer in a concise comparative tabular format with at least two distinct points of divergence.  
*(2 Marks)*

---

### SECTION C: Short Answer Questions — Type II (3 Marks Each)

**Q9.** *[Applying]* A practical scenario involves applying concepts of **${topics}** to optimize resources. Derive the mathematical or conceptual expression step-by-step, stating any assumptions clearly.  
*(3 Marks)*

**Q10.** *[Analyzing]* Explain why standard experimental values sometimes deviate from theoretical predictions in classroom laboratories. Outline three distinct precautions that students should take to minimize observational error.  
*(3 Marks)*

**Q11.** *[Understanding]* *(Internal Choice)*
- **(a)** Explain the detailed mechanism of how feedback loops operate within the context of **${subject}**.
- **OR**
- **(b)** Draw a neat, labelled schematic diagram illustrating the primary workflow or structure in ${grade} **${subject}**.  
*(3 Marks)*

---

### SECTION D: Long Answer Questions (5 Marks Each)

**Q12.** *[Evaluating]*
- **(a)** Formulate the comprehensive proof or complete theoretical derivation for the governing formula in **${topics}**.
- **(b)** Using the derived principle, calculate the total output when standard baseline parameters are multiplied by a factor of 1.5.  
*(3 + 2 = 5 Marks)*  
*OR*  
- **(a)** Discuss how historical developments in **${subject}** shaped our modern scientific understanding.
- **(b)** Outline two contemporary real-world challenges where this principle plays a critical role.  
*(3 + 2 = 5 Marks)*

**Q13.** *[Analyzing]*
A composite real-world problem requires synthesizing multiple sub-concepts from ${grade} ${subject}:
1. Identify the given independent and dependent variables. *(1 Mark)*
2. Construct the governing system of equations or logical relations. *(2 Marks)*
3. Solve for the unknown equilibrium states and interpret the physical or practical significance of your final answer. *(2 Marks)*  
*(Total: 5 Marks)*

---

### SECTION E: Case-Study / Competency-Based Assessment (4 Marks)

**Q14.** *[Source / Case-Based Integrated Problem]*
> **Case Context:** During a science and technology symposium at ${schoolName}, Class 10 students were tasked with evaluating energy efficiency and material sustainability under varying seasonal conditions. They recorded observations across five controlled trials and synthesized their data into a predictive performance curve.

Based on the above context, answer the following:
- **(i)** Identify the primary controlling parameter in the symposium experiment. *(1 Mark)*
- **(ii)** What mathematical or empirical relation describes the trend observed across the trials? *(1 Mark)*
- **(iii)** If the baseline load increases by 25%, predict the adjusted system output and justify your reasoning with two quantitative arguments. *(2 Marks)*`;

  if (includeAnswerKey) {
    paper += `\n\n---
\n# 📝 STEP-BY-STEP MARKING SCHEME & ANSWER KEY
**Confidential — For Evaluators Only**

| Question | Expected Answer & Step Breakdown | Marks |
| :--- | :--- | :--- |
| **Q1** | **(A)** Standard base value remains invariant.<br />*Recall of core definition (1 mark)* | 1 M |
| **Q2** | **(B)** Resultant decreases by factor of 2.<br />*Inverse proportional reasoning (1 mark)* | 1 M |
| **Q3** | **(B)** Recording triple trials and taking arithmetic mean.<br />*Application of error reduction technique (1 mark)* | 1 M |
| **Q4** | **(A)** Newton-meter or Joule.<br />*Accurate unit recall (1 mark)* | 1 M |
| **Q5** | **(A)** Both (A) and (R) are true and (R) correctly explains (A). | 1 M |
| **Q6** | • Stating first criterion clearly (1 M)<br />• Stating second criterion and practical example (1 M) | 2 M |
| **Q7** | • Constant of proportionality k = P × Q = 24 × 3 = 72 (1 M)<br />• P = 72 / 8 = 9 with final unit (1 M) | 2 M |
| **Q8** | • Point 1: Operational scope difference (1 M)<br />• Point 2: Input dependency difference (1 M) | 2 M |
| **Q9** | • Setting up initial boundary equations (1 M)<br />• Substitution and algebraic manipulation (1 M)<br />• Final simplified expression with units (1 M) | 3 M |
| **Q10** | • Precaution 1: Zero-error correction (1 M)<br />• Precaution 2: Parallax avoidance (1 M)<br />• Precaution 3: Environmental stability (1 M) | 3 M |
| **Q11 (a/b)** | • Complete explanation / neat labelled diagram with all 4 parts identified (2 M)<br />• Functional description of parts (1 M) | 3 M |
| **Q12** | • Part (a): Correct proof / derivation step-by-step (3 M)<br />• Part (b): Correct numerical substitution and final value (2 M) | 5 M |
| **Q13** | • Step 1: Variable identification (1 M)<br />• Step 2: System formulation (2 M)<br />• Step 3: Analytical solution and interpretation (2 M) | 5 M |
| **Q14** | • (i): Identification of controlling variable (1 M)<br />• (ii): Stating governing empirical equation (1 M)<br />• (iii): Calculation of 25% load shift with justification (2 M) | 4 M |`;
  }

  return paper;
}
