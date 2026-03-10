import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Pause, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const MARKET_DATA_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/market-data`;

type Trade = {
  id: string; symbol: string; side: string; qty: number;
  price: number | null; order_id: string | null;
  reason: string | null; status: string | null; created_at: string;
};

type Position = { symbol: string; qty: number; avg_entry_price: number };

const TradeHistory = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "buy" | "sell" | "hold">("all");
  const [positions, setPositions] = useState<Position[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [account, setAccount] = useState<{ balance: number; initial_balance: number } | null>(null);

  const loadTrades = async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase.from("trade_history").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
    if (filter !== "all") query = query.eq("side", filter);
    const { data } = await query;
    setTrades((data as Trade[]) || []);
    setLoading(false);
  };

  const loadAccount = async () => {
    if (!user) return;
    const [{ data: acc }, { data: posData }] = await Promise.all([
      supabase.from("user_accounts").select("*").eq("user_id", user.id).single(),
      supabase.from("user_positions").select("*").eq("user_id", user.id),
    ]);
    if (acc) setAccount({ balance: Number(acc.balance), initial_balance: Number(acc.initial_balance) });
    const pos = (posData || []).filter((p: any) => Number(p.qty) > 0).map((p: any) => ({
      symbol: p.symbol, qty: Number(p.qty), avg_entry_price: Number(p.avg_entry_price),
    }));
    setPositions(pos);

    if (pos.length > 0) {
      try {
        const symbols = pos.map((p: Position) => p.symbol).join(",");
        const res = await fetch(`${MARKET_DATA_URL}?type=quotes&symbols=${symbols}`, {
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        });
        const json = await res.json();
        if (json.quotes) {
          const priceMap: Record<string, number> = {};
          for (const [sym, q] of Object.entries(json.quotes as Record<string, any>)) {
            priceMap[sym] = parseFloat(q.price || q.last || q.close || "0");
          }
          setPrices(priceMap);
        }
      } catch (err) { console.error("Failed to fetch prices:", err); }
    }
  };

  useEffect(() => { loadTrades(); }, [filter, user]);
  useEffect(() => { loadAccount(); }, [user]);

  const totalUnrealizedPL = positions.reduce((sum, p) => {
    const price = prices[p.symbol] || p.avg_entry_price;
    return sum + (price - p.avg_entry_price) * p.qty;
  }, 0);
  const positionsValue = positions.reduce((sum, p) => sum + p.qty * (prices[p.symbol] || p.avg_entry_price), 0);
  const totalEquity = (account?.balance || 0) + positionsValue;
  const totalReturnPct = account && account.initial_balance > 0
    ? (((totalEquity - account.initial_balance) / account.initial_balance) * 100).toFixed(2) : "0.00";

  const stats = {
    total: trades.length,
    buys: trades.filter((t) => t.side === "buy").length,
    sells: trades.filter((t) => t.side === "sell").length,
    holds: trades.filter((t) => t.side === "hold").length,
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border/40 bg-card/60 backdrop-blur-lg px-5 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/chat")} className="w-8 h-8 rounded-lg">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="font-semibold text-sm">Trade History</h1>
        <Button variant="ghost" size="icon" onClick={() => { loadTrades(); loadAccount(); }} className="ml-auto w-8 h-8 rounded-lg">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Portfolio Returns */}
      {positions.length > 0 && (
        <div className="px-4 pt-4 pb-2">
          <div className="bg-card border border-border/40 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">Portfolio Returns</span>
            </div>
            <div className="flex items-baseline gap-2 mb-3">
              <span className={`text-xl font-bold font-mono ${totalUnrealizedPL >= 0 ? "text-chart-up" : "text-chart-down"}`}>
                {totalUnrealizedPL >= 0 ? "+" : ""}${totalUnrealizedPL.toFixed(2)}
              </span>
              <span className={`text-xs font-mono ${totalUnrealizedPL >= 0 ? "text-chart-up" : "text-chart-down"}`}>
                ({totalUnrealizedPL >= 0 ? "+" : ""}{totalReturnPct}%)
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {positions.map((pos) => {
                const currentPrice = prices[pos.symbol] || pos.avg_entry_price;
                const pl = (currentPrice - pos.avg_entry_price) * pos.qty;
                const plPct = pos.avg_entry_price > 0 ? ((currentPrice / pos.avg_entry_price - 1) * 100).toFixed(2) : "0.00";
                const isPositive = pl >= 0;
                return (
                  <div key={pos.symbol} className="px-3 py-2 rounded-lg bg-muted/30 border border-border/30">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-mono font-bold text-foreground">{pos.symbol}</span>
                      <span className="text-[10px] text-muted-foreground">{pos.qty} shares</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      ${currentPrice.toFixed(2)}
                    </p>
                    <p className={`text-xs font-mono font-semibold ${isPositive ? "text-chart-up" : "text-chart-down"}`}>
                      {isPositive ? "+" : ""}${pl.toFixed(2)} ({isPositive ? "+" : ""}{plPct}%)
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 px-4 py-2">
        {[
          { label: "All", value: stats.total, color: "text-foreground" },
          { label: "Buy", value: stats.buys, color: "text-chart-up" },
          { label: "Sell", value: stats.sells, color: "text-chart-down" },
          { label: "Hold", value: stats.holds, color: "text-muted-foreground" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border/40 rounded-xl p-3 text-center">
            <p className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 px-4 pb-3 pt-1">
        {(["all", "buy", "sell", "hold"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === f
                ? "bg-primary/15 text-primary border border-primary/25"
                : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
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
            <div className="text-center py-12 text-muted-foreground text-sm">No trade history yet</div>
          )}
          {trades.map((t) => (
            <div key={t.id} className="bg-card border border-border/40 rounded-xl p-4 flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                t.side === "buy" ? "bg-chart-up/10" : t.side === "sell" ? "bg-chart-down/10" : "bg-muted/50"
              }`}>
                {t.side === "buy" ? <TrendingUp className="w-4 h-4 text-chart-up" /> :
                 t.side === "sell" ? <TrendingDown className="w-4 h-4 text-chart-down" /> :
                 <Pause className="w-4 h-4 text-muted-foreground" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm">{t.side === "hold" ? "Hold" : t.symbol}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      t.side === "buy" ? "bg-chart-up/10 text-chart-up" :
                      t.side === "sell" ? "bg-chart-down/10 text-chart-down" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {t.side === "buy" ? "Buy" : t.side === "sell" ? "Sell" : "Hold"}
                    </span>
                    {t.status && t.status !== "hold" && (
                      <span className="text-[10px] text-muted-foreground">{t.status}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                {t.side !== "hold" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {t.qty} shares{t.price ? ` · $${Number(t.price).toFixed(2)}` : ""}
                  </p>
                )}
                {t.reason && (
                  <p className="text-xs text-muted-foreground/70 mt-1.5 leading-relaxed">{t.reason}</p>
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
