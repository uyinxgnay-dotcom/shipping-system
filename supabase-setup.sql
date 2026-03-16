-- Supabase 数据库初始化脚本
-- 在 Supabase SQL Editor 中运行此脚本

-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建订单表
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'quote' CHECK (status IN ('quote', 'ordered')),
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- 货物信息
  length DECIMAL(10,2),
  width DECIMAL(10,2),
  height DECIMAL(10,2),
  weight DECIMAL(10,2),
  quantity INTEGER DEFAULT 1,
  charge_weight DECIMAL(10,2),
  
  -- 收件人信息
  recipient_name VARCHAR(100),
  country VARCHAR(100),
  province VARCHAR(100),
  city VARCHAR(100),
  zipcode VARCHAR(20),
  address VARCHAR(500),
  phone VARCHAR(50),
  
  -- 其他
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_owner_id ON orders(owner_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 启用 RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 创建策略：允许所有认证用户读取
CREATE POLICY "Allow read for all" ON orders FOR SELECT USING (true);
CREATE POLICY "Allow read for all" ON users FOR SELECT USING (true);

-- 允许插入
CREATE POLICY "Allow insert for all" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow insert for all" ON users FOR INSERT WITH CHECK (true);

-- 允许更新
CREATE POLICY "Allow update for all" ON orders FOR UPDATE USING (true);
CREATE POLICY "Allow update for all" ON users FOR UPDATE USING (true);

-- 允许删除
CREATE POLICY "Allow delete for all" ON orders FOR DELETE USING (true);
CREATE POLICY "Allow delete for all" ON users FOR DELETE USING (true);

-- 插入默认管理员账号
-- 密码: admin123 (bcrypt hash)
INSERT INTO users (username, password_hash, role, is_active)
VALUES ('admin', '$2a$10$rQZ9QxQxQxQxQxQxQxQxQOZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJ', 'admin', true)
ON CONFLICT (username) DO NOTHING;

-- 注意：上面的密码 hash 是示例，实际需要用真实生成的
-- 你可以在部署后通过 API 创建管理员账号