import { useEffect, useState } from "react";
import { Wallet, TrendingUp, TrendingDown, DollarSign, Loader2, RefreshCw } from "lucide-react";

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
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });
      const json = await res.json();
      if (!json.error) setData(json);
    } catch (err) {
      console.error("Failed to fetch account:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAccount();
    const interval = setInterval(fetchAccount, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="glass border-b border-border/50 px-4 py-2.5 flex items-center justify-center">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const change = parseFloat(data.daily_change);
  const isPositive = change >= 0;

  return (
    <div className="glass border-b border-border/50">
      {/* Main account row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2.5 flex items-center gap-4 hover:bg-secondary/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
            <Wallet className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="text-left">
            <p className="text-[10px] text-muted-foreground leading-none mb-0.5">Total Equity</p>
            <p className="text-sm font-mono font-semibold text-foreground">
              ${parseFloat(data.equity).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isPositive ? (
            <TrendingUp className="w-3 h-3 text-primary" />
          ) : (
            <TrendingDown className="w-3 h-3 text-destructive" />
          )}
          <span className={`text-xs font-mono font-medium ${isPositive ? "text-primary" : "text-destructive"}`}>
            {isPositive ? "+" : ""}{data.daily_change} ({isPositive ? "+" : ""}{data.daily_change_pct}%)
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-4 ml-auto">
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground leading-none mb-0.5">Cash</p>
            <p className="text-xs font-mono text-foreground">
              ${parseFloat(data.cash).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground leading-none mb-0.5">Buying Power</p>
            <p className="text-xs font-mono text-foreground">
              ${parseFloat(data.buying_power).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <RefreshCw
          className={`w-3 h-3 text-muted-foreground ml-auto sm:ml-0 ${loading ? "animate-spin" : ""}`}
          onClick={(e) => { e.stopPropagation(); fetchAccount(); }}
        />
      </button>

      {/* Expanded positions */}
      {expanded && data.positions.length > 0 && (
        <div className="px-4 pb-3 pt-1 border-t border-border/30">
          <p className="text-[10px] text-muted-foreground mb-2 font-medium">Positions</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {data.positions.map((pos) => {
              const pl = parseFloat(pos.unrealized_pl);
              const plPositive = pl >= 0;
              return (
                <div
                  key={pos.symbol}
                  className="px-3 py-2 rounded-lg bg-secondary/30 border border-border/30"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono font-semibold text-foreground">{pos.symbol}</span>
                    <span className="text-[10px] text-muted-foreground">{pos.qty} shares</span>
                  </div>
                  <p className="text-xs font-mono text-foreground">${parseFloat(pos.current_price).toFixed(2)}</p>
                  <p className={`text-[10px] font-mono ${plPositive ? "text-primary" : "text-destructive"}`}>
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
          <p className="text-xs text-muted-foreground text-center py-2">보유 종목이 없습니다</p>
        </div>
      )}
    </div>
  );
};

export default AccountBanner;
