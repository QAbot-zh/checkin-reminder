-- 为已有D1数据库添加签到相关列的安全迁移脚本
-- 在wrangler d1 execute 命令中运行此脚本

-- 添加签到类型列
ALTER TABLE entries ADD COLUMN checkin_type TEXT NOT NULL DEFAULT 'daily';

-- 添加自定义间隔天数列
ALTER TABLE entries ADD COLUMN checkin_interval INTEGER;

-- 添加最后签到日期列
ALTER TABLE entries ADD COLUMN last_checkin_date TEXT;

-- 可选：为已有数据设置初始值
UPDATE entries SET checkin_type = 'daily' WHERE checkin_type IS NULL;
UPDATE entries SET last_checkin_date = DATE('now') WHERE last_checkin_date IS NULL;