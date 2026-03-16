import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

function verifyToken(auth) {
  if (!auth || !auth.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(auth.slice(7), JWT_SECRET);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const user = verifyToken(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ error: '请先登录' });
  }

  if (user.role !== 'admin') {
    return res.status(403).json({ error: '只有管理员可以管理用户' });
  }

  // GET - 获取用户列表
  if (req.method === 'GET') {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, role, is_active, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: '获取用户失败' });
    }

    return res.status(200).json({ users });
  }

  // POST - 创建用户
  if (req.method === 'POST') {
    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '请输入用户名和密码' });
    }

    // 检查用户名是否已存在
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    if (existing) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    // 加密密码
    const passwordHash = await bcrypt.hash(password, 10);

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        username,
        password_hash: passwordHash,
        role: role || 'employee',
        is_active: true
      })
      .select('id, username, role, is_active, created_at')
      .single();

    if (error) {
      return res.status(500).json({ error: '创建用户失败' });
    }

    return res.status(201).json({ user: newUser });
  }

  // PUT - 更新用户
  if (req.method === 'PUT') {
    const id = req.url.split('/').filter(Boolean).pop().split('?')[0];
    const updates = req.body;

    // 如果更新密码
    if (updates.password) {
      updates.password_hash = await bcrypt.hash(updates.password, 10);
      delete updates.password;
    }

    const { data: updated, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select('id, username, role, is_active, created_at')
      .single();

    if (error) {
      return res.status(500).json({ error: '更新失败' });
    }

    return res.status(200).json({ user: updated });
  }

  // DELETE - 删除用户
  if (req.method === 'DELETE') {
    const id = req.url.split('/').filter(Boolean).pop().split('?')[0];

    // 不能删除自己
    if (id === user.id) {
      return res.status(400).json({ error: '不能删除自己' });
    }

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: '删除失败' });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}