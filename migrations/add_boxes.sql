-- 添加 boxes 字段支持多规格箱子
-- 在 Supabase SQL Editor 中执行

-- 添加 boxes JSON 字段
ALTER TABLE orders ADD COLUMN IF NOT EXISTS boxes JSONB DEFAULT '[]'::jsonb;

-- boxes 格式示例:
-- [
--   {"length": 50, "width": 40, "height": 30, "weight": 5, "quantity": 2},
--   {"length": 60, "width": 50, "height": 40, "weight": 8, "quantity": 1}
-- ]

-- 为了兼容旧数据，可以迁移现有的单箱子数据到 boxes 格式
UPDATE orders 
SET boxes = jsonb_build_array(
  jsonb_build_object(
    'length', length,
    'width', width,
    'height', height,
    'weight', weight,
    'quantity', quantity
  )
)
WHERE boxes = '[]'::jsonb AND length IS NOT NULL;