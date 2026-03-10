import { useEffect, useState } from "react";
import { Wallet, TrendingUp, TrendingDown, Loader2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

const MARKET_DATA_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/market-data`;

type AccountData = {
  equity: string;
  cash: string;
  buying_power: string;
  portfolio_value: string;
  daily_change: string;
  daily_change_pct: string;
  positions: {
    symbol: string;
    qty: string;
    market_value: string;
    unrealized_pl: string;
    unrealized_plpc: string;
    current_price: string;
  }[];
};

const AccountBanner = () => {
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchAccount = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${MARKET_DATA_URL}?type=account`, {
        headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      });
      const json = await res.json();
      if (!json.error) setData(json);
    } catch (err) { console.error("Failed to fetch account:", err); }
    setLoading(false);
  };

  useEffect(() => {
    fetchAccount();
    const interval = setInterval(fetchAccount, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="border-b border-border/40 px-4 py-3 flex items-center justify-center bg-card/40">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const change = parseFloat(data.daily_change);
  const isPositive = change >= 0;

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
              ${parseFloat(data.equity).toLocaleString("en-US", { minimumFractionDigits: 2 })}
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
            {isPositive ? "+" : ""}{data.daily_change} ({isPositive ? "+" : ""}{data.daily_change_pct}%)
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-5 ml-auto">
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground leading-none mb-0.5 font-medium">Cash</p>
            <p className="text-xs font-mono font-semibold text-foreground">
              ${parseFloat(data.cash).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground leading-none mb-0.5 font-medium">Buying Power</p>
            <p className="text-xs font-mono font-semibold text-foreground">
              ${parseFloat(data.buying_power).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto sm:ml-0">
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
          <RefreshCw
            className={`w-3 h-3 text-muted-foreground ${loading ? "animate-spin" : ""}`}
            onClick={(e) => { e.stopPropagation(); fetchAccount(); }}
          />
        </div>
      </button>

      {expanded && data.positions.length > 0 && (
        <div className="px-4 pb-3 pt-1 border-t border-border/30">
          <p className="text-[10px] text-muted-foreground mb-2 font-semibold uppercase tracking-wider">Positions</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {data.positions.map((pos) => {
              const pl = parseFloat(pos.unrealized_pl);
              const plPositive = pl >= 0;
              return (
                <div key={pos.symbol} className="px-3 py-2 rounded-lg bg-muted/30 border border-border/30">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono font-bold text-foreground">{pos.symbol}</span>
                    <span className="text-[10px] text-muted-foreground">{pos.qty} shares</span>
                  </div>
                  <p className="text-xs font-mono text-foreground">${parseFloat(pos.current_price).toFixed(2)}</p>
                  <p className={`text-[10px] font-mono font-medium ${plPositive ? "text-chart-up" : "text-chart-down"}`}>
                    {plPositive ? "+" : ""}{parseFloat(pos.unrealized_pl).toFixed(2)} ({plPositive ? "+" : ""}{pos.unrealized_plpc}%)
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {expanded && data.positions.length === 0 && (
        <div className="px-4 pb-3 pt-1 border-t border-border/30">
          <p className="text-xs text-muted-foreground text-center py-2">No positions held</p>
        </div>
      )}
    </div>
  );
};

export default AccountBanner;
