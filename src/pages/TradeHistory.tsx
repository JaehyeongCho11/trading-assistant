import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Pause } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Trade = {
  id: string;
  symbol: string;
  side: string;
  qty: number;
  price: number | null;
  order_id: string | null;
  reason: string | null;
  status: string | null;
  created_at: string;
};

const TradeHistory = () => {
  const navigate = useNavigate();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "buy" | "sell" | "hold">("all");

  const loadTrades = async () => {
    setLoading(true);
    let query = supabase
      .from("trade_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (filter !== "all") {
      query = query.eq("side", filter);
    }

    const { data } = await query;
    setTrades((data as Trade[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadTrades();
  }, [filter]);

  const stats = {
    total: trades.length,
    buys: trades.filter((t) => t.side === "buy").length,
    sells: trades.filter((t) => t.side === "sell").length,
    holds: trades.filter((t) => t.side === "hold").length,
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="glass border-b border-border/50 px-6 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/chat")} className="w-8 h-8">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="font-semibold text-sm">Trade History</h1>
        <Button variant="ghost" size="icon" onClick={loadTrades} className="ml-auto w-8 h-8">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 p-4">
        {[
          { label: "All", value: stats.total, color: "text-foreground" },
          { label: "Buy", value: stats.buys, color: "text-primary" },
          { label: "Sell", value: stats.sells, color: "text-destructive" },
          { label: "Hold", value: stats.holds, color: "text-muted-foreground" },
        ].map((s) => (
          <div key={s.label} className="glass rounded-xl p-3 text-center">
            <p className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 px-4 pb-3">
        {(["all", "buy", "sell", "hold"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f
                ? "bg-primary/15 text-primary border border-primary/30"
                : "bg-secondary/40 text-muted-foreground hover:bg-secondary/60"
            }`}
          >
            {f === "all" ? "All" : f === "buy" ? "Buy" : f === "sell" ? "Sell" : "Hold"}
          </button>
        ))}
      </div>

      {/* Trade list */}
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-2 pb-4">
          {trades.length === 0 && !loading && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No trade history yet
            </div>
          )}
          {trades.map((t) => (
            <div
              key={t.id}
              className="glass rounded-xl p-4 flex items-start gap-3"
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  t.side === "buy"
                    ? "bg-primary/15"
                    : t.side === "sell"
                    ? "bg-destructive/15"
                    : "bg-secondary"
                }`}
              >
                {t.side === "buy" ? (
                  <TrendingUp className="w-4 h-4 text-primary" />
                ) : t.side === "sell" ? (
                  <TrendingDown className="w-4 h-4 text-destructive" />
                ) : (
                  <Pause className="w-4 h-4 text-muted-foreground" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-sm">
                      {t.side === "hold" ? "관망" : t.symbol}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        t.side === "buy"
                          ? "bg-primary/10 text-primary"
                          : t.side === "sell"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {t.side === "buy" ? "매수" : t.side === "sell" ? "매도" : "관망"}
                    </span>
                    {t.status && t.status !== "hold" && (
                      <span className="text-[10px] text-muted-foreground">{t.status}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {new Date(t.created_at).toLocaleDateString("ko-KR", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {t.side !== "hold" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {t.qty}주{t.price ? ` · $${Number(t.price).toFixed(2)}` : ""}
                  </p>
                )}

                {t.reason && (
                  <p className="text-xs text-muted-foreground/70 mt-1.5 leading-relaxed">
                    {t.reason}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default TradeHistory;
