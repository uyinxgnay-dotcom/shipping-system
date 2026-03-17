import { verifyToken } from '../_utils/auth.js';
import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const user = await verifyToken(authHeader);
    
    if (!user || user.role !== 'admin') {
      return new Response(JSON.stringify({ error: '只有管理员可以上传图片' }), { status: 403, headers });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const folder = formData.get('folder') || 'tracking';

    if (!file) {
      return new Response(JSON.stringify({ error: '请选择文件' }), { status: 400, headers });
    }

    // 生成唯一文件名
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const ext = file.name.split('.').pop() || 'png';
    const fileName = `${folder}/${timestamp}-${randomStr}.${ext}`;

    // 转换文件为 ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // 上传到 Supabase Storage
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.storage
      .from('images')
      .upload(fileName, uint8Array, {
        contentType: file.type,
        upsert: false
      });

    if (error) {
      return new Response(JSON.stringify({ error: '上传失败: ' + error.message }), { status: 500, headers });
    }

    // 获取公开 URL
    const { data: urlData } = supabase.storage
      .from('images')
      .getPublicUrl(fileName);

    return new Response(JSON.stringify({ 
      success: true, 
      url: urlData.publicUrl,
      fileName: fileName
    }), { status: 200, headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: '上传失败: ' + error.message }), { status: 500, headers });
  }
}