import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const key = Deno.env.get("ALPACA_API_KEY");
    const secret = Deno.env.get("ALPACA_SECRET_KEY");
    if (!key || !secret) throw new Error("Alpaca API keys not configured");

    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "bars";

    // Account info endpoint
    if (type === "account") {
      const accRes = await fetch("https://paper-api.alpaca.markets/v2/account", {
        headers: { "APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret },
      });
      if (!accRes.ok) throw new Error(`Alpaca account error: ${accRes.status}`);
      const acc = await accRes.json();

      // Also get positions
      const posRes = await fetch("https://paper-api.alpaca.markets/v2/positions", {
        headers: { "APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret },
      });
      const positions = posRes.ok ? await posRes.json() : [];

      return new Response(
        JSON.stringify({
          equity: acc.equity,
          cash: acc.cash,
          buying_power: acc.buying_power,
          portfolio_value: acc.portfolio_value,
          last_equity: acc.last_equity,
          daily_change: (parseFloat(acc.equity) - parseFloat(acc.last_equity)).toFixed(2),
          daily_change_pct: (((parseFloat(acc.equity) - parseFloat(acc.last_equity)) / parseFloat(acc.last_equity)) * 100).toFixed(2),
          positions: positions.map((p: any) => ({
            symbol: p.symbol,
            qty: p.qty,
            market_value: p.market_value,
            unrealized_pl: p.unrealized_pl,
            unrealized_plpc: (parseFloat(p.unrealized_plpc) * 100).toFixed(2),
            current_price: p.current_price,
          })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const symbol = url.searchParams.get("symbol") || "SPY";
    const timeframe = url.searchParams.get("timeframe") || "1Day";

    // Get bars for last 90 days
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 120);

    const apiUrl = `https://data.alpaca.markets/v2/stocks/${symbol}/bars?timeframe=${timeframe}&start=${start.toISOString()}&end=${end.toISOString()}&limit=100&adjustment=raw&feed=iex`;

    const res = await fetch(apiUrl, {
      headers: {
        "APCA-API-KEY-ID": key,
        "APCA-API-SECRET-KEY": secret,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Alpaca bars error:", res.status, errText);
      throw new Error(`Alpaca API error: ${res.status}`);
    }

    const data = await res.json();

    // Transform to lightweight-charts format
    const bars = (data.bars || []).map((bar: any) => ({
      time: bar.t.split("T")[0],
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
    }));

    // Also get latest quote
    const quoteRes = await fetch(
      `https://data.alpaca.markets/v2/stocks/${symbol}/quotes/latest?feed=iex`,
      {
        headers: {
          "APCA-API-KEY-ID": key,
          "APCA-API-SECRET-KEY": secret,
        },
      }
    );
    const quoteData = quoteRes.ok ? await quoteRes.json() : null;

    return new Response(
      JSON.stringify({
        symbol,
        bars,
        quote: quoteData?.quote
          ? { ask: quoteData.quote.ap, bid: quoteData.quote.bp }
          : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("market-data error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
