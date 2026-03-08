
-- Enable pg_cron and pg_net for scheduled edge function calls
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Trading profiles table (stores onboarding answers + trading config)
CREATE TABLE public.trading_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_key TEXT NOT NULL UNIQUE DEFAULT 'default',
  survey_answers JSONB,
  auto_trade_enabled BOOLEAN NOT NULL DEFAULT true,
  strategy_prompt TEXT DEFAULT 'You are a conservative AI trader. Analyze market conditions and make small, safe trades based on the user profile.',
  max_trade_amount NUMERIC DEFAULT 1000,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- No RLS needed since there's no auth, but enable it with public access
ALTER TABLE public.trading_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read trading profiles" ON public.trading_profiles FOR SELECT USING (true);
CREATE POLICY "Anyone can insert trading profiles" ON public.trading_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update trading profiles" ON public.trading_profiles FOR UPDATE USING (true);

-- Trade history log
CREATE TABLE public.trade_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES public.trading_profiles(id),
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  qty NUMERIC NOT NULL,
  price NUMERIC,
  order_id TEXT,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trade_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read trade history" ON public.trade_history FOR SELECT USING (true);
CREATE POLICY "Anyone can insert trade history" ON public.trade_history FOR INSERT WITH CHECK (true);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_trading_profiles_updated_at
  BEFORE UPDATE ON public.trading_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
