import { useEffect, useRef } from "react";
import { createChart, ColorType, CandlestickSeries, type IChartApi } from "lightweight-charts";

function generateMockData() {
  const data = [];
  let basePrice = 180;
  const now = new Date();
  for (let i = 90; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    basePrice += (Math.random() - 0.48) * 4;
    data.push({
      time: date.toISOString().split("T")[0],
      open: basePrice - Math.random() * 2,
      high: basePrice + Math.random() * 3,
      low: basePrice - Math.random() * 3,
      close: basePrice,
    });
  }
  return data;
}

const StockChart = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

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
      timeScale: {
        borderColor: "hsl(220, 14%, 14%)",
        timeVisible: false,
      },
      rightPriceScale: {
        borderColor: "hsl(220, 14%, 14%)",
      },
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

    series.setData(generateMockData() as any);
    chart.timeScale().fitContent();
    chartRef.current = chart;

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

  return (
    <div className="glass border-b border-border/50 px-4 py-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-primary font-semibold">SPY</span>
          <span className="text-xs text-muted-foreground">S&P 500 ETF</span>
        </div>
        <span className="text-xs font-mono text-muted-foreground">실시간 차트</span>
      </div>
      <div ref={containerRef} />
    </div>
  );
};

export default StockChart;
