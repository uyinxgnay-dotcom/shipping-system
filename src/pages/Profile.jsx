import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Profile() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)

  const handleChangePassword = async (e) => {
    e.preventDefault()
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert('❌ 新密码两次输入不一致')
      return
    }
    
    if (passwordForm.newPassword.length < 4) {
      alert('❌ 新密码至少4位')
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      alert('✅ 密码修改成功')
      setShowPasswordModal(false)
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      alert('❌ ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen gradient-bg pb-8">
      {/* 顶部导航 */}
      <nav className="bg-white/10 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-white font-bold text-lg">👤 个人中心</h1>
          <button
            onClick={() => navigate('/')}
            className="text-white/80 hover:text-white text-sm"
          >
            ← 返回首页
          </button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto p-4">
        <div className="card">
          <h2 className="font-bold text-lg mb-4 border-b pb-2">账号信息</h2>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b">
              <div>
                <div className="text-gray-500 text-sm">用户名</div>
                <div className="font-medium">{user?.username}</div>
              </div>
            </div>
            
            <div className="flex justify-between items-center py-3 border-b">
              <div>
                <div className="text-gray-500 text-sm">角色</div>
                <div className="font-medium">
                  {user?.role === 'admin' ? '👑 管理员' : '👤 员工'}
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center py-3">
              <div>
                <div className="text-gray-500 text-sm">密码</div>
                <div className="font-medium">••••••••</div>
              </div>
              <button
                onClick={() => setShowPasswordModal(true)}
                className="text-blue-600 hover:text-blue-700 text-sm"
              >
                修改密码
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 修改密码弹窗 */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-md">
            <h2 className="font-bold text-xl mb-4">修改密码</h2>
            
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="label">当前密码</label>
                <input
                  type="password"
                  className="input"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                  required
                />
              </div>
              
              <div>
                <label className="label">新密码</label>
                <input
                  type="password"
                  className="input"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                  required
                  minLength={4}
                />
              </div>
              
              <div>
                <label className="label">确认新密码</label>
                <input
                  type="password"
                  className="input"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  required
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1" disabled={loading}>
                  {loading ? '修改中...' : '确认修改'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="btn-secondary flex-1"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}