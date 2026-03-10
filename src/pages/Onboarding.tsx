import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, ArrowLeft, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import questionsData from "@/data/onboardingQuestions.json";

type Answer = string | string[];

const Onboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [answers, setAnswers] = useState<Record<string, Answer>>({});

  const allQuestions = useMemo(() => questionsData.sections.flatMap((s) => s.questions), []);
  const [currentIdx, setCurrentIdx] = useState(0);
  const question = allQuestions[currentIdx];
  const total = allQuestions.length;
  const progress = ((currentIdx + 1) / total) * 100;

  const isFreeText = question.options.length === 1 &&
    (question.options[0].toLowerCase().includes("free text") || question.options[0].toLowerCase().includes("optional"));
  const isMultiSelect = question.options.length === 1 && question.options[0].toLowerCase().includes("multi-select");

  const handleSelect = (option: string) => {
    if (isFreeText || isMultiSelect) return;
    setAnswers((prev) => ({ ...prev, [question.id]: option }));
  };

  const handleMultiToggle = (option: string) => {
    setAnswers((prev) => {
      const current = (prev[question.id] as string[]) || [];
      if (current.includes(option)) return { ...prev, [question.id]: current.filter((o) => o !== option) };
      return { ...prev, [question.id]: [...current, option] };
    });
  };

  const handleNext = async () => {
    if (currentIdx < total - 1) setCurrentIdx((i) => i + 1);
    else await finishOnboarding();
  };

  const finishOnboarding = async () => {
    localStorage.setItem("tradingProfile", JSON.stringify(answers));
    await supabase.from("trading_profiles").upsert({
      profile_key: "default", survey_answers: answers, auto_trade_enabled: true,
    }, { onConflict: "profile_key" });
    navigate("/chat");
  };

  const handleSkip = async () => { await finishOnboarding(); };
  const handleBack = () => { if (currentIdx > 0) setCurrentIdx((i) => i - 1); };

  const currentAnswer = answers[question.id];
  const hasAnswer = isFreeText
    ? typeof currentAnswer === "string" && currentAnswer.trim().length > 0
    : currentAnswer !== undefined;

  const currentSection = questionsData.sections.find((s) => s.questions.some((q) => q.id === question.id));
  const sectionLabel = currentSection?.id.replace(/_/g, " ") ?? "";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-background">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[150px] pointer-events-none" />

      <div className="w-full max-w-lg relative z-10">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-primary text-xs mb-2 font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="uppercase tracking-wider">{sectionLabel}</span>
          </div>
          <p className="text-muted-foreground text-sm">
            {currentIdx + 1} / {total}
          </p>
        </motion.div>

        <Progress value={progress} className="h-1 mb-8 bg-muted" />

        <AnimatePresence mode="wait">
          <motion.div
            key={question.id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
            className="bg-card border border-border/40 rounded-2xl p-8"
          >
            <h2 className="text-lg font-semibold mb-6 leading-relaxed">{question.text}</h2>

            {isFreeText ? (
              <Textarea
                placeholder="Type your answer here... (optional)"
                value={(currentAnswer as string) || ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))}
                className="bg-muted/30 border-border/40 min-h-[100px] resize-none"
              />
            ) : (
              <div className="space-y-2.5">
                {question.options.map((option) => {
                  const isSelected = Array.isArray(currentAnswer) ? currentAnswer.includes(option) : currentAnswer === option;
                  return (
                    <motion.button
                      key={option}
                      whileHover={{ scale: 1.005 }}
                      whileTap={{ scale: 0.995 }}
                      onClick={() => question.id === "Q15" || question.id === "Q18" ? handleMultiToggle(option) : handleSelect(option)}
                      className={`w-full text-left px-5 py-3.5 rounded-xl border transition-all duration-200 ${
                        isSelected
                          ? "border-primary/50 bg-primary/10 text-foreground shadow-sm"
                          : "border-border/40 bg-muted/20 text-secondary-foreground hover:border-primary/20 hover:bg-muted/40"
                      }`}
                    >
                      <span className="text-sm">{option}</span>
                    </motion.button>
                  );
                })}
              </div>
            )}

            {(question.id === "Q15" || question.id === "Q18") && (
              <p className="text-xs text-muted-foreground mt-3">Multiple selections allowed</p>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-between items-center mt-6">
          <Button variant="ghost" onClick={handleBack} disabled={currentIdx === 0} className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground text-sm">
            Skip Survey
          </Button>
          <Button onClick={handleNext} disabled={!hasAnswer && !isFreeText} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl">
            {currentIdx === total - 1 ? "Done" : "Next"}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
