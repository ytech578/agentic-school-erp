import { parseLessonPlanSections } from "./lesson-plan-parser";

describe("lesson-plan-parser - parseLessonPlanSections", () => {
  const sampleLessonPlan = `# Lesson Plan: Photosynthesis & Cellular Respiration

**Grade Level:** Grade 7
**Duration:** 45 mins
**Curriculum Alignment:** CBSE / NCERT Core

---

### 🎯 Specific Learning Objectives (NEP 2020 Competency Progression)
1. **Remember & Understand:** State the general chemical equation for photosynthesis.
2. **Apply & Analyze:** Compare and contrast the inputs and outputs of chloroplasts vs mitochondria.
3. **Evaluate & Create:** Hypothesize the impact of varying sunlight wavelengths on aquatic weed oxygen bubble production.

---

### 📦 Comprehensive Teaching Learning Material (TLM) Kit & Activity Deployment
- **Low/No-Cost Physical Manipulatives:** Dry rajma beans, fresh green spinach leaves, transparent drinking glasses with water.
- **Visual Organizers:** Double bubble Venn diagram comparing chloroplasts and mitochondria.
- **Digital Interactive Simulators:** PhET Interactive Simulation: 'Photosynthesis & Light Absorption'.
- **Deployment Timeline:**
  - *Minutes 0-10 (Spark & Manipulative Unpack):* Distribute spinach leaves, observe stomata with magnifying lens.
  - *Minutes 10-25 (Core Concept & Sim):* Demonstrate PhET light wavelength changes.
  - *Minutes 25-38 (Guided Peer Activity):* Complete Venn diagram.
  - *Minutes 38-45 (Synthesis & Clean-up):* Collect exit slips.
- **Inclusive Adaptations:** High-contrast tactile diagrams for visually impaired learners.
- **Eco-Friendly Clean-up:** Composted plant matter in school garden.

---

### 💡 Formative Assessment & Misconception Radar
- **Misconception:** "Plants only perform photosynthesis during the day and never perform cellular respiration."
- **Check-for-Understanding Question:** "If we seal a plant in a dark box with a CO2 sensor, what happens to CO2 levels?"

---

### 📝 Homework & Extended Real-World Project
- Track transpiration rate of a potted houseplant enclosed in a clear zip-lock pouch for 48 hours.

---

### 📄 Student Classroom Activity Handout & Exit Slip

#### Part A: Hands-On Exploration & Observation Log
1. Place a fresh spinach leaf in water under bright light. Count the number of bubbles emerging after 3 minutes:
   - Observation: __________________________________________________
2. Complete the chemical word equation:
   - Carbon Dioxide + _____________ -> Glucose + _____________

#### Part B: 3-Minute Exit Slip (Mandatory Student Reflection)
- **Question 1:** Why is cellular respiration vital even for green autotrophic plants?
  - Response: ____________________________________________________
- **Question 2:** Rate your confidence today (1 - Novice, 5 - Master): [ ]`;

  it("handles empty or null content safely", () => {
    expect(parseLessonPlanSections("")).toEqual({
      cleanPlanContent: "",
      studentWorksheetContent: "",
      tlmKitContent: "",
    });
  });

  it("correctly separates the teacher lesson plan and student activity handout", () => {
    const { cleanPlanContent, studentWorksheetContent } = parseLessonPlanSections(sampleLessonPlan);

    // cleanPlanContent contains the teacher sections
    expect(cleanPlanContent).toContain("Lesson Plan: Photosynthesis");
    expect(cleanPlanContent).toContain("Specific Learning Objectives");
    expect(cleanPlanContent).toContain("Misconception Radar");

    // cleanPlanContent should NOT contain the student handout
    expect(cleanPlanContent).not.toContain("Student Classroom Activity Handout & Exit Slip");
    expect(cleanPlanContent).not.toContain("Part B: 3-Minute Exit Slip");

    // studentWorksheetContent contains the student handout and exit slip
    expect(studentWorksheetContent).toContain("Student Classroom Activity Handout & Exit Slip");
    expect(studentWorksheetContent).toContain("Part A: Hands-On Exploration & Observation Log");
    expect(studentWorksheetContent).toContain("Part B: 3-Minute Exit Slip");
  });

  it("correctly extracts the TLM kit section for focused material preparation", () => {
    const { tlmKitContent } = parseLessonPlanSections(sampleLessonPlan);

    expect(tlmKitContent).toContain("Comprehensive Teaching Learning Material (TLM) Kit");
    expect(tlmKitContent).toContain("Low/No-Cost Physical Manipulatives");
    expect(tlmKitContent).toContain("PhET Interactive Simulation");
    expect(tlmKitContent).toContain("Eco-Friendly Clean-up");
  });

  it("gracefully falls back when no student handout demarcation exists", () => {
    const plainPlan = `# Simple Plan\n\n### Objectives\n- Learn math`;
    const { cleanPlanContent, studentWorksheetContent } = parseLessonPlanSections(plainPlan);

    expect(cleanPlanContent).toBe(plainPlan);
    expect(studentWorksheetContent).toBe("");
  });
});
