-- Drop the old unique constraint on profile_key (allows only one "default" across all users)
ALTER TABLE public.trading_profiles DROP CONSTRAINT IF EXISTS trading_profiles_profile_key_key;

-- Add composite unique constraint
ALTER TABLE public.trading_profiles ADD CONSTRAINT trading_profiles_user_profile_key UNIQUE (user_id, profile_key);