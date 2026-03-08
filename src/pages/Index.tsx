import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, Bot, Shield } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-primary/5 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-20 right-10 w-[300px] h-[300px] rounded-full bg-primary/3 blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="text-center max-w-2xl relative z-10"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-xs font-mono text-primary mb-8"
        >
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          PAPER TRADING · POWERED BY AI
        </motion.div>

        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-[1.1]">
          AI Becomes
          <br />
          Your <span className="text-primary">Trading Partner</span>
        </h1>

        <p className="text-muted-foreground text-lg mb-10 max-w-md mx-auto leading-relaxed">
          Take a quick survey to identify your investment style, and let AI trade stocks automatically for you.
        </p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Button
            onClick={() => navigate("/onboarding")}
            size="lg"
            className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary text-base px-8 py-6 rounded-xl"
          >
            시작하기
            Get Started
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-16 grid grid-cols-3 gap-6"
        >
          {[
            { icon: TrendingUp, label: "Auto Trading", desc: "AI-powered trades" },
            { icon: Bot, label: "AI Analysis", desc: "Real-time market analysis" },
            { icon: Shield, label: "Safe Trading", desc: "Paper Trading" },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="glass rounded-xl p-4 text-center">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground mt-1">{desc}</p>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Index;
