import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Send, Bot, User, TrendingUp, Loader2, Zap, History, UserCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import StockChart from "@/components/StockChart";
import AccountBanner from "@/components/AccountBanner";
import { useToast } from "@/hooks/use-toast";

function simpleMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br/>")
    .replace(/^/, "<p>").replace(/$/, "</p>");
}

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

async function streamChat({
  messages,
  onDelta,
  onDone,
  onError,
}: {
  messages: Msg[];
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (resp.status === 429) {
    onError("Too many requests. Please try again later.");
    return;
  }
  if (resp.status === 402) {
    onError("Insufficient credits. Please recharge.");
    return;
  }
  if (!resp.ok || !resp.body) {
    onError("An error occurred with the AI response.");
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") { streamDone = true; break; }
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }
  onDone();
}

const Chat = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [autoTradeEnabled, setAutoTradeEnabled] = useState(true);
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const profile = localStorage.getItem("tradingProfile");

  // Load auto-trade status and recent trades
  useEffect(() => {
    const loadStatus = async () => {
      const { data: prof } = await supabase
        .from("trading_profiles")
        .select("auto_trade_enabled")
        .eq("profile_key", "default")
        .single();
      if (prof) setAutoTradeEnabled(prof.auto_trade_enabled);

      const { data: trades } = await supabase
        .from("trade_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      if (trades) setRecentTrades(trades);
    };
    loadStatus();

    // Poll for new trades every 30s
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const toggleAutoTrade = async (enabled: boolean) => {
    setAutoTradeEnabled(enabled);
    await supabase
      .from("trading_profiles")
      .update({ auto_trade_enabled: enabled })
      .eq("profile_key", "default");
    toast({
      title: enabled ? "Auto-Trade Enabled" : "Auto-Trade Disabled",
      description: enabled
        ? "AI analyzes the market every 5 minutes and trades automatically."
        : "Auto-trading has been stopped.",
    });
  };

  useEffect(() => {
    if (messages.length === 0 && profile) {
      const greeting: Msg = {
        role: "assistant",
        content:
          "Hello! 🚀 Profile analysis complete.\n\n**Auto-trading is now active.** The AI analyzes the market every 5 minutes and executes trades matching your profile — even when your computer is off.\n\nYou can also give direct commands:\n- \"Buy 10 shares of Tesla\"\n- \"Show my portfolio\"\n- \"Show recent auto-trade history\"",
      };
      setMessages([greeting]);
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && prev.length === newMessages.length + 1) {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
          );
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      await streamChat({
        messages: newMessages.filter((m) => m.role !== "assistant" || m.content),
        onDelta: upsertAssistant,
        onDone: () => setIsLoading(false),
        onError: (msg) => {
          toast({ variant: "destructive", title: "Error", description: msg });
          setIsLoading(false);
        },
      });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "A network error occurred." });
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="glass border-b border-border/50 px-6 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-primary" />
        </div>
        <h1 className="font-semibold text-sm">AI Trading Assistant</h1>
        <div className="ml-auto flex items-center gap-4">
          {/* Auto-trade toggle */}
          <div className="flex items-center gap-2">
            <Zap className={`w-3.5 h-3.5 ${autoTradeEnabled ? "text-primary" : "text-muted-foreground"}`} />
            <span className="text-xs text-muted-foreground hidden sm:inline">Auto Trade</span>
            <Switch
              checked={autoTradeEnabled}
              onCheckedChange={toggleAutoTrade}
              className="scale-75"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/history")}
            className="w-8 h-8"
            title="Trade History"
          >
            <History className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/profile")}
            className="w-8 h-8"
            title="Profile"
          >
            <UserCircle className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${autoTradeEnabled ? "bg-primary animate-pulse" : "bg-muted-foreground"}`} />
            <span className="text-xs text-muted-foreground">{autoTradeEnabled ? "Active" : "Off"}</span>
          </div>
        </div>
      </div>

      {/* Account Info */}
      <AccountBanner />

      {/* Stock Chart */}
      <StockChart />

      {/* Recent auto-trades banner */}
      {recentTrades.length > 0 && (
        <div className="glass border-b border-border/50 px-4 py-2 overflow-x-auto">
          <div className="flex items-center gap-3">
            <History className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
              {recentTrades.map((t) => (
                <div
                  key={t.id}
                  className={`flex-shrink-0 px-3 py-1 rounded-md text-[10px] font-mono border ${
                    t.side === "buy"
                      ? "border-primary/30 bg-primary/5 text-primary"
                      : t.side === "sell"
                      ? "border-destructive/30 bg-destructive/5 text-destructive"
                      : "border-border/50 bg-secondary/30 text-muted-foreground"
                  }`}
                >
                  {t.side === "hold" ? "⏸ Hold" : `${t.side === "buy" ? "🟢" : "🔴"} ${t.symbol} ${t.qty} shares`}
                  <span className="text-muted-foreground ml-1">
                    {new Date(t.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex-shrink-0 flex items-center justify-center mt-1">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "glass"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div
                      className="prose prose-sm prose-invert max-w-none [&_p]:mb-2 [&_li]:mb-1"
                      dangerouslySetInnerHTML={{ __html: simpleMarkdown(msg.content) }}
                    />
                  ) : (
                    msg.content
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-lg bg-secondary flex-shrink-0 flex items-center justify-center mt-1">
                    <User className="w-4 h-4 text-secondary-foreground" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="glass rounded-2xl px-4 py-3">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            </motion.div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="glass border-t border-border/50 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="max-w-3xl mx-auto flex gap-3"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="bg-secondary/50 border-border/50 h-12"
            disabled={isLoading}
          />
          <Button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="h-12 w-12 bg-primary text-primary-foreground hover:bg-primary/90 glow-primary"
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
