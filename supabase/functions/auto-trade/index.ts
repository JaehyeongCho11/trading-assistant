import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getQuote(symbol: string) {
  const key = Deno.env.get("ALPACA_API_KEY")!;
  const secret = Deno.env.get("ALPACA_SECRET_KEY")!;
  const res = await fetch(
    `https://data.alpaca.markets/v2/stocks/${symbol}/quotes/latest`,
    { headers: { "APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret } }
  );
  return res.json();
}

async function getPrice(symbol: string): Promise<number> {
  const q = await getQuote(symbol);
  return parseFloat(q?.quote?.ap || q?.quote?.bp || "0");
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

    // Get ALL active trading profiles (all users)
    const { data: profiles } = await supabase
      .from("trading_profiles")
      .select("*")
      .eq("auto_trade_enabled", true);

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: "No active trading profiles" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const profile of profiles) {
      if (!profile.user_id) continue;

      // Check interval
      const intervalMinutes = profile.trade_interval_minutes || 5;
      const { data: lastTrade } = await supabase
        .from("trade_history")
        .select("created_at")
        .eq("user_id", profile.user_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (lastTrade) {
        const elapsed = (Date.now() - new Date(lastTrade.created_at).getTime()) / 60000;
        if (elapsed < intervalMinutes) {
          results.push({ user_id: profile.user_id, skipped: true, elapsed: elapsed.toFixed(1) });
          continue;
        }
      }

      // Get user's virtual account & positions
      const [{ data: account }, { data: positions }] = await Promise.all([
        supabase.from("user_accounts").select("*").eq("user_id", profile.user_id).single(),
        supabase.from("user_positions").select("*").eq("user_id", profile.user_id),
      ]);

      if (!account) continue;

      const balance = parseFloat(account.balance);
      const userPositions = positions || [];

      // Get quotes for popular symbols + held positions
      const heldSymbols = userPositions.map((p: any) => p.symbol);
      const defaultSymbols = ["SPY", "QQQ", "AAPL", "TSLA", "NVDA", "MSFT"];
      const allSymbols = [...new Set([...defaultSymbols, ...heldSymbols])];
      
      const quotes: Record<string, number> = {};
      for (const sym of allSymbols) {
        try { quotes[sym] = await getPrice(sym); } catch { /* skip */ }
      }

      // Ask AI
      const positionsStr = userPositions.length > 0
        ? userPositions.map((p: any) => {
            const price = quotes[p.symbol] || parseFloat(p.avg_entry_price);
            const pl = (price - parseFloat(p.avg_entry_price)) * parseFloat(p.qty);
            return `- ${p.symbol}: ${p.qty} shares @ $${parseFloat(p.avg_entry_price).toFixed(2)}, Current: $${price.toFixed(2)}, P&L: $${pl.toFixed(2)}`;
          }).join("\n")
        : "No open positions";

      const aiPrompt = `You are an autonomous AI trading assistant managing a virtual paper trading account.

## Account
- Cash Balance: $${balance.toFixed(2)}
- Max Trade Amount: $${profile.max_trade_amount}

## Current Positions
${positionsStr}

## Market Quotes
${Object.entries(quotes).map(([sym, price]) => `- ${sym}: $${price.toFixed(2)}`).join("\n")}

## User Profile
${JSON.stringify(profile.survey_answers || {})}

## Strategy
${profile.strategy_prompt}

## Rules
- You can buy if cash balance allows it
- You can sell only shares you hold
- Be conservative and risk-aware
- Consider the user's risk tolerance

Respond with JSON only:
{"action": "buy"|"sell"|"hold", "symbol": "TICKER", "qty": number, "reason": "brief explanation in English"}`;

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
        console.error("AI error for user", profile.user_id, await aiResponse.text());
        continue;
      }

      const aiData = await aiResponse.json();
      let content = aiData.choices?.[0]?.message?.content || "";
      content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      let decision;
      try { decision = JSON.parse(content); } catch {
        decision = { action: "hold", reason: "Failed to parse AI response" };
      }

      console.log(`User ${profile.user_id} decision:`, decision);

      // Execute virtual trade
      let tradePrice = 0;
      if (decision.action !== "hold" && decision.symbol && decision.qty > 0) {
        tradePrice = quotes[decision.symbol] || await getPrice(decision.symbol);
        const totalCost = tradePrice * decision.qty;

        if (decision.action === "buy") {
          if (totalCost > balance) {
            decision.action = "hold";
            decision.reason = "Insufficient balance for this trade";
          } else {
            // Deduct balance
            await supabase.from("user_accounts").update({
              balance: balance - totalCost,
            }).eq("user_id", profile.user_id);

            // Upsert position
            const existing = userPositions.find((p: any) => p.symbol === decision.symbol);
            if (existing) {
              const oldQty = parseFloat(existing.qty);
              const oldAvg = parseFloat(existing.avg_entry_price);
              const newQty = oldQty + decision.qty;
              const newAvg = (oldAvg * oldQty + tradePrice * decision.qty) / newQty;
              await supabase.from("user_positions").update({
                qty: newQty, avg_entry_price: newAvg,
              }).eq("user_id", profile.user_id).eq("symbol", decision.symbol);
            } else {
              await supabase.from("user_positions").insert({
                user_id: profile.user_id, symbol: decision.symbol,
                qty: decision.qty, avg_entry_price: tradePrice,
              });
            }
          }
        } else if (decision.action === "sell") {
          const existing = userPositions.find((p: any) => p.symbol === decision.symbol);
          if (!existing || parseFloat(existing.qty) < decision.qty) {
            decision.action = "hold";
            decision.reason = "Insufficient shares to sell";
          } else {
            const newQty = parseFloat(existing.qty) - decision.qty;
            // Add proceeds to balance
            await supabase.from("user_accounts").update({
              balance: balance + totalCost,
            }).eq("user_id", profile.user_id);

            if (newQty <= 0) {
              await supabase.from("user_positions").delete()
                .eq("user_id", profile.user_id).eq("symbol", decision.symbol);
            } else {
              await supabase.from("user_positions").update({ qty: newQty })
                .eq("user_id", profile.user_id).eq("symbol", decision.symbol);
            }
          }
        }
      }

      // Log trade
      await supabase.from("trade_history").insert({
        user_id: profile.user_id,
        profile_id: profile.id,
        symbol: decision.symbol || "N/A",
        side: decision.action,
        qty: decision.qty || 0,
        price: tradePrice || null,
        reason: decision.reason,
        status: decision.action === "hold" ? "hold" : "filled",
      });

      results.push({ user_id: profile.user_id, decision });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("auto-trade error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
