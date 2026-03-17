-- 添加发货相关字段
-- 在 Supabase SQL Editor 中执行

-- 添加运单号和运单图片字段
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_image TEXT;

-- 更新状态约束，添加新状态
-- 注意：Supabase 可能需要先删除旧约束
-- ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
-- ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('quote', 'ordered', 'shipped', 'arrived'));