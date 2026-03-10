ALTER TABLE public.trading_profiles ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Anyone can insert trading profiles" ON public.trading_profiles;
DROP POLICY IF EXISTS "Anyone can read trading profiles" ON public.trading_profiles;
DROP POLICY IF EXISTS "Anyone can update trading profiles" ON public.trading_profiles;

CREATE POLICY "Users can insert own profiles" ON public.trading_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own profiles" ON public.trading_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profiles" ON public.trading_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can insert trade history" ON public.trade_history;
DROP POLICY IF EXISTS "Anyone can read trade history" ON public.trade_history;

CREATE POLICY "Users can insert own trades" ON public.trade_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can read own trades" ON public.trade_history FOR SELECT TO authenticated USING (true);