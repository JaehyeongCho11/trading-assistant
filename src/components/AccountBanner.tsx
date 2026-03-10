import { useEffect, useState } from "react";
import { Wallet, TrendingUp, TrendingDown, Loader2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Position = {
  symbol: string;
  qty: number;
  avg_entry_price: number;
};

const MARKET_DATA_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/market-data`;

const AccountBanner = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [initialBalance, setInitialBalance] = useState(0);
  const [positions, setPositions] = useState<Position[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch account & positions from DB
      const [{ data: account }, { data: posData }] = await Promise.all([
        supabase.from("user_accounts").select("*").eq("user_id", user.id).single(),
        supabase.from("user_positions").select("*").eq("user_id", user.id),
      ]);

      if (account) {
        setBalance(Number(account.balance));
        setInitialBalance(Number(account.initial_balance));
      }
      const pos = (posData || []).filter((p: any) => Number(p.qty) > 0);
      setPositions(pos.map((p: any) => ({ symbol: p.symbol, qty: Number(p.qty), avg_entry_price: Number(p.avg_entry_price) })));

      // Fetch current prices for held positions
      if (pos.length > 0) {
        const symbols = pos.map((p: any) => p.symbol).join(",");
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
      }
    } catch (err) { console.error("Failed to fetch account:", err); }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [user]);

  if (loading && balance === 0) {
    return (
      <div className="border-b border-border/40 px-4 py-3 flex items-center justify-center bg-card/40">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const positionsValue = positions.reduce((sum, p) => sum + p.qty * (prices[p.symbol] || p.avg_entry_price), 0);
  const totalEquity = balance + positionsValue;
  const totalPL = totalEquity - initialBalance;
  const totalPLPct = initialBalance > 0 ? ((totalPL / initialBalance) * 100).toFixed(2) : "0.00";
  const isPositive = totalPL >= 0;

  return (
    <div className="border-b border-border/40 bg-card/40">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-primary" />
          </div>
          <div className="text-left">
            <p className="text-[10px] text-muted-foreground leading-none mb-0.5 font-medium">Total Equity</p>
            <p className="text-sm font-mono font-bold text-foreground">
              ${totalEquity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/40">
          {isPositive ? (
            <TrendingUp className="w-3 h-3 text-chart-up" />
          ) : (
            <TrendingDown className="w-3 h-3 text-chart-down" />
          )}
          <span className={`text-xs font-mono font-semibold ${isPositive ? "text-chart-up" : "text-chart-down"}`}>
            {isPositive ? "+" : ""}${totalPL.toFixed(2)} ({isPositive ? "+" : ""}{totalPLPct}%)
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-5 ml-auto">
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground leading-none mb-0.5 font-medium">Cash</p>
            <p className="text-xs font-mono font-semibold text-foreground">
              ${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground leading-none mb-0.5 font-medium">Positions</p>
            <p className="text-xs font-mono font-semibold text-foreground">
              ${positionsValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto sm:ml-0">
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
          <RefreshCw
            className={`w-3 h-3 text-muted-foreground ${loading ? "animate-spin" : ""}`}
            onClick={(e) => { e.stopPropagation(); fetchData(); }}
          />
        </div>
      </button>

      {expanded && positions.length > 0 && (
        <div className="px-4 pb-3 pt-1 border-t border-border/30">
          <p className="text-[10px] text-muted-foreground mb-2 font-semibold uppercase tracking-wider">Positions</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {positions.map((pos) => {
              const currentPrice = prices[pos.symbol] || pos.avg_entry_price;
              const pl = (currentPrice - pos.avg_entry_price) * pos.qty;
              const plPct = pos.avg_entry_price > 0 ? ((currentPrice / pos.avg_entry_price - 1) * 100).toFixed(2) : "0.00";
              const plPositive = pl >= 0;
              return (
                <div key={pos.symbol} className="px-3 py-2 rounded-lg bg-muted/30 border border-border/30">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono font-bold text-foreground">{pos.symbol}</span>
                    <span className="text-[10px] text-muted-foreground">{pos.qty} shares</span>
                  </div>
                  <p className="text-xs font-mono text-foreground">${currentPrice.toFixed(2)}</p>
                  <p className={`text-[10px] font-mono font-medium ${plPositive ? "text-chart-up" : "text-chart-down"}`}>
                    {plPositive ? "+" : ""}${pl.toFixed(2)} ({plPositive ? "+" : ""}{plPct}%)
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {expanded && positions.length === 0 && (
        <div className="px-4 pb-3 pt-1 border-t border-border/30">
          <p className="text-xs text-muted-foreground text-center py-2">No positions held</p>
        </div>
      )}
    </div>
  );
};

export default AccountBanner;
