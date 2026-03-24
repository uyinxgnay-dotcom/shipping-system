-- 添加报价相关字段
-- 在 Supabase SQL Editor 中运行

-- 添加报价金额字段
ALTER TABLE orders ADD COLUMN IF NOT EXISTS quote_price DECIMAL(10,2);

-- 添加承运物流公司字段
ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrier VARCHAR(100);

-- 添加报价锁定字段（管理员保存后锁定，员工无法修改）
ALTER TABLE orders ADD COLUMN IF NOT EXISTS quote_locked BOOLEAN DEFAULT false;

-- 添加报价更新时间
ALTER TABLE orders ADD COLUMN IF NOT EXISTS quote_updated_at TIMESTAMP WITH TIME ZONE;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_orders_quote_locked ON orders(quote_locked);