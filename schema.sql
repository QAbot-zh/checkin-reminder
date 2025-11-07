-- 条目表（新增 group_name / tags）
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sign_url TEXT NOT NULL,
  redeem_url TEXT,
  group_name TEXT,
  tags TEXT NOT NULL DEFAULT '[]', -- JSON 数组字符串
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
