import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, CandlestickSeries, type IChartApi, type ISeriesApi } from "lightweight-charts";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

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

function generateMockData(seed: string) {
  const data = [];
  // Use symbol as seed for consistent but different data per symbol
  let basePrice = 50 + (seed.charCodeAt(0) + seed.charCodeAt(seed.length - 1)) * 1.5;
  const volatility = seed.length * 0.3 + 1;
  const now = new Date();
  for (let i = 90; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    basePrice += (Math.random() - 0.48) * volatility;
    data.push({
      time: date.toISOString().split("T")[0],
      open: basePrice - Math.random() * (volatility * 0.5),
      high: basePrice + Math.random() * (volatility * 0.8),
      low: basePrice - Math.random() * (volatility * 0.8),
      close: basePrice,
    });
  }
  return data;
}

const StockChart = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [selected, setSelected] = useState(POPULAR_SYMBOLS[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "hsl(215, 12%, 50%)",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "hsl(220, 14%, 10%)" },
        horzLines: { color: "hsl(220, 14%, 10%)" },
      },
      width: containerRef.current.clientWidth,
      height: 180,
      timeScale: { borderColor: "hsl(220, 14%, 14%)", timeVisible: false },
      rightPriceScale: { borderColor: "hsl(220, 14%, 14%)" },
      crosshair: {
        vertLine: { color: "hsl(142, 60%, 50%)", width: 1, style: 3 },
        horzLine: { color: "hsl(142, 60%, 50%)", width: 1, style: 3 },
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "hsl(142, 60%, 50%)",
      downColor: "hsl(0, 72%, 51%)",
      borderDownColor: "hsl(0, 72%, 51%)",
      borderUpColor: "hsl(142, 60%, 50%)",
      wickDownColor: "hsl(0, 72%, 45%)",
      wickUpColor: "hsl(142, 60%, 45%)",
    });

    chartRef.current = chart;
    seriesRef.current = series as any;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  // Update data when symbol changes
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;
    seriesRef.current.setData(generateMockData(selected.symbol) as any);
    chartRef.current.timeScale().fitContent();
  }, [selected]);

  const filtered = POPULAR_SYMBOLS.filter(
    (s) =>
      s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="glass border-b border-border/50 px-4 py-3">
      {/* Symbol selector */}
      <div className="flex items-center gap-2 mb-2 px-1">
        {/* Search / select */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/60 hover:bg-secondary/80 transition-colors"
          >
            <span className="text-xs font-mono text-primary font-semibold">{selected.symbol}</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">{selected.name}</span>
            <Search className="w-3 h-3 text-muted-foreground" />
          </button>

          {showDropdown && (
            <div className="absolute top-full left-0 mt-1 w-64 glass rounded-xl border border-border/50 p-2 z-50 shadow-xl">
              <Input
                autoFocus
                placeholder="종목 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-xs bg-secondary/50 border-border/50 mb-2"
              />
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {filtered.map((s) => (
                  <button
                    key={s.symbol}
                    onClick={() => {
                      setSelected(s);
                      setShowDropdown(false);
                      setSearchQuery("");
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between ${
                      selected.symbol === s.symbol
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-secondary/60 text-foreground"
                    }`}
                  >
                    <span className="font-mono font-semibold">{s.symbol}</span>
                    <span className="text-muted-foreground">{s.name}</span>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">결과 없음</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quick chips */}
        <div className="flex-1 flex gap-1.5 overflow-x-auto scrollbar-none">
          {POPULAR_SYMBOLS.slice(0, 6).map((s) => (
            <button
              key={s.symbol}
              onClick={() => setSelected(s)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-mono whitespace-nowrap transition-colors ${
                selected.symbol === s.symbol
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}
            >
              {s.symbol}
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} />

      {/* Close dropdown on outside click */}
      {showDropdown && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowDropdown(false); setSearchQuery(""); }} />
      )}
    </div>
  );
};

export default StockChart;
