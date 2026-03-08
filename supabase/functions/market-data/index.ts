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
