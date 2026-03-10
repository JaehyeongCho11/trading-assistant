import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Pause, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const MARKET_DATA_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/market-data`;

type Trade = {
  id: string; symbol: string; side: string; qty: number;
  price: number | null; order_id: string | null;
  reason: string | null; status: string | null; created_at: string;
};

type PositionInfo = {
  symbol: string; qty: string; market_value: string;
  unrealized_pl: string; unrealized_plpc: string;
  current_price: string; avg_entry_price: string;
};

const TradeHistory = () => {
  const navigate = useNavigate();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "buy" | "sell" | "hold">("all");
  const [positions, setPositions] = useState<PositionInfo[]>([]);
  const [accountData, setAccountData] = useState<{ equity: string; daily_change: string; daily_change_pct: string } | null>(null);

  const loadTrades = async () => {
    setLoading(true);
    let query = supabase.from("trade_history").select("*").order("created_at", { ascending: false }).limit(100);
    if (filter !== "all") query = query.eq("side", filter);
    const { data } = await query;
    setTrades((data as Trade[]) || []);
    setLoading(false);
  };

  const loadAccount = async () => {
    try {
      const res = await fetch(`${MARKET_DATA_URL}?type=account`, {
        headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      });
      const json = await res.json();
      if (!json.error) {
        setAccountData({ equity: json.equity, daily_change: json.daily_change, daily_change_pct: json.daily_change_pct });
        setPositions(json.positions || []);
      }
    } catch (err) { console.error("Failed to fetch account:", err); }
  };

  useEffect(() => { loadTrades(); }, [filter]);
  useEffect(() => { loadAccount(); }, []);

  const totalUnrealizedPL = positions.reduce((sum, p) => sum + parseFloat(p.unrealized_pl || "0"), 0);
  const totalMarketValue = positions.reduce((sum, p) => sum + parseFloat(p.market_value || "0"), 0);
  const totalReturnPct = totalMarketValue > 0
    ? ((totalUnrealizedPL / (totalMarketValue - totalUnrealizedPL)) * 100).toFixed(2) : "0.00";

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
            {accountData && (
              <div className="flex items-center gap-1 mb-3">
                <span className="text-[10px] text-muted-foreground font-medium">Today:</span>
                <span className={`text-xs font-mono font-semibold ${parseFloat(accountData.daily_change) >= 0 ? "text-chart-up" : "text-chart-down"}`}>
                  {parseFloat(accountData.daily_change) >= 0 ? "+" : ""}{accountData.daily_change} ({parseFloat(accountData.daily_change) >= 0 ? "+" : ""}{accountData.daily_change_pct}%)
                </span>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {positions.map((pos) => {
                const pl = parseFloat(pos.unrealized_pl);
                const plPct = (parseFloat(pos.unrealized_plpc) * 100).toFixed(2);
                const isPositive = pl >= 0;
                return (
                  <div key={pos.symbol} className="px-3 py-2 rounded-lg bg-muted/30 border border-border/30">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-mono font-bold text-foreground">{pos.symbol}</span>
                      <span className="text-[10px] text-muted-foreground">{pos.qty}주</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      ${parseFloat(pos.avg_entry_price).toFixed(2)} → ${parseFloat(pos.current_price).toFixed(2)}
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
          { label: "전체", value: stats.total, color: "text-foreground" },
          { label: "매수", value: stats.buys, color: "text-chart-up" },
          { label: "매도", value: stats.sells, color: "text-chart-down" },
          { label: "보류", value: stats.holds, color: "text-muted-foreground" },
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
            {f === "all" ? "전체" : f === "buy" ? "매수" : f === "sell" ? "매도" : "보류"}
          </button>
        ))}
      </div>

      {/* Trade list */}
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-2 pb-4">
          {trades.length === 0 && !loading && (
            <div className="text-center py-12 text-muted-foreground text-sm">거래 내역이 없습니다</div>
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
                    {new Date(t.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                {t.side !== "hold" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {t.qty}주{t.price ? ` · $${Number(t.price).toFixed(2)}` : ""}
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
