"use client";

import React, { useState, useEffect } from "react";
import {
  X, Sparkles, Lightbulb, CheckCircle2, AlertCircle,
  ArrowRight, RotateCcw, Trophy, Brain, ChevronRight, HelpCircle
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { apiClient } from "@/lib/axios";
import { cleanLatexMath } from "@/lib/latex-formatter";

interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string;
  hint: string;
  explanation: string;
  bloomLevel?: string;
}

interface PracticeSession {
  subject: string;
  topic: string;
  difficulty: string;
  remedialFocus: string;
  conceptRecap: string;
  questions: Question[];
}

interface AdaptivePracticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject: string;
  topic: string;
  grade?: string;
  onComplete?: (score: number, total: number) => void;
}

export default function AdaptivePracticeModal({
  isOpen,
  onClose,
  subject,
  topic,
  grade = "Class 10",
  onComplete,
}: AdaptivePracticeModalProps) {
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [revealedHints, setRevealedHints] = useState<Record<number, boolean>>({});
  const [userAnswers, setUserAnswers] = useState<Record<number, { selected: string; isCorrect: boolean }>>({});
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (isOpen && subject && topic) {
      loadPracticeQuestions();
    } else {
      // Reset state on close
      setSession(null);
      setCurrentIndex(0);
      setSelectedOption(null);
      setIsAnswerSubmitted(false);
      setRevealedHints({});
      setUserAnswers({});
      setIsFinished(false);
    }
  }, [isOpen, subject, topic]);

  const loadPracticeQuestions = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post("/ai/student/practice", {
        subject,
        topic,
        grade,
        difficulty: "STANDARD",
      });
      const data = res.data?.data || res.data;
      setSession(data.practiceSession || data);
      setCurrentIndex(0);
      setSelectedOption(null);
      setIsAnswerSubmitted(false);
      setRevealedHints({});
      setUserAnswers({});
      setIsFinished(false);
    } catch (err) {
      console.error("Failed to generate adaptive practice session:", err);
      // Deterministic fallback practice session for K-10
      setSession({
        subject,
        topic,
        difficulty: "STANDARD",
        remedialFocus: `Foundational mastery and concept recall for ${topic}`,
        conceptRecap: `Focus on core principles of ${topic}. Break down formulas and solve step-by-step.`,
        questions: [
          {
            id: 1,
            question: `In ${subject}, which of the following best represents the foundational principle of ${topic}?`,
            options: [
              "A) Direct proportionality and linear balance",
              "B) Inverse quadratic relationship",
              "C) Constant state equilibrium",
              "D) Independent variable isolation",
            ],
            correctAnswer: "A) Direct proportionality and linear balance",
            hint: "Think about the baseline relation established in introductory examples.",
            explanation: "Direct linear relations provide the standard foundational baseline before applying higher-order transformations.",
            bloomLevel: "Understanding",
          },
          {
            id: 2,
            question: `When solving problems involving ${topic}, what is the recommended first diagnostic step?`,
            options: [
              "A) Formulate all given data into standard units",
              "B) Substitute directly without checking boundary conditions",
              "C) Ignore negative coefficients",
              "D) Guess the order of magnitude",
            ],
            correctAnswer: "A) Formulate all given data into standard units",
            hint: "Standardizing given parameters eliminates dimensional errors early.",
            explanation: "Always convert and normalize parameters to standard SI or canonical algebraic form first.",
            bloomLevel: "Applying",
          },
          {
            id: 3,
            question: `What is a common pitfall students encounter during examination questions on ${topic}?`,
            options: [
              "A) Overlooking sign conventions and step-wise unit verification",
              "B) Writing answers too clearly",
              "C) Using the standard formula correctly",
              "D) Rechecking final calculations",
            ],
            correctAnswer: "A) Overlooking sign conventions and step-wise unit verification",
            hint: "Most marks are dropped in algebraic sign changes or unit conversions.",
            explanation: "Sign conventions and dimensional consistency account for over 70% of avoidable examination errors.",
            bloomLevel: "Analyzing",
          },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const questions = session?.questions || [];
  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;

  const handleSelectOption = (option: string) => {
    if (isAnswerSubmitted) return;
    setSelectedOption(option);
  };

  const handleToggleHint = () => {
    setRevealedHints((prev) => ({ ...prev, [currentIndex]: !prev[currentIndex] }));
  };

  const handleSubmitAnswer = () => {
    if (!selectedOption || !currentQuestion || isAnswerSubmitted) return;
    const isCorrect = selectedOption.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase()
      || selectedOption.startsWith(currentQuestion.correctAnswer.charAt(0));

    setUserAnswers((prev) => ({
      ...prev,
      [currentIndex]: { selected: selectedOption, isCorrect },
    }));
    setIsAnswerSubmitted(true);
  };

  const handleNextQuestion = () => {
    if (currentIndex + 1 < totalQuestions) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswerSubmitted(false);
    } else {
      setIsFinished(true);
      const correctCount = Object.values(userAnswers).filter((a) => a.isCorrect).length;
      if (onComplete) {
        onComplete(correctCount, totalQuestions);
      }
    }
  };

  const calculateScore = () => {
    return Object.values(userAnswers).filter((a) => a.isCorrect).length;
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        style={{
          background: "var(--bg-surface)",
          borderRadius: "var(--radius-2xl)",
          width: "100%",
          maxWidth: "760px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
          border: "1px solid var(--border-default)",
          overflow: "hidden",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "1.25rem 1.75rem",
            background: "linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(124, 58, 237, 0.08) 100%)",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                boxShadow: "0 4px 12px rgba(79, 70, 229, 0.35)",
              }}
            >
              <Brain size={20} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 800, color: "var(--text-primary)" }}>
                  Adaptive Remedial & Revision Tutor
                </h3>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    padding: "0.15rem 0.5rem",
                    borderRadius: "var(--radius-full)",
                    background: "rgba(99, 102, 241, 0.15)",
                    color: "#4F46E5",
                  }}
                >
                  K–10 Personalized
                </span>
              </div>
              <p style={{ margin: "0.15rem 0 0", fontSize: "12px", color: "var(--text-secondary)" }}>
                {subject} • <b>{topic}</b>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-secondary)",
              padding: "0.4rem",
              borderRadius: "var(--radius-md)",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "1.75rem", overflowY: "auto", flex: 1 }}>
          {loading ? (
            <div style={{ padding: "4rem 2rem", textAlign: "center" }}>
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "50%",
                  background: "rgba(99, 102, 241, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 1rem",
                }}
              >
                <Sparkles size={26} color="#6366F1" className="animate-spin" />
              </div>
              <h4 style={{ fontSize: "var(--text-base)", fontWeight: 700, margin: "0 0 0.35rem", color: "var(--text-primary)" }}>
                Synthesizing Adaptive Practice Quiz...
              </h4>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", margin: 0 }}>
                Targeting learning gaps in {topic} with step-by-step pedagogical hints.
              </p>
            </div>
          ) : isFinished ? (
            /* Session Completed Screen */
            <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 1.25rem",
                  color: "#FFFFFF",
                  boxShadow: "0 8px 24px rgba(16, 185, 129, 0.35)",
                }}
              >
                <Trophy size={32} />
              </div>

              <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)", margin: "0 0 0.5rem" }}>
                Practice Session Mastered!
              </h2>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", maxWidth: "420px", margin: "0 auto 1.5rem" }}>
                You completed the adaptive diagnostic micro-quiz on <b>{topic}</b>.
              </p>

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "1.5rem",
                  padding: "1rem 2rem",
                  borderRadius: "var(--radius-xl)",
                  background: "var(--bg-app)",
                  border: "1px solid var(--border-default)",
                  marginBottom: "2rem",
                }}
              >
                <div>
                  <div style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 700 }}>Score</div>
                  <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--brand-primary)" }}>
                    {calculateScore()} / {totalQuestions}
                  </div>
                </div>
                <div style={{ width: "1px", height: "40px", background: "var(--border-subtle)" }} />
                <div>
                  <div style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 700 }}>Mastery Status</div>
                  <div style={{ fontSize: "1rem", fontWeight: 800, color: calculateScore() >= totalQuestions * 0.7 ? "#10B981" : "#F59E0B" }}>
                    {calculateScore() >= totalQuestions * 0.7 ? "Concept Cleared" : "Review Recommended"}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: "1rem" }}>
                <Button variant="outline" onClick={loadPracticeQuestions} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <RotateCcw size={14} /> Practice Again
                </Button>
                <Button
                  variant="primary"
                  onClick={onClose}
                  style={{
                    background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
                    color: "#FFFFFF",
                    border: "none",
                  }}
                >
                  Done & Return to Marks
                </Button>
              </div>
            </div>
          ) : currentQuestion ? (
            /* Active Question Screen */
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* Concept Recap Card */}
              {session?.conceptRecap && (
                <div
                  style={{
                    padding: "0.85rem 1.1rem",
                    borderRadius: "var(--radius-lg)",
                    background: "rgba(99, 102, 241, 0.05)",
                    border: "1px solid rgba(99, 102, 241, 0.2)",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.6rem",
                  }}
                >
                  <Sparkles size={16} color="#6366F1" style={{ flexShrink: 0, marginTop: "2px" }} />
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#4F46E5", textTransform: "uppercase" }}>Quick Concept Anchor</span>
                    <p style={{ margin: "0.15rem 0 0", fontSize: "12px", color: "var(--text-primary)", lineHeight: 1.5 }}>
                      {cleanLatexMath(session.conceptRecap)}
                    </p>
                  </div>
                </div>
              )}

              {/* Progress & Bloom Tag */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)" }}>
                  Question {currentIndex + 1} of {totalQuestions}
                </span>
                {currentQuestion.bloomLevel && (
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      padding: "0.15rem 0.5rem",
                      borderRadius: "var(--radius-full)",
                      background: "rgba(16, 185, 129, 0.1)",
                      color: "var(--status-success)",
                      textTransform: "uppercase",
                    }}
                  >
                    Bloom: {currentQuestion.bloomLevel}
                  </span>
                )}
              </div>

              {/* Question Text */}
              <div
                style={{
                  fontSize: "var(--text-base)",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  lineHeight: 1.6,
                }}
              >
                {cleanLatexMath(currentQuestion.question)}
              </div>

              {/* Options */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {currentQuestion.options.map((opt, oidx) => {
                  const isSelected = selectedOption === opt;
                  const isCorrect = opt.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase()
                    || opt.startsWith(currentQuestion.correctAnswer.charAt(0));

                  let optionBorder = "1px solid var(--border-default)";
                  let optionBg = "var(--bg-app)";
                  let optionColor = "var(--text-primary)";

                  if (isAnswerSubmitted) {
                    if (isCorrect) {
                      optionBorder = "1px solid #10B981";
                      optionBg = "rgba(16, 185, 129, 0.1)";
                      optionColor = "var(--status-success)";
                    } else if (isSelected && !isCorrect) {
                      optionBorder = "1px solid #EF4444";
                      optionBg = "rgba(239, 68, 68, 0.1)";
                      optionColor = "var(--status-danger)";
                    }
                  } else if (isSelected) {
                    optionBorder = "1px solid var(--brand-primary)";
                    optionBg = "rgba(99, 102, 241, 0.08)";
                  }

                  return (
                    <button
                      key={oidx}
                      onClick={() => handleSelectOption(opt)}
                      disabled={isAnswerSubmitted}
                      style={{
                        padding: "0.85rem 1.1rem",
                        borderRadius: "var(--radius-xl)",
                        background: optionBg,
                        border: optionBorder,
                        color: optionColor,
                        textAlign: "left",
                        fontSize: "var(--text-sm)",
                        fontWeight: isSelected ? 700 : 500,
                        cursor: isAnswerSubmitted ? "default" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span>{cleanLatexMath(opt)}</span>
                      {isAnswerSubmitted && isCorrect && <CheckCircle2 size={16} color="#10B981" />}
                      {isAnswerSubmitted && isSelected && !isCorrect && <AlertCircle size={16} color="#EF4444" />}
                    </button>
                  );
                })}
              </div>

              {/* Hint Reveal Section */}
              <div style={{ marginTop: "0.5rem" }}>
                <button
                  onClick={handleToggleHint}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#F59E0B",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    padding: 0,
                  }}
                >
                  <Lightbulb size={14} />
                  {revealedHints[currentIndex] ? "Hide Step-by-Step Hint" : "Need Help? Reveal Hint"}
                </button>

                {revealedHints[currentIndex] && (
                  <div
                    style={{
                      marginTop: "0.5rem",
                      padding: "0.75rem 1rem",
                      borderRadius: "var(--radius-md)",
                      background: "rgba(245, 158, 11, 0.08)",
                      border: "1px solid rgba(245, 158, 11, 0.25)",
                      fontSize: "12px",
                      color: "var(--text-primary)",
                      lineHeight: 1.5,
                    }}
                  >
                    💡 <b>Pedagogical Hint:</b> {cleanLatexMath(currentQuestion.hint)}
                  </div>
                )}
              </div>

              {/* Explanation (Shown upon submission) */}
              {isAnswerSubmitted && (
                <div
                  style={{
                    padding: "0.85rem 1.1rem",
                    borderRadius: "var(--radius-lg)",
                    background: "var(--bg-app)",
                    border: "1px solid var(--border-default)",
                    fontSize: "12px",
                    lineHeight: 1.6,
                  }}
                >
                  <b style={{ color: "var(--text-primary)" }}>Detailed Explanation:</b>
                  <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)" }}>
                    {cleanLatexMath(currentQuestion.explanation)}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "2rem" }}>
              <p>No questions generated.</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {!isFinished && !loading && (
          <div
            style={{
              padding: "1rem 1.75rem",
              background: "var(--bg-surface)",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Button variant="outline" size="sm" onClick={onClose}>
              Exit Practice
            </Button>

            {!isAnswerSubmitted ? (
              <Button
                variant="primary"
                size="sm"
                disabled={!selectedOption}
                onClick={handleSubmitAnswer}
                style={{
                  background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
                  color: "#FFFFFF",
                  border: "none",
                }}
              >
                Submit Answer
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleNextQuestion}
                style={{
                  background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                  color: "#FFFFFF",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                }}
              >
                <span>{currentIndex + 1 < totalQuestions ? "Next Question" : "Finish Practice"}</span>
                <ArrowRight size={14} />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
