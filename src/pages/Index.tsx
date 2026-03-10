import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, Bot, Shield, BarChart3 } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-primary/8 blur-[180px] pointer-events-none" />
      <div className="absolute bottom-20 right-10 w-[400px] h-[400px] rounded-full bg-chart-up/5 blur-[120px] pointer-events-none" />

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
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary mb-8 tracking-wide"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-chart-up animate-pulse" />
          PAPER TRADING · AI POWERED
        </motion.div>

        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-[1.1]">
          AI Becomes
          <br />
          Your <span className="text-primary">Trading Partner</span>
        </h1>

        <p className="text-muted-foreground text-base md:text-lg mb-10 max-w-md mx-auto leading-relaxed">
          Take a quick survey to identify your investment style, and let AI trade stocks automatically for you.
        </p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row items-center gap-3 justify-center"
        >
          <Button
            onClick={() => navigate("/onboarding")}
            size="lg"
            className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary text-sm font-semibold px-8 py-6 rounded-xl"
          >
            Get Started
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate("/chat")}
            className="text-sm px-6 py-6 rounded-xl border-border/60"
          >
            대시보드 보기
            <BarChart3 className="w-4 h-4 ml-2" />
          </Button>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {[
            { icon: TrendingUp, label: "자동 매매", desc: "AI 기반 실시간 트레이딩" },
            { icon: Bot, label: "AI 분석", desc: "시장 데이터 실시간 분석" },
            { icon: Shield, label: "안전한 거래", desc: "모의투자로 리스크 제로" },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="glass rounded-xl p-5 text-center hover:border-primary/20 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <p className="text-sm font-semibold mb-1">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Index;
