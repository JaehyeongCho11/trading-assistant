import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, CandlestickSeries, type IChartApi, type ISeriesApi } from "lightweight-charts";
import { Input } from "@/components/ui/input";
import { Search, Loader2, ChevronDown } from "lucide-react";

const POPULAR_SYMBOLS = [
  { symbol: "SPY", name: "S&P 500 ETF" },
  { symbol: "QQQ", name: "Nasdaq 100 ETF" },
  { symbol: "AAPL", name: "Apple" },
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "NVDA", name: "Nvidia" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "GOOGL", name: "Alphabet" },
];

const MARKET_DATA_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/market-data`;

type BarData = { time: string; open: number; high: number; low: number; close: number };

const StockChart = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [selected, setSelected] = useState(POPULAR_SYMBOLS[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<{ ask: number; bid: number } | null>(null);
  const [lastClose, setLastClose] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      localization: { locale: 'en-US' },
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "hsl(220, 10%, 45%)",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "hsl(220, 14%, 12%)" },
        horzLines: { color: "hsl(220, 14%, 12%)" },
      },
      width: containerRef.current.clientWidth,
      height: 180,
      timeScale: { borderColor: "hsl(220, 14%, 14%)", timeVisible: false },
      rightPriceScale: { borderColor: "hsl(220, 14%, 14%)" },
      crosshair: {
        vertLine: { color: "hsl(217, 91%, 60%)", width: 1, style: 3 },
        horzLine: { color: "hsl(217, 91%, 60%)", width: 1, style: 3 },
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "hsl(152, 69%, 50%)",
      downColor: "hsl(0, 72%, 55%)",
      borderDownColor: "hsl(0, 72%, 55%)",
      borderUpColor: "hsl(152, 69%, 50%)",
      wickDownColor: "hsl(0, 72%, 45%)",
      wickUpColor: "hsl(152, 69%, 45%)",
    });

    chartRef.current = chart;
    seriesRef.current = series as any;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);
    return () => { window.removeEventListener("resize", handleResize); chart.remove(); };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${MARKET_DATA_URL}?symbol=${selected.symbol}`, {
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        });
        const data = await res.json();
        if (data.bars && data.bars.length > 0) {
          seriesRef.current!.setData(data.bars as BarData[]);
          chartRef.current!.timeScale().fitContent();
          setLastClose(data.bars[data.bars.length - 1].close);
        }
        if (data.quote) setQuote(data.quote);
      } catch (err) { console.error("Failed to fetch market data:", err); }
      setLoading(false);
    };
    fetchData();
  }, [selected]);

  const filtered = POPULAR_SYMBOLS.filter(
    (s) =>
      s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="border-b border-border/40 px-4 py-3 bg-card/40">
      {/* Symbol selector */}
      <div className="flex items-center gap-3 mb-2 px-1">
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/60 hover:bg-muted transition-colors"
          >
            <span className="text-xs font-mono text-primary font-semibold">{selected.symbol}</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">{selected.name}</span>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>

          {showDropdown && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-card rounded-xl border border-border p-2 z-50 shadow-lg">
              <Input
                autoFocus
                placeholder="Search symbol..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-xs mb-2"
              />
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {filtered.map((s) => (
                  <button
                    key={s.symbol}
                    onClick={() => { setSelected(s); setShowDropdown(false); setSearchQuery(""); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between ${
                      selected.symbol === s.symbol
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <span className="font-mono font-semibold">{s.symbol}</span>
                    <span className="text-muted-foreground">{s.name}</span>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">No results</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 ml-1">
          {loading ? (
            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
          ) : (
            <>
              {lastClose && (
                <span className="text-sm font-mono font-bold text-foreground">
                  ${lastClose.toFixed(2)}
                </span>
              )}
              {quote && (
                <span className="text-[10px] font-mono text-muted-foreground">
                  B: ${quote.bid?.toFixed(2)} · A: ${quote.ask?.toFixed(2)}
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex-1 flex gap-1.5 overflow-x-auto scrollbar-none justify-end">
          {POPULAR_SYMBOLS.slice(0, 6).map((s) => (
            <button
              key={s.symbol}
              onClick={() => setSelected(s)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-mono whitespace-nowrap transition-all ${
                selected.symbol === s.symbol
                  ? "bg-primary/15 text-primary border border-primary/25 font-semibold"
                  : "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/70"
              }`}
            >
              {s.symbol}
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="rounded-lg overflow-hidden" />

      {showDropdown && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowDropdown(false); setSearchQuery(""); }} />
      )}
    </div>
  );
};

export default StockChart;
