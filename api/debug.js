import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const headers = {
    'Content-Type': 'application/json',
  };

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    const jwtSecret = process.env.JWT_SECRET;

    // 检查环境变量
    const envCheck = {
      SUPABASE_URL: supabaseUrl ? '✅ set' : '❌ missing',
      SUPABASE_SERVICE_KEY: supabaseKey ? '✅ set' : '❌ missing',
      JWT_SECRET: jwtSecret ? '✅ set' : '❌ missing',
    };

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({
        error: '环境变量未配置',
        env: envCheck
      }), { status: 500, headers });
    }

    // 测试数据库连接
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: users, error } = await supabase
      .from('users')
      .select('username, role, is_active, password_hash');

    if (error) {
      return new Response(JSON.stringify({
        error: '数据库查询失败',
        details: error.message,
        env: envCheck
      }), { status: 500, headers });
    }

    // 测试密码哈希
    const testPassword = '160017';
    const encoder = new TextEncoder();
    const data = encoder.encode(testPassword + 'shipping-salt');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return new Response(JSON.stringify({
      env: envCheck,
      users: users.map(u => ({
        username: u.username,
        role: u.role,
        is_active: u.is_active,
        hash_prefix: u.password_hash?.substring(0, 20) + '...'
      })),
      test: {
        computedHash: computedHash,
        expectedPrefix: '$sha256$'
      }
    }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({
      error: e.message,
      stack: e.stack
    }), { status: 500, headers });
  }
}