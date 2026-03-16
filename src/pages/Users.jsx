import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Users() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'employee' })

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      setUsers(data.users || [])
    } catch (err) {
      console.error('获取用户失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddUser = async (e) => {
    e.preventDefault()
    
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newUser)
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      setUsers(prev => [...prev, data.user])
      setShowAddModal(false)
      setNewUser({ username: '', password: '', role: 'employee' })
      alert('✅ 用户添加成功')
    } catch (err) {
      alert('❌ ' + err.message)
    }
  }

  const handleToggleActive = async (userId, currentActive) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_active: !currentActive })
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: !currentActive } : u))
    } catch (err) {
      alert('❌ ' + err.message)
    }
  }

  const handleDeleteUser = async (userId) => {
    if (!confirm('确定要删除这个用户吗？')) return
    
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (!res.ok) throw new Error('删除失败')
      
      setUsers(prev => prev.filter(u => u.id !== userId))
      alert('✅ 用户已删除')
    } catch (err) {
      alert('❌ ' + err.message)
    }
  }

  if (user?.role !== 'admin') {
    navigate('/')
    return null
  }

  return (
    <div className="min-h-screen gradient-bg pb-8">
      {/* 顶部导航 */}
      <nav className="bg-white/10 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-white font-bold text-lg">👥 用户管理</h1>
          <button
            onClick={() => navigate('/')}
            className="text-white/80 hover:text-white text-sm"
          >
            ← 返回首页
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-4">
        {/* 添加按钮 */}
        <div className="card mb-4">
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary !w-auto"
          >
            + 添加新用户
          </button>
        </div>

        {/* 用户列表 */}
        {loading ? (
          <div className="text-center text-white py-10">加载中...</div>
        ) : (
          <div className="card">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2">用户名</th>
                  <th className="text-left py-3 px-2">角色</th>
                  <th className="text-left py-3 px-2">状态</th>
                  <th className="text-left py-3 px-2">创建时间</th>
                  <th className="text-right py-3 px-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="py-3 px-2 font-medium">{u.username}</td>
                    <td className="py-3 px-2">
                      <span className={`status-badge ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                        {u.role === 'admin' ? '👑 管理员' : '👤 员工'}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`status-badge ${u.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {u.is_active ? '✅ 启用' : '❌ 禁用'}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-gray-500 text-sm">
                      {new Date(u.created_at).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="py-3 px-2 text-right">
                      {u.id !== user.id && (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleToggleActive(u.id, u.is_active)}
                            className={`text-sm px-3 py-1 rounded ${u.is_active ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}
                          >
                            {u.is_active ? '禁用' : '启用'}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="text-sm px-3 py-1 rounded bg-red-500 text-white"
                          >
                            删除
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 添加用户弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-md">
            <h2 className="font-bold text-xl mb-4">添加新用户</h2>
            
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="label">用户名</label>
                <input
                  type="text"
                  className="input"
                  value={newUser.username}
                  onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                  required
                />
              </div>
              
              <div>
                <label className="label">密码</label>
                <input
                  type="password"
                  className="input"
                  value={newUser.password}
                  onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                  required
                />
              </div>
              
              <div>
                <label className="label">角色</label>
                <select
                  className="input"
                  value={newUser.role}
                  onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value }))}
                >
                  <option value="employee">👤 员工</option>
                  <option value="admin">👑 管理员</option>
                </select>
              </div>
              
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">添加</button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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