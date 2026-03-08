import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, ArrowLeft, Sparkles } from "lucide-react";
import questionsData from "@/data/onboardingQuestions.json";

type Answer = string | string[];

const Onboarding = () => {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<string, Answer>>({});

  const allQuestions = useMemo(() => {
    return questionsData.sections.flatMap((s) => s.questions);
  }, []);

  const [currentIdx, setCurrentIdx] = useState(0);
  const question = allQuestions[currentIdx];
  const total = allQuestions.length;
  const progress = ((currentIdx + 1) / total) * 100;

  const isFreeText =
    question.options.length === 1 &&
    (question.options[0].toLowerCase().includes("free text") ||
      question.options[0].toLowerCase().includes("optional"));

  const isMultiSelect =
    question.options.length === 1 &&
    question.options[0].toLowerCase().includes("multi-select");

  const handleSelect = (option: string) => {
    if (isFreeText || isMultiSelect) return;
    setAnswers((prev) => ({ ...prev, [question.id]: option }));
  };

  const handleMultiToggle = (option: string) => {
    setAnswers((prev) => {
      const current = (prev[question.id] as string[]) || [];
      if (current.includes(option)) {
        return { ...prev, [question.id]: current.filter((o) => o !== current.find((c) => c === option)) };
      }
      return { ...prev, [question.id]: [...current, option] };
    });
  };

  const handleNext = () => {
    if (currentIdx < total - 1) {
      setCurrentIdx((i) => i + 1);
    } else {
      // Save profile & navigate to chat
      localStorage.setItem("tradingProfile", JSON.stringify(answers));
      navigate("/chat");
    }
  };

  const handleBack = () => {
    if (currentIdx > 0) setCurrentIdx((i) => i - 1);
  };

  const currentAnswer = answers[question.id];
  const hasAnswer = isFreeText
    ? typeof currentAnswer === "string" && currentAnswer.trim().length > 0
    : currentAnswer !== undefined;

  // Section label
  const currentSection = questionsData.sections.find((s) =>
    s.questions.some((q) => q.id === question.id)
  );
  const sectionLabel = currentSection?.id.replace(/_/g, " ") ?? "";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-lg relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 text-primary font-mono text-sm mb-2">
            <Sparkles className="w-4 h-4" />
            <span className="uppercase tracking-wider">{sectionLabel}</span>
          </div>
          <p className="text-muted-foreground text-sm">
            Question {currentIdx + 1} of {total}
          </p>
        </motion.div>

        {/* Progress */}
        <Progress value={progress} className="h-1 mb-8 bg-secondary" />

        {/* Question */}
        <AnimatePresence mode="wait">
          <motion.div
            key={question.id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
            className="glass rounded-2xl p-8"
          >
            <h2 className="text-xl font-semibold mb-6 leading-relaxed">
              {question.text}
            </h2>

            {isFreeText ? (
              <Textarea
                placeholder="Type your answer here... (optional)"
                value={(currentAnswer as string) || ""}
                onChange={(e) =>
                  setAnswers((prev) => ({
                    ...prev,
                    [question.id]: e.target.value,
                  }))
                }
                className="bg-secondary/50 border-border/50 min-h-[100px] resize-none"
              />
            ) : (
              <div className="space-y-3">
                {question.options.map((option) => {
                  const isSelected = Array.isArray(currentAnswer)
                    ? currentAnswer.includes(option)
                    : currentAnswer === option;

                  return (
                    <motion.button
                      key={option}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() =>
                        question.id === "Q15" || question.id === "Q18"
                          ? handleMultiToggle(option)
                          : handleSelect(option)
                      }
                      className={`w-full text-left px-5 py-4 rounded-xl border transition-all duration-200 ${
                        isSelected
                          ? "border-primary/60 bg-primary/10 text-foreground glow-primary"
                          : "border-border/50 bg-secondary/30 text-secondary-foreground hover:border-primary/30 hover:bg-secondary/50"
                      }`}
                    >
                      <span className="text-sm">{option}</span>
                    </motion.button>
                  );
                })}
              </div>
            )}

            {(question.id === "Q15" || question.id === "Q18") && (
              <p className="text-xs text-muted-foreground mt-3">
                여러 개 선택 가능
              </p>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={currentIdx === 0}
            className="text-muted-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            이전
          </Button>

          <Button
            onClick={handleNext}
            disabled={!hasAnswer && !isFreeText}
            className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary"
          >
            {currentIdx === total - 1 ? "완료" : "다음"}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
