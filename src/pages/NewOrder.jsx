import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function NewOrder() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('quote')
  const [formData, setFormData] = useState({
    order_id: '',
    length: '',
    width: '',
    height: '',
    weight: '',
    quantity: 1,
    recipient_name: '',
    country: '',
    province: '',
    city: '',
    zipcode: '',
    address: '',
    phone: '',
    notes: ''
  })

  // 自动计算
  const calcResult = (() => {
    const l = parseFloat(formData.length) || 0
    const w = parseFloat(formData.width) || 0
    const h = parseFloat(formData.height) || 0
    const wt = parseFloat(formData.weight) || 0
    const q = parseInt(formData.quantity) || 1
    
    const totalVolumeCm = l * w * h * q
    const totalVolumeM = totalVolumeCm / 1000000
    const totalWeight = wt * q
    const volumeWeight = totalVolumeCm / 5000
    const chargeWeight = Math.max(totalWeight, volumeWeight)
    
    return { totalVolumeM, totalWeight, volumeWeight, chargeWeight }
  })()

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          status,
          length: parseFloat(formData.length),
          width: parseFloat(formData.width),
          height: parseFloat(formData.height),
          weight: parseFloat(formData.weight),
          quantity: parseInt(formData.quantity),
          charge_weight: calcResult.chargeWeight
        })
      })

      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || '创建失败')
      }

      alert('✅ 订单创建成功！邮件已发送。')
      navigate('/')
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
          <h1 className="text-white font-bold text-lg">📦 新建订单</h1>
          <button
            onClick={() => navigate('/')}
            className="text-white/80 hover:text-white text-sm"
          >
            ← 返回列表
          </button>
        </div>
      </nav>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-4 space-y-4">
        {/* 订单信息 */}
        <div className="card">
          <h2 className="font-bold text-lg mb-4 border-b pb-2">📋 订单信息</h2>
          
          <div className="space-y-4">
            <div>
              <label className="label">订单号 <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="order_id"
                className="input"
                value={formData.order_id}
                onChange={handleChange}
                placeholder="例如: ORD-20260317-001"
                required
              />
            </div>
            
            <div>
              <label className="label">订单状态 <span className="text-red-500">*</span></label>
              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setStatus('quote')}
                  className={`flex-1 py-3 rounded-lg font-medium border-2 transition-all ${
                    status === 'quote'
                      ? 'bg-orange-50 border-orange-400 text-orange-700'
                      : 'border-gray-200 text-gray-500'
                  }`}
                >
                  💰 报价中
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('ordered')}
                  className={`flex-1 py-3 rounded-lg font-medium border-2 transition-all ${
                    status === 'ordered'
                      ? 'bg-green-50 border-green-400 text-green-700'
                      : 'border-gray-200 text-gray-500'
                  }`}
                >
                  ✅ 已下单
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 货物信息 */}
        <div className="card">
          <h2 className="font-bold text-lg mb-4 border-b pb-2">📦 货物信息</h2>
          
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">长 (cm)</label>
                <input
                  type="number"
                  name="length"
                  className="input"
                  value={formData.length}
                  onChange={handleChange}
                  step="0.1"
                  placeholder="长"
                  required
                />
              </div>
              <div>
                <label className="label">宽 (cm)</label>
                <input
                  type="number"
                  name="width"
                  className="input"
                  value={formData.width}
                  onChange={handleChange}
                  step="0.1"
                  placeholder="宽"
                  required
                />
              </div>
              <div>
                <label className="label">高 (cm)</label>
                <input
                  type="number"
                  name="height"
                  className="input"
                  value={formData.height}
                  onChange={handleChange}
                  step="0.1"
                  placeholder="高"
                  required
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">单件重量 (kg)</label>
                <input
                  type="number"
                  name="weight"
                  className="input"
                  value={formData.weight}
                  onChange={handleChange}
                  step="0.01"
                  placeholder="单件重量"
                  required
                />
              </div>
              <div>
                <label className="label">件数</label>
                <input
                  type="number"
                  name="quantity"
                  className="input"
                  value={formData.quantity}
                  onChange={handleChange}
                  min="1"
                  required
                />
              </div>
            </div>
            
            {/* 计算结果 */}
            <div className="bg-purple-50 rounded-lg p-4 mt-4">
              <h3 className="font-medium text-purple-800 mb-3">📊 自动计算</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">总体积:</span>
                  <span className="font-medium">{calcResult.totalVolumeM.toFixed(4)} m³</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">总重量:</span>
                  <span className="font-medium">{calcResult.totalWeight.toFixed(2)} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">体积重:</span>
                  <span className="font-medium">{calcResult.volumeWeight.toFixed(2)} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">计费重量:</span>
                  <span className="font-bold text-purple-700 text-lg">{calcResult.chargeWeight.toFixed(2)} kg</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 收件人信息 */}
        <div className="card">
          <h2 className="font-bold text-lg mb-4 border-b pb-2">📍 收件人信息</h2>
          
          <div className="space-y-4">
            <div>
              <label className="label">收件人姓名 <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="recipient_name"
                className="input"
                value={formData.recipient_name}
                onChange={handleChange}
                placeholder="收件人全名"
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">国家 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="country"
                  className="input"
                  value={formData.country}
                  onChange={handleChange}
                  placeholder="国家"
                  required
                />
              </div>
              <div>
                <label className="label">省/州</label>
                <input
                  type="text"
                  name="province"
                  className="input"
                  value={formData.province}
                  onChange={handleChange}
                  placeholder="省/州"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">市</label>
                <input
                  type="text"
                  name="city"
                  className="input"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="城市"
                />
              </div>
              <div>
                <label className="label">邮编</label>
                <input
                  type="text"
                  name="zipcode"
                  className="input"
                  value={formData.zipcode}
                  onChange={handleChange}
                  placeholder="邮编"
                />
              </div>
            </div>
            
            <div>
              <label className="label">具体地址</label>
              <input
                type="text"
                name="address"
                className="input"
                value={formData.address}
                onChange={handleChange}
                placeholder="街道、门牌号等"
              />
            </div>
            
            <div>
              <label className="label">联系方式</label>
              <input
                type="text"
                name="phone"
                className="input"
                value={formData.phone}
                onChange={handleChange}
                placeholder="手机/电话"
              />
            </div>
          </div>
        </div>

        {/* 备注 */}
        <div className="card">
          <h2 className="font-bold text-lg mb-4 border-b pb-2">📝 备注</h2>
          <input
            type="text"
            name="notes"
            className="input"
            value={formData.notes}
            onChange={handleChange}
            placeholder="其他需要说明的信息"
          />
        </div>

        {/* 提交按钮 */}
        <button
          type="submit"
          className="btn-primary"
          disabled={loading}
        >
          {loading ? '提交中...' : '提交订单'}
        </button>
      </form>
    </div>
  )
}