-- 添加 deleted_at 字段用于软删除（回收站功能）
-- 在 Supabase SQL Editor 中运行此脚本

-- 添加 deleted_at 字段
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 创建索引以提高回收站查询性能
CREATE INDEX IF NOT EXISTS idx_orders_deleted_at ON orders(deleted_at);

-- 更新 RLS 策略（如果需要）
-- 已删除的订单仍然可以被查询（通过回收站 API）