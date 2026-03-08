import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

const tools = [
  {
    type: "function",
    function: {
      name: "get_account",
      description: "Get Alpaca paper trading account info (balance, buying power, etc.)",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_positions",
      description: "Get all current open positions in the portfolio",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "place_order",
      description: "Place a stock order (buy or sell)",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Stock ticker symbol (e.g., AAPL)" },
          qty: { type: "number", description: "Number of shares" },
          side: { type: "string", enum: ["buy", "sell"], description: "Buy or sell" },
          type: { type: "string", enum: ["market", "limit"], description: "Order type" },
          limit_price: { type: "number", description: "Limit price (required for limit orders)" },
        },
        required: ["symbol", "qty", "side", "type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_orders",
      description: "Get recent orders",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["open", "closed", "all"], description: "Filter by status" },
        },
        required: [],
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
];

async function executeTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "get_account":
      return await alpacaRequest("/v2/account");
    case "get_positions":
      return await alpacaRequest("/v2/positions");
    case "place_order": {
      const order: Record<string, unknown> = {
        symbol: args.symbol,
        qty: args.qty,
        side: args.side,
        type: args.type,
        time_in_force: "day",
      };
      if (args.type === "limit" && args.limit_price) {
        order.limit_price = args.limit_price;
      }
      return await alpacaRequest("/v2/orders", "POST", order);
    }
    case "get_orders":
      return await alpacaRequest(`/v2/orders?status=${args.status || "all"}&limit=10`);
    case "get_quote":
      return await fetch(
        `https://data.alpaca.markets/v2/stocks/${args.symbol}/quotes/latest`,
        {
          headers: {
            "APCA-API-KEY-ID": Deno.env.get("ALPACA_API_KEY")!,
            "APCA-API-SECRET-KEY": Deno.env.get("ALPACA_SECRET_KEY")!,
          },
        }
      ).then((r) => r.json());
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

    const profile = messages[0]?.role === "user" ? "" : "";
    
    const systemPrompt = `You are an AI trading assistant that helps users trade stocks via Alpaca Paper Trading API.
You respond in Korean by default.

Key rules:
- Always confirm before placing actual orders (e.g., "테슬라 10주 시장가 매수하겠습니다. 진행할까요?")
- After placing orders, report the result clearly
- Use tools to fetch real data, never make up numbers
- Format currency values nicely
- Be concise and professional
- When showing portfolio, format as a clean table
- For market analysis, use available data and explain trends

User's trading profile is stored and informs your recommendations.`;

    // First call - may trigger tool use
    let aiMessages = [
      { role: "system", content: systemPrompt },
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
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (firstResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await firstResponse.text();
      console.error("AI error:", firstResponse.status, t);
      throw new Error("AI gateway error");
    }

    const firstData = await firstResponse.json();
    const choice = firstData.choices[0];

    // If tool calls, execute them and get final response with streaming
    if (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
      aiMessages.push(choice.message);

      for (const tc of choice.message.tool_calls) {
        const args = JSON.parse(tc.function.arguments);
        const result = await executeTool(tc.function.name, args);
        aiMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }

      // Stream the final response
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

    // No tool calls - stream directly
    // Re-request with streaming
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
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
