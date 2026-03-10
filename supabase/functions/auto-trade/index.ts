import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALPACA_BASE = "https://paper-api.alpaca.markets";

async function alpacaRequest(path: string, method = "GET", body?: unknown) {
  const key = Deno.env.get("ALPACA_API_KEY");
  const secret = Deno.env.get("ALPACA_SECRET_KEY");
  if (!key || !secret) throw new Error("Alpaca API keys not configured");

  const res = await fetch(`${ALPACA_BASE}${path}`, {
    method,
    headers: {
      "APCA-API-KEY-ID": key,
      "APCA-API-SECRET-KEY": secret,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return res.json();
}

async function getQuote(symbol: string) {
  const key = Deno.env.get("ALPACA_API_KEY")!;
  const secret = Deno.env.get("ALPACA_SECRET_KEY")!;
  const res = await fetch(
    `https://data.alpaca.markets/v2/stocks/${symbol}/quotes/latest`,
    {
      headers: {
        "APCA-API-KEY-ID": key,
        "APCA-API-SECRET-KEY": secret,
      },
    }
  );
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get active trading profile
    const { data: profile } = await supabase
      .from("trading_profiles")
      .select("*")
      .eq("profile_key", "default")
      .eq("auto_trade_enabled", true)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ message: "No active trading profile" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get current account & positions
    const [account, positions] = await Promise.all([
      alpacaRequest("/v2/account"),
      alpacaRequest("/v2/positions"),
    ]);

    // Get quotes for popular symbols
    const symbols = ["SPY", "QQQ", "AAPL", "TSLA", "NVDA", "MSFT"];
    const quotes: Record<string, unknown> = {};
    for (const sym of symbols) {
      try {
        quotes[sym] = await getQuote(sym);
      } catch { /* skip */ }
    }

    // Ask AI for trading decision
    const aiPrompt = `You are an autonomous AI trading assistant managing an Alpaca Paper Trading account.

## Current Account
- Cash: $${account.cash}
- Portfolio Value: $${account.portfolio_value}
- Buying Power: $${account.buying_power}

## Current Positions
${positions.length > 0
  ? positions.map((p: any) => `- ${p.symbol}: ${p.qty} shares, P&L: $${p.unrealized_pl} (${p.unrealized_plpc}%)`).join("\n")
  : "No open positions"}

## Latest Quotes
${Object.entries(quotes).map(([sym, q]: [string, any]) => `- ${sym}: Ask $${q?.quote?.ap || "N/A"}, Bid $${q?.quote?.bp || "N/A"}`).join("\n")}

## User Profile
${JSON.stringify(profile.survey_answers || {})}

## Strategy
${profile.strategy_prompt}

## Rules
- Max trade amount: $${profile.max_trade_amount}
- Only trade during market hours
- Be conservative and risk-aware
- Consider the user's risk tolerance from their profile

Based on current market data and the user's profile, decide what action to take.
Respond with a JSON object:
{
  "action": "buy" | "sell" | "hold",
  "symbol": "TICKER",
  "qty": number,
  "reason": "brief explanation in English",
  "order_type": "market" | "limit",
  "limit_price": number (optional, for limit orders)
}

If no trade is needed, respond with: {"action": "hold", "reason": "explanation in English"}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a trading AI. Always respond with valid JSON only." },
          { role: "user", content: aiPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || "";
    
    // Strip markdown code fences if present
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    let decision;
    try {
      decision = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI decision:", content);
      decision = { action: "hold", reason: "Failed to parse AI response" };
    }

    console.log("AI Trading Decision:", decision);

    // Execute trade if not hold
    let orderResult = null;
    if (decision.action !== "hold" && decision.symbol && decision.qty > 0) {
      const order: Record<string, unknown> = {
        symbol: decision.symbol,
        qty: decision.qty,
        side: decision.action,
        type: decision.order_type || "market",
        time_in_force: "day",
      };
      if (decision.order_type === "limit" && decision.limit_price) {
        order.limit_price = decision.limit_price;
      }

      orderResult = await alpacaRequest("/v2/orders", "POST", order);
      console.log("Order result:", orderResult);
    }

    // Log to trade_history
    await supabase.from("trade_history").insert({
      profile_id: profile.id,
      symbol: decision.symbol || "N/A",
      side: decision.action,
      qty: decision.qty || 0,
      price: decision.limit_price || null,
      order_id: orderResult?.id || null,
      reason: decision.reason,
      status: decision.action === "hold" ? "hold" : orderResult?.status || "error",
    });

    return new Response(
      JSON.stringify({
        decision,
        order: orderResult,
        account_value: account.portfolio_value,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("auto-trade error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
