import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Save, Zap, DollarSign, Brain, RefreshCw, User, Clock, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoTradeEnabled, setAutoTradeEnabled] = useState(true);
  const [maxTradeAmount, setMaxTradeAmount] = useState("1000");
  const [strategyPrompt, setStrategyPrompt] = useState("");
  const [tradeInterval, setTradeInterval] = useState("5");
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, any>>({});

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    setLoading(true);
    const { data } = await supabase.from("trading_profiles").select("*").eq("profile_key", "default").single();
    if (data) {
      setAutoTradeEnabled(data.auto_trade_enabled);
      setMaxTradeAmount(String(data.max_trade_amount || 1000));
      setStrategyPrompt(data.strategy_prompt || "");
      setTradeInterval(String((data as any).trade_interval_minutes || 5));
      setSurveyAnswers((data.survey_answers as Record<string, any>) || {});
    }
    setLoading(false);
  };

  const saveProfile = async () => {
    setSaving(true);
    const { error } = await supabase.from("trading_profiles").update({
      auto_trade_enabled: autoTradeEnabled,
      max_trade_amount: parseFloat(maxTradeAmount) || 1000,
      strategy_prompt: strategyPrompt,
      trade_interval_minutes: parseInt(tradeInterval) || 5,
    } as any).eq("profile_key", "default");
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to save profile." });
    } else {
      toast({ title: "Saved", description: "Profile updated successfully." });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border/40 bg-card/60 backdrop-blur-lg px-5 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/chat")} className="w-8 h-8 rounded-lg">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="font-semibold text-sm">Trading Profile</h1>
        <Button variant="ghost" size="icon" onClick={saveProfile} disabled={saving} className="ml-auto w-8 h-8 rounded-lg">
          <Save className={`w-4 h-4 ${saving ? "animate-pulse" : ""}`} />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4 max-w-lg mx-auto">
          {/* Auto Trade */}
          <div className="bg-card border border-border/40 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Auto Trading</p>
                <p className="text-[11px] text-muted-foreground">Enable AI-powered autonomous trading</p>
              </div>
              <Switch checked={autoTradeEnabled} onCheckedChange={setAutoTradeEnabled} />
            </div>
          </div>

          {/* Trade Interval */}
          <div className="bg-card border border-border/40 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Trading Interval</p>
                <p className="text-[11px] text-muted-foreground">How often the AI analyzes and trades</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: "1", label: "1 min" },
                { value: "5", label: "5 min" },
                { value: "10", label: "10 min" },
                { value: "15", label: "15 min" },
                { value: "30", label: "30 min" },
                { value: "60", label: "1 hr" },
                { value: "120", label: "2 hr" },
                { value: "240", label: "4 hr" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTradeInterval(opt.value)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    tradeInterval === opt.value
                      ? "bg-primary/15 text-primary border border-primary/25"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted/60 border border-transparent"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Max Trade Amount */}
          <div className="bg-card border border-border/40 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Max Trade Amount</p>
                <p className="text-[11px] text-muted-foreground">Maximum amount per trade in USD</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground font-medium">$</span>
              <Input
                type="number"
                value={maxTradeAmount}
                onChange={(e) => setMaxTradeAmount(e.target.value)}
                className="font-mono"
                min={0}
              />
            </div>
          </div>

          {/* Strategy */}
          <div className="bg-card border border-border/40 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Brain className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Trading Strategy</p>
                <p className="text-[11px] text-muted-foreground">Custom instructions for the AI trader</p>
              </div>
            </div>
            <textarea
              value={strategyPrompt}
              onChange={(e) => setStrategyPrompt(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-border/40 bg-muted/30 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none transition-shadow"
              placeholder="e.g. Focus on tech stocks, be conservative with risk..."
            />
          </div>

          {/* Survey Answers */}
          {Object.keys(surveyAnswers).length > 0 && (
            <div className="bg-card border border-border/40 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Survey Responses</p>
                  <p className="text-[11px] text-muted-foreground">Your onboarding preferences</p>
                </div>
              </div>
              <div className="space-y-2">
                {Object.entries(surveyAnswers).map(([key, value]) => (
                  <div key={key} className="flex items-start gap-2 text-xs">
                    <span className="text-muted-foreground min-w-[80px] font-medium">{key}:</span>
                    <span className="text-foreground font-mono">
                      {Array.isArray(value) ? value.join(", ") : String(value)}
                    </span>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => navigate("/onboarding")}>
                Retake Survey
              </Button>
            </div>
          )}

          {/* Save Button */}
          <Button onClick={saveProfile} disabled={saving} className="w-full h-11 rounded-xl font-semibold">
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </ScrollArea>
    </div>
  );
};

export default Profile;
