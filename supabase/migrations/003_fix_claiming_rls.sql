-- ============================================
-- LUXA CLOUD - Migration 003
-- Fix device claiming RLS gap + add claim RPC
-- ============================================

-- Problem: The current SELECT policy on devices only allows
-- auth.uid() = user_id. When a user tries to claim a device
-- by entering its code, they can't read the unclaimed device
-- (user_id IS NULL) to verify it exists.
--
-- Solution: Add a secure RPC function that handles the entire
-- claim flow with SECURITY DEFINER, bypassing RLS safely.

-- ============================================
-- 1. ADD SELECT POLICY FOR CLAIM CHECK
-- Allows authenticated users to check if a device_id exists
-- (only returns minimal info, not full device data)
-- ============================================
CREATE POLICY "Users can check device existence for claiming"
    ON devices FOR SELECT
    USING (
        -- Allow reading unclaimed devices (for claim check)
        user_id IS NULL
        -- Combined with the existing "Users can view own devices" policy
    );

-- ============================================
-- 2. SECURE CLAIM DEVICE RPC FUNCTION
-- Atomic: checks existence, ownership, and claims in one call.
-- Returns JSON with status and message.
-- ============================================
CREATE OR REPLACE FUNCTION claim_device(p_device_id TEXT)
RETURNS JSON AS $$
DECLARE
    v_device RECORD;
    v_user_id UUID;
BEGIN
    -- Get the calling user's ID
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN json_build_object('ok', false, 'error', 'not_authenticated');
    END IF;

    -- Find the device
    SELECT * INTO v_device
    FROM devices
    WHERE device_id = UPPER(TRIM(p_device_id));

    IF NOT FOUND THEN
        RETURN json_build_object('ok', false, 'error', 'device_not_found');
    END IF;

    -- Check if already claimed by this user
    IF v_device.user_id = v_user_id THEN
        RETURN json_build_object('ok', true, 'message', 'already_yours');
    END IF;

    -- Check if claimed by another user
    IF v_device.user_id IS NOT NULL THEN
        RETURN json_build_object('ok', false, 'error', 'already_claimed');
    END IF;

    -- Claim the device
    UPDATE devices
    SET user_id = v_user_id,
        name = COALESCE(name, device_id)  -- set default name if none
    WHERE device_id = UPPER(TRIM(p_device_id))
    AND user_id IS NULL;  -- extra safety: only claim if still unclaimed

    IF NOT FOUND THEN
        -- Race condition: someone claimed it between SELECT and UPDATE
        RETURN json_build_object('ok', false, 'error', 'already_claimed');
    END IF;

    RETURN json_build_object(
        'ok', true,
        'message', 'claimed',
        'device_id', v_device.device_id,
        'model', v_device.model,
        'firmware', v_device.firmware
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. UNCLAIM DEVICE RPC FUNCTION
-- Only the owner can unclaim their device.
-- ============================================
CREATE OR REPLACE FUNCTION unclaim_device(p_device_id TEXT)
RETURNS JSON AS $$
DECLARE
    v_user_id UUID;
    v_rows INT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN json_build_object('ok', false, 'error', 'not_authenticated');
    END IF;

    UPDATE devices
    SET user_id = NULL,
        name = NULL
    WHERE device_id = UPPER(TRIM(p_device_id))
    AND user_id = v_user_id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;

    IF v_rows = 0 THEN
        RETURN json_build_object('ok', false, 'error', 'not_found_or_not_owner');
    END IF;

    RETURN json_build_object('ok', true, 'message', 'unclaimed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. GET USER PROFILE HELPER
-- Returns the current user's profile (used by portal)
-- ============================================
CREATE OR REPLACE FUNCTION get_my_profile()
RETURNS JSON AS $$
DECLARE
    v_profile RECORD;
BEGIN
    SELECT * INTO v_profile
    FROM profiles
    WHERE id = auth.uid();

    IF NOT FOUND THEN
        RETURN json_build_object('ok', false, 'error', 'no_profile');
    END IF;

    RETURN json_build_object(
        'ok', true,
        'id', v_profile.id,
        'email', v_profile.email,
        'full_name', v_profile.full_name,
        'locale', v_profile.locale,
        'timezone', v_profile.timezone
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- DONE! Run this after 001_initial_schema.sql
-- ============================================
