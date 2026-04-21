-- ============================================================
-- Migration 004: Motors + Scenarios + Groups + Schedules
-- LuxaControl cloud management tables
-- ============================================================
-- Motors: user-defined names for ESP32 slots
-- Scenarios: named action sequences
-- Groups: motor collections
-- Schedules: time-based triggers
-- ============================================================

-- ── MOTORS ──────────────────────────────────────────────────
-- Each row = one motor slot on an ESP32 device.
-- slot_id matches the firmware's motor/RTS index (0-based).
CREATE TABLE IF NOT EXISTS motors (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id    text NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot_id      integer NOT NULL CHECK (slot_id >= 0 AND slot_id <= 15),
  name         text NOT NULL,
  room         text NOT NULL DEFAULT 'Teras',
  protocol     text NOT NULL DEFAULT 'rf' CHECK (protocol IN ('rf','relay')),
  icon         text NOT NULL DEFAULT '🪟',
  current_pos  integer NOT NULL DEFAULT 0 CHECK (current_pos >= 0 AND current_pos <= 100),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, slot_id)
);

ALTER TABLE motors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own motors" ON motors
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── SCENARIOS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scenarios (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  icon       text NOT NULL DEFAULT '🌅',
  color      text NOT NULL DEFAULT '#c9963b',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own scenarios" ON scenarios
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── SCENARIO STEPS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scenario_steps (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id  uuid NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  motor_id     uuid NOT NULL REFERENCES motors(id) ON DELETE CASCADE,
  action       text NOT NULL CHECK (action IN ('open','close','stop','position')),
  target_pos   integer CHECK (target_pos >= 0 AND target_pos <= 100),
  delay_sec    integer NOT NULL DEFAULT 0,
  step_order   integer NOT NULL DEFAULT 0
);

ALTER TABLE scenario_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own scenario steps" ON scenario_steps
  USING (EXISTS (
    SELECT 1 FROM scenarios s
    WHERE s.id = scenario_id AND s.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM scenarios s
    WHERE s.id = scenario_id AND s.user_id = auth.uid()
  ));

-- ── EXECUTE SCENARIO RPC ─────────────────────────────────────
-- Inserts one command row per step, then returns count.
CREATE OR REPLACE FUNCTION execute_scenario(p_scenario_id uuid)
RETURNS JSON AS $$
DECLARE
  v_step   RECORD;
  v_motor  RECORD;
  v_count  integer := 0;
  v_cmd    text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('ok',false,'error','not_authenticated');
  END IF;

  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM scenarios WHERE id = p_scenario_id AND user_id = auth.uid()
  ) THEN
    RETURN json_build_object('ok',false,'error','not_found');
  END IF;

  FOR v_step IN
    SELECT ss.*, m.device_id, m.slot_id, m.protocol
    FROM scenario_steps ss
    JOIN motors m ON m.id = ss.motor_id
    WHERE ss.scenario_id = p_scenario_id
    ORDER BY ss.step_order
  LOOP
    -- Map action to command
    v_cmd := CASE
      WHEN v_step.action = 'open'     THEN CASE WHEN v_step.protocol='rf' THEN 'rts_up'   ELSE 'motor_open'  END
      WHEN v_step.action = 'close'    THEN CASE WHEN v_step.protocol='rf' THEN 'rts_down' ELSE 'motor_close' END
      WHEN v_step.action = 'stop'     THEN CASE WHEN v_step.protocol='rf' THEN 'rts_my'   ELSE 'motor_stop'  END
      WHEN v_step.action = 'position' THEN 'motor_position'
      ELSE 'motor_stop'
    END;

    INSERT INTO commands (device_id, action, target, status)
    VALUES (v_step.device_id, v_cmd, COALESCE(v_step.target_pos, v_step.slot_id), 'pending');

    v_count := v_count + 1;
  END LOOP;

  RETURN json_build_object('ok',true,'commands_sent',v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── DEFAULT SCENES (inserted at signup via trigger) ──────────
-- No auto-insert here; let users create their own.

-- ── SEED COMMENTS ────────────────────────────────────────────
COMMENT ON TABLE motors        IS 'User-named motor slots on ESP32 devices. Protocol: rf=RF 433MHz, relay=Direct relay.';
COMMENT ON TABLE scenarios     IS 'Named action sequences that can be applied to multiple motors at once.';
COMMENT ON TABLE scenario_steps IS 'Individual motor actions within a scenario.';
