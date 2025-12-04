-- 条目表（新增 group_name / tags / checkin_type / checkin_interval / last_checkin_date）
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sign_url TEXT NOT NULL,
  redeem_url TEXT,
  group_name TEXT,
  tags TEXT NOT NULL DEFAULT '[]', -- JSON 数组字符串
  checkin_type TEXT NOT NULL DEFAULT 'daily', -- 签到类型: daily/weekly/monthly/quarterly/yearly/custom
  checkin_interval INTEGER, -- 自定义间隔天数（仅 checkin_type='custom' 时使用）
  last_checkin_date TEXT, -- 最后一次签到日期 (YYYY-MM-DD)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 当日签到事实表
CREATE TABLE IF NOT EXISTS checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  date TEXT NOT NULL, -- YYYY-MM-DD（按 TIMEZONE 计算）
  created_at TEXT NOT NULL,
  UNIQUE(entry_id, date)
);

CREATE INDEX IF NOT EXISTS idx_checkins_entry_date ON checkins(entry_id, date);
