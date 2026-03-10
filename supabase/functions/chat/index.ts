import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadKnowledge } from "./knowledge.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function getPrice(symbol: string): Promise<number> {
  const key = Deno.env.get("ALPACA_API_KEY")!;
  const secret = Deno.env.get("ALPACA_SECRET_KEY")!;
  const res = await fetch(
    `https://data.alpaca.markets/v2/stocks/${symbol}/quotes/latest`,
    { headers: { "APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret } }
  );
  const q = await res.json();
  return parseFloat(q?.quote?.ap || q?.quote?.bp || "0");
}

const tools = [
  {
    type: "function",
    function: {
      name: "get_account",
      description: "Get the user's virtual trading account info (balance, positions, total equity)",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_positions",
      description: "Get all current open positions in the user's virtual portfolio",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "place_order",
      description: "Place a virtual stock order (buy or sell) using the user's virtual balance",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Stock ticker symbol (e.g., AAPL)" },
          qty: { type: "number", description: "Number of shares" },
          side: { type: "string", enum: ["buy", "sell"], description: "Buy or sell" },
        },
        required: ["symbol", "qty", "side"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_quote",
      description: "Get latest quote/price for a stock",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Stock ticker symbol" },
        },
        required: ["symbol"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_trade_history",
      description: "Get user's recent trade history",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Number of records to fetch (default 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_profile",
      description: "Update the user's trading profile when they express a change in strategy, risk tolerance, trading preferences, or trading interval.",
      parameters: {
        type: "object",
        properties: {
          strategy_prompt: { type: "string", description: "Updated trading strategy description" },
          max_trade_amount: { type: "number", description: "Updated maximum trade amount in USD" },
          auto_trade_enabled: { type: "boolean", description: "Whether auto-trading should be enabled/disabled" },
          trade_interval_minutes: { type: "number", description: "Auto-trading interval in minutes" },
        },
        required: ["strategy_prompt"],
      },
    },
  },
];

async function executeTool(name: string, args: Record<string, unknown>, userId: string) {
  const sb = getSupabase();

  switch (name) {
    case "get_account": {
      const [{ data: account }, { data: positions }] = await Promise.all([
        sb.from("user_accounts").select("*").eq("user_id", userId).single(),
        sb.from("user_positions").select("*").eq("user_id", userId),
      ]);
      if (!account) return { error: "No account found" };

      const posArr = (positions || []).filter((p: any) => Number(p.qty) > 0);
      let positionsValue = 0;
      const posDetails = [];
      for (const p of posArr) {
        const price = await getPrice(p.symbol);
        const mv = price * Number(p.qty);
        const pl = (price - Number(p.avg_entry_price)) * Number(p.qty);
        positionsValue += mv;
        posDetails.push({
          symbol: p.symbol, qty: Number(p.qty),
          avg_entry_price: Number(p.avg_entry_price),
          current_price: price, market_value: mv,
          unrealized_pl: pl,
        });
      }

      const balance = Number(account.balance);
      const equity = balance + positionsValue;
      return {
        cash: balance, equity, positions_value: positionsValue,
        initial_balance: Number(account.initial_balance),
        total_pl: equity - Number(account.initial_balance),
        positions: posDetails,
      };
    }

    case "get_positions": {
      const { data: positions } = await sb.from("user_positions").select("*").eq("user_id", userId);
      const posArr = (positions || []).filter((p: any) => Number(p.qty) > 0);
      const result = [];
      for (const p of posArr) {
        const price = await getPrice(p.symbol);
        const pl = (price - Number(p.avg_entry_price)) * Number(p.qty);
        result.push({
          symbol: p.symbol, qty: Number(p.qty),
          avg_entry_price: Number(p.avg_entry_price),
          current_price: price,
          unrealized_pl: pl,
          unrealized_plpc: ((price / Number(p.avg_entry_price) - 1) * 100).toFixed(2) + "%",
        });
      }
      return result.length > 0 ? result : { message: "No open positions" };
    }

    case "place_order": {
      const symbol = String(args.symbol).toUpperCase();
      const qty = Number(args.qty);
      const side = String(args.side);

      if (qty <= 0) return { error: "Quantity must be positive" };

      const price = await getPrice(symbol);
      if (price <= 0) return { error: `Could not get price for ${symbol}` };

      const { data: account } = await sb.from("user_accounts").select("*").eq("user_id", userId).single();
      if (!account) return { error: "No account found" };

      const balance = Number(account.balance);
      const totalCost = price * qty;

      if (side === "buy") {
        if (totalCost > balance) {
          return { error: `Insufficient balance. Need $${totalCost.toFixed(2)} but have $${balance.toFixed(2)}` };
        }

        // Deduct balance
        await sb.from("user_accounts").update({ balance: balance - totalCost }).eq("user_id", userId);

        // Upsert position
        const { data: existing } = await sb.from("user_positions").select("*")
          .eq("user_id", userId).eq("symbol", symbol).single();

        if (existing) {
          const oldQty = Number(existing.qty);
          const oldAvg = Number(existing.avg_entry_price);
          const newQty = oldQty + qty;
          const newAvg = (oldAvg * oldQty + price * qty) / newQty;
          await sb.from("user_positions").update({ qty: newQty, avg_entry_price: newAvg })
            .eq("user_id", userId).eq("symbol", symbol);
        } else {
          await sb.from("user_positions").insert({
            user_id: userId, symbol, qty, avg_entry_price: price,
          });
        }

        // Log trade
        await sb.from("trade_history").insert({
          user_id: userId, symbol, side: "buy", qty, price,
          reason: `Manual buy via chat`, status: "filled",
        });

        return {
          success: true, action: "buy", symbol, qty,
          price, total_cost: totalCost,
          remaining_balance: balance - totalCost,
        };

      } else if (side === "sell") {
        const { data: existing } = await sb.from("user_positions").select("*")
          .eq("user_id", userId).eq("symbol", symbol).single();

        if (!existing || Number(existing.qty) < qty) {
          return { error: `Insufficient shares. Have ${existing ? Number(existing.qty) : 0} shares of ${symbol}` };
        }

        const proceeds = totalCost;
        const newQty = Number(existing.qty) - qty;

        await sb.from("user_accounts").update({ balance: balance + proceeds }).eq("user_id", userId);

        if (newQty <= 0) {
          await sb.from("user_positions").delete().eq("user_id", userId).eq("symbol", symbol);
        } else {
          await sb.from("user_positions").update({ qty: newQty }).eq("user_id", userId).eq("symbol", symbol);
        }

        const pl = (price - Number(existing.avg_entry_price)) * qty;

        await sb.from("trade_history").insert({
          user_id: userId, symbol, side: "sell", qty, price,
          reason: `Manual sell via chat`, status: "filled",
        });

        return {
          success: true, action: "sell", symbol, qty,
          price, proceeds, realized_pl: pl,
          remaining_balance: balance + proceeds,
        };
      }

      return { error: "Invalid side. Use 'buy' or 'sell'" };
    }

    case "get_quote": {
      const symbol = String(args.symbol).toUpperCase();
      const price = await getPrice(symbol);
      return { symbol, price, timestamp: new Date().toISOString() };
    }

    case "get_trade_history": {
      const limit = Number(args.limit) || 10;
      const { data } = await sb.from("trade_history").select("*")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
      return data || [];
    }

    case "update_profile": {
      const updateData: Record<string, unknown> = { strategy_prompt: args.strategy_prompt };
      if (args.max_trade_amount !== undefined) updateData.max_trade_amount = args.max_trade_amount;
      if (args.auto_trade_enabled !== undefined) updateData.auto_trade_enabled = args.auto_trade_enabled;
      if (args.trade_interval_minutes !== undefined) updateData.trade_interval_minutes = args.trade_interval_minutes;

      const { error } = await sb.from("trading_profiles").update(updateData).eq("user_id", userId);
      if (error) return { error: error.message };
      return { success: true, updated: updateData };
    }

    default:
      return { error: "Unknown tool" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Extract user from JWT
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user } } = await sb.auth.getUser(token);
    const userId = user?.id || "";

    const systemPrompt = `You are an expert AI trading assistant managing a virtual paper trading account. Users have a virtual balance starting at $100,000.
You respond in the same language as the user.

## YOUR EXPERTISE & KNOWLEDGE BASE

### Technical Analysis
- **Chart Patterns**: Head & shoulders, double top/bottom, cup & handle, flags, pennants, wedges, triangles.
- **Candlestick Patterns**: Doji, hammer, engulfing, morning/evening star, shooting star.
- **Indicators**: RSI, MACD, Bollinger Bands, Moving Averages, Stochastic, ATR, Volume Profile.
- **Support & Resistance**: Historical levels, pivot points, breakout/breakdown trading.
- **Fibonacci**: Key retracement levels at 23.6%, 38.2%, 50%, 61.8%.

### Investment Strategies
- Value, Growth, Momentum, Swing, Day trading, DCA, Dividend, Index investing.

### Portfolio Management & Risk
- Position sizing (1-2% rule), stop-loss strategies, diversification, risk metrics.

### Order Execution
- This is a virtual/simulated trading system. Orders execute at current market price instantly.

## KEY RULES
- Always confirm before placing orders (e.g., "I'll buy 10 shares of Tesla at ~$X. Proceed?")
- After placing orders, report the result clearly including price and remaining balance
- Use tools to fetch real price data, never make up numbers
- Format currency values nicely
- Be concise and professional
- Provide actionable insights with clear reasoning

## AUTOMATIC PROFILE UPDATES
- When user wants to change strategy, risk, or interval, call update_profile automatically.
- Briefly inform the user that their profile has been updated.

User is trading with virtual money (paper trading). All trades affect their virtual balance.`;

    const knowledgeDocs = await loadKnowledge();
    const fullSystemPrompt = knowledgeDocs ? systemPrompt + knowledgeDocs : systemPrompt;

    let aiMessages: any[] = [
      { role: "system", content: fullSystemPrompt },
      ...messages,
    ];

    const firstResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: aiMessages,
          tools,
          stream: false,
        }),
      }
    );

    if (!firstResponse.ok) {
      if (firstResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (firstResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await firstResponse.text();
      console.error("AI error:", firstResponse.status, t);
      throw new Error("AI gateway error");
    }

    const firstData = await firstResponse.json();
    const choice = firstData.choices[0];

    if (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
      aiMessages.push(choice.message);

      for (const tc of choice.message.tool_calls) {
        const args = JSON.parse(tc.function.arguments);
        const result = await executeTool(tc.function.name, args, userId);
        aiMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }

      const finalResponse = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: aiMessages,
            stream: true,
          }),
        }
      );

      if (!finalResponse.ok) throw new Error("AI gateway error on final response");

      return new Response(finalResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    const streamResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: aiMessages,
          stream: true,
        }),
      }
    );

    return new Response(streamResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
