# 📦 发货管理系统

一个简洁的发货信息管理系统，支持多用户、权限控制、钉钉通知。

## 功能特性

- ✅ 用户登录与权限管理（管理员/员工）
- ✅ 创建、查看、编辑、删除订单
- ✅ 自动计算体积重、计费重量
- ✅ 提交时发送邮件（带Excel附件）
- ✅ 报价→下单状态变更，钉钉通知
- ✅ 管理员可转移订单所有权
- ✅ 响应式设计，手机电脑都能用

## 部署步骤

### 1. 创建 Supabase 项目

1. 访问 https://supabase.com 注册并登录
2. 创建新项目，选择最近的区域
3. 进入项目后，点击 **SQL Editor**
4. 复制 `supabase-setup.sql` 的内容并执行
5. 获取配置信息：
   - Settings → API → URL → 这是 `SUPABASE_URL`
   - Settings → API → service_role key → 这是 `SUPABASE_SERVICE_KEY`

### 2. 部署到 Vercel

1. 将此项目上传到你的 GitHub 仓库
2. 访问 https://vercel.com 并用 GitHub 登录
3. 点击 **Import Project**，选择你的仓库
4. 设置环境变量：

```
SUPABASE_URL=你的supabase项目URL
SUPABASE_SERVICE_KEY=你的service-role-key
JWT_SECRET=随机生成的复杂字符串（可以用密码生成器）
SMTP_USER=yangy48uni@163.com
SMTP_PASS=你的SMTP授权码
NOTIFY_EMAIL=652565190@qq.com
DINGTALK_WEBHOOK=https://oapi.dingtalk.com/robot/send?access_token=你的token
DINGTALK_SECRET=你的钉钉加签密钥
```

5. 点击 Deploy

### 3. 创建管理员账号

首次部署后，需要创建管理员账号。你可以：

**方法一：在 Supabase SQL Editor 执行**

```sql
-- 密码: yourpassword (需要替换为 bcrypt hash)
INSERT INTO users (username, password_hash, role, is_active)
VALUES ('xin', '$2a$10$...你的bcrypt hash...', 'admin', true);
```

**方法二：使用 API**

```bash
curl -X POST https://你的域名/api/users \
  -H "Content-Type: application/json" \
  -d '{"username":"xin","password":"yourpassword","role":"admin"}'
```

注意：方法二需要在代码中临时移除管理员权限检查。

## 使用说明

### 登录

访问你的 Vercel 域名，使用账号密码登录。

### 创建订单

1. 点击「新建订单」
2. 填写订单号、货物信息、收件人信息
3. 选择状态（报价中/已下单）
4. 提交后自动发送邮件

### 确认下单

1. 在订单详情页，点击「确认下单」
2. 状态变为已下单
3. 钉钉收到通知

### 用户管理（管理员）

1. 点击右上角「用户管理」
2. 添加、禁用、删除员工账号

## 技术栈

- 前端：React + TailwindCSS + Vite
- 后端：Vercel Serverless Functions
- 数据库：Supabase (PostgreSQL)
- 认证：JWT
- 邮件：Nodemailer
- Excel：SheetJS

## 安全建议

1. 使用强密码
2. 定期更换 JWT_SECRET
3. 不要在代码中硬编码敏感信息
4. 定期检查 Supabase 日志