-- User accounts with virtual balance
CREATE TABLE public.user_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  balance numeric NOT NULL DEFAULT 100000,
  initial_balance numeric NOT NULL DEFAULT 100000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own account" ON public.user_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own account" ON public.user_accounts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own account" ON public.user_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Virtual positions table
CREATE TABLE public.user_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  symbol text NOT NULL,
  qty numeric NOT NULL DEFAULT 0,
  avg_entry_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, symbol)
);

ALTER TABLE public.user_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own positions" ON public.user_positions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own positions" ON public.user_positions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own positions" ON public.user_positions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own positions" ON public.user_positions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Add user_id to trade_history
ALTER TABLE public.trade_history ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Trigger to auto-create account on profile creation
CREATE OR REPLACE FUNCTION public.create_user_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_accounts (user_id) VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_trading_profile_created
  AFTER INSERT ON public.trading_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_account();

-- Update trigger for updated_at
CREATE TRIGGER update_user_accounts_updated_at
  BEFORE UPDATE ON public.user_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_positions_updated_at
  BEFORE UPDATE ON public.user_positions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();