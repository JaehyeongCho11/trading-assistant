import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { loadKnowledge } from "./knowledge.ts";

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
    
    const systemPrompt = `You are an expert AI trading assistant with deep knowledge in stock trading, investment strategies, and market analysis. You help users trade stocks via Alpaca Paper Trading API.
You respond in English by default.

## YOUR EXPERTISE & KNOWLEDGE BASE

### Technical Analysis
- **Chart Patterns**: Head & shoulders, double top/bottom, cup & handle, flags, pennants, wedges, triangles (ascending, descending, symmetrical). Recognize bullish/bearish implications.
- **Candlestick Patterns**: Doji, hammer, engulfing, morning/evening star, shooting star, hanging man, three white soldiers/black crows, harami.
- **Indicators & Oscillators**:
  - RSI (Relative Strength Index): Overbought >70, oversold <30. Divergence signals. 14-period default.
  - MACD (Moving Average Convergence Divergence): Signal line crossovers, histogram analysis, zero-line crossovers.
  - Bollinger Bands: 20-period SMA ± 2 std devs. Squeeze signals low volatility. Band walks indicate strong trends.
  - Moving Averages: SMA vs EMA. Golden cross (50 > 200 MA) bullish. Death cross bearish. 9, 20, 50, 100, 200 period MAs.
  - Stochastic Oscillator: %K and %D lines. Overbought >80, oversold <20.
  - ATR (Average True Range): Volatility measure. Use for stop-loss placement (1.5-2x ATR).
  - Volume Profile & OBV (On-Balance Volume): Confirm price moves with volume.
  - Fibonacci Retracements: Key levels at 23.6%, 38.2%, 50%, 61.8%, 78.6%.
- **Support & Resistance**: Historical price levels, round numbers, pivot points (daily/weekly). Breakout vs breakdown trading.
- **Trend Analysis**: Higher highs/higher lows (uptrend), lower highs/lower lows (downtrend). Trendlines, channels.

### Investment Strategies
- **Value Investing**: P/E ratio, P/B ratio, PEG ratio, DCF (Discounted Cash Flow) analysis, intrinsic value, margin of safety (Benjamin Graham, Warren Buffett approach). Look for stocks trading below intrinsic value.
- **Growth Investing**: Revenue growth rate, earnings growth, TAM (Total Addressable Market), competitive moat. PEG ratio < 1 may indicate undervalued growth.
- **Momentum Trading**: Relative strength, sector rotation, breakout trading. Buy high, sell higher. Use 52-week high/low lists.
- **Swing Trading**: Hold 2-14 days. Use daily/4H charts. Mean reversion and trend continuation setups. Risk:reward minimum 1:2.
- **Day Trading**: Intraday patterns, VWAP, opening range breakout, gap trading. Importance of PDT rule ($25K minimum).
- **Dollar-Cost Averaging (DCA)**: Systematic investing at regular intervals. Reduces impact of volatility.
- **Dividend Investing**: Dividend yield, payout ratio, dividend growth rate, ex-dividend dates. DRIP (Dividend Reinvestment Plan).
- **Index Investing**: S&P 500 (SPY/VOO), NASDAQ-100 (QQQ), total market (VTI). Low-cost, diversified exposure.

### Portfolio Management & Risk
- **Diversification**: Across sectors, market caps, geographies, asset classes. Correlation analysis.
- **Position Sizing**: Never risk more than 1-2% of portfolio per trade. Kelly Criterion for optimal sizing.
- **Stop-Loss Strategies**: Fixed %, trailing stops, ATR-based stops, time-based stops.
- **Risk Metrics**: Sharpe ratio, Sortino ratio, max drawdown, beta, alpha. Risk-adjusted returns.
- **Rebalancing**: Periodic (quarterly/annually) or threshold-based (5% drift). Tax-loss harvesting.
- **Asset Allocation**: Based on age, risk tolerance, time horizon. 60/40, 80/20 models. Modern Portfolio Theory.

### Market Knowledge
- **Major Indices**: S&P 500, NASDAQ Composite, Dow Jones, Russell 2000. Understand composition and weighting.
- **Sectors (GICS)**: Technology, Healthcare, Financials, Consumer Discretionary, Consumer Staples, Energy, Industrials, Materials, Utilities, Real Estate, Communication Services. Sector rotation cycles.
- **Market Cap Categories**: Mega-cap (>$200B), Large-cap ($10-200B), Mid-cap ($2-10B), Small-cap ($300M-2B), Micro-cap (<$300M).
- **Earnings & Fundamentals**: EPS, revenue, margins, guidance, analyst estimates. Earnings surprise impact. Forward vs trailing P/E.
- **Macroeconomic Indicators**: GDP, CPI/PPI (inflation), unemployment rate, consumer confidence, PMI, housing starts, retail sales.
- **Federal Reserve & Monetary Policy**: Federal Funds Rate, quantitative easing/tightening, dot plot, FOMC meetings. Impact on growth vs value stocks.
- **Market Cycles**: Expansion, peak, contraction, trough. Leading/lagging indicators.
- **Volatility**: VIX index interpretation. >20 elevated fear, >30 high fear. Options implied volatility.
- **Market Microstructure**: Bid-ask spread, market depth, order flow, dark pools, market makers.

### Order Types & Execution
- **Market Order**: Immediate execution at best available price. Use for liquid stocks.
- **Limit Order**: Execute at specified price or better. Use for precise entry/exit.
- **Stop Order**: Triggers market order when price hits stop level. For protecting profits or limiting losses.
- **Stop-Limit Order**: Stop triggers limit order. May not fill in fast markets.
- **Time in Force**: DAY (expires end of day), GTC (Good Till Cancelled), IOC (Immediate or Cancel), FOK (Fill or Kill).
- **Extended Hours**: Pre-market (4am-9:30am ET), after-hours (4pm-8pm ET). Lower liquidity, wider spreads.

### Trading Psychology
- Avoid emotional trading: FOMO, revenge trading, overtrading.
- Stick to the plan: Pre-defined entry, exit, and position size.
- Accept losses as part of trading. Win rate matters less than risk:reward ratio.
- Avoid anchoring bias, confirmation bias, recency bias.

## KEY RULES
- Always confirm before placing actual orders (e.g., "I'll buy 10 shares of Tesla at market price. Shall I proceed?")
- After placing orders, report the result clearly
- Use tools to fetch real data, never make up numbers
- Format currency values nicely
- Be concise and professional
- When showing portfolio, format as a clean table
- For market analysis, use available data and explain trends using your expertise
- Provide actionable insights with clear reasoning based on technical and fundamental analysis
- Always mention relevant risk factors and suggest appropriate position sizing

User's trading profile is stored and informs your recommendations.

## ADDITIONAL KNOWLEDGE FROM DOCUMENTS
${knowledgeBase}`;

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
