import { useState, useEffect } from 'react'
import { GenerateKeyPair, LoadKeys, GenerateLicense, SaveLicense, GetOutputDir, ExportArchive } from './wailsjs/go/main/App'

interface KeyPair {
  privateKey: string
  publicKey: string
}

const durationOptions = [
  { label: '1个月', value: 1 },
  { label: '3个月', value: 3 },
  { label: '6个月', value: 6 },
  { label: '1年', value: 12 },
  { label: '2年', value: 24 },
  { label: '3年', value: 36 },
]

function App() {
  const [customerName, setCustomerName] = useState('')
  const [hardwareFingerprint, setHardwareFingerprint] = useState('')
  const [durationType, setDurationType] = useState<'limited' | 'unlimited'>('limited')
  const [selectedDuration, setSelectedDuration] = useState<number>(12)
  const [customMonths, setCustomMonths] = useState('')
  const [keyPair, setKeyPair] = useState<KeyPair | null>(null)
  const [licenseContent, setLicenseContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedKey, setCopiedKey] = useState<'private' | 'public' | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [customUnit, setCustomUnit] = useState<'months' | 'years'>('months')
  const [configJson, setConfigJson] = useState('')

  useEffect(() => {
    loadKeys()
  }, [])

  const loadKeys = async () => {
    try {
      const result = await LoadKeys()
      if (result) setKeyPair(result)
    } catch { /* */ }
  }

  const handleGenerateKeyPair = async () => {
    try {
      setMessage(null)
      const result = await GenerateKeyPair()
      setKeyPair(result)
      setMessage({ type: 'success', text: '密钥对创建成功！' })
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '创建密钥对失败' })
    }
  }

  const handleGenerateLicense = async () => {
    if (!customerName.trim()) {
      setMessage({ type: 'error', text: '请填写客户名称' })
      return
    }
    if (!hardwareFingerprint.trim()) {
      setMessage({ type: 'error', text: '请填写机器指纹' })
      return
    }
    if (!keyPair) {
      setMessage({ type: 'error', text: '请先创建密钥对' })
      return
    }

    setIsGenerating(true)
    setMessage(null)
    try {
      const now = new Date()
      const startDate = now.toISOString()
      let endDate = ''
      if (durationType === 'limited') {
        let months = 0
        if (selectedDuration > 0) {
          months = selectedDuration
        } else if (customMonths) {
          months = customUnit === 'years' ? parseInt(customMonths) * 12 : parseInt(customMonths)
        }
        if (months > 0) {
          const end = new Date(now)
          end.setMonth(end.getMonth() + months)
          endDate = end.toISOString()
        }
      }

      const result = await GenerateLicense(customerName, hardwareFingerprint, startDate, endDate)
      setLicenseContent(result)
      setMessage({ type: 'success', text: '许可证生成成功！' })
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '生成许可证失败' })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = async () => {
    if (!licenseContent) return
    try {
      await navigator.clipboard.writeText(licenseContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setMessage({ type: 'error', text: '复制失败' })
    }
  }

  const handleCopyKey = async (type: 'private' | 'public') => {
    if (!keyPair) return
    try {
      await navigator.clipboard.writeText(type === 'private' ? keyPair.privateKey : keyPair.publicKey)
      setCopiedKey(type)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      setMessage({ type: 'error', text: '复制失败' })
    }
  }

  const handleDownload = async () => {
    if (!licenseContent || !customerName) return
    try {
      const filename = `license_${customerName}.lic`
      await SaveLicense(licenseContent, filename)
      const outputDir = await GetOutputDir()
      setMessage({ type: 'success', text: `已保存到: ${outputDir}/${filename}` })
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '下载失败' })
    }
  }

  const handleExportArchive = async () => {
    if (!licenseContent || !customerName) return
    try {
      const tempDir = await ExportArchive(licenseContent, customerName)
      setMessage({ type: 'success', text: `存档已导出到: ${tempDir}` })
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '导出失败' })
    }
  }

  const previewLicense = () => {
    if (!licenseContent) return null
    try {
      return atob(licenseContent)
    } catch {
      return licenseContent
    }
  }

  const handleQuickSelect = (value: number) => {
    setSelectedDuration(value)
    setCustomMonths('')
  }

  const handleCustomChange = (value: string) => {
    setCustomMonths(value)
    if (value) {
      setSelectedDuration(0)
    }
  }

  return (
    <div className="app-shell">
      <div className="app-bg" aria-hidden="true">
        <div className="app-bg-gradient" />
        <div className="app-bg-blob app-bg-blob-1" />
        <div className="app-bg-blob app-bg-blob-2" />
      </div>

      {message && (
        <div className={`toast toast-${message.type}`}>
          <span>{message.text}</span>
          <button type="button" className="toast-close" onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      <header className="app-header">
        <div className="app-title-row">
          <h1 className="app-title">Cedar许可证生成工具</h1>
          <span className="app-version">v1.0.0</span>
        </div>
        <a className="app-link" href="https://www.cedar-v.com" target="_blank" rel="noopener noreferrer">
          www.cedar-v.com
        </a>
      </header>

      <main className="app-main">
        <div className="form-card">
          <div className="sdk-hint">
            <span className="sdk-hint-icon">&#x1F4D6;</span>
            <span className="sdk-hint-text">
              客户端接入可使用 <a href="https://github.com/cedar-v" target="_blank" rel="noopener noreferrer">Cedar-v LicenseManager</a> 相关 SDK
            </span>
          </div>

          <div className="form-toolbar">
            <button type="button" className="btn-pill" onClick={handleExportArchive}>
              下载存档
            </button>
            <button type="button" className="btn-rect" onClick={handleGenerateKeyPair}>
              创建密钥对
            </button>
          </div>

          <section className="form-section">
            <h2 className="section-heading">
              <span className="section-accent" aria-hidden="true" />
              客户名称
            </h2>
            <input
              className="text-input text-input-full"
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="请填写客户名称"
            />
          </section>

          <section className="form-section">
            <h2 className="section-heading">
              <span className="section-accent" aria-hidden="true" />
              机器指纹（取决于客户端的实现）
            </h2>
            <input
              className="text-input text-input-full"
              type="text"
              value={hardwareFingerprint}
              onChange={(e) => setHardwareFingerprint(e.target.value)}
              placeholder="请输入设备硬件指纹"
            />
          </section>

          <section className="form-section">
            <h2 className="section-heading section-heading-sub">
              <span className="section-accent" aria-hidden="true" />
              密钥配置
            </h2>
            <div className="key-grid">
              <div className="key-col">
                <div className="key-title-row">
                  <span className="key-title">私钥</span>
                  {keyPair && (
                    <button
                      type="button"
                      className="key-copy-btn"
                      onClick={() => handleCopyKey('private')}
                    >
                      {copiedKey === 'private' ? '已复制' : '复制'}
                    </button>
                  )}
                </div>
                <div className="key-box">
                  {keyPair ? (
                    <span className="key-snippet">{keyPair.privateKey.slice(0, 80)}…</span>
                  ) : (
                    <span className="key-placeholder">点击创建密钥对生成</span>
                  )}
                </div>
              </div>
              <div className="key-col">
                <div className="key-title-row">
                  <span className="key-title">公钥</span>
                  {keyPair && (
                    <button
                      type="button"
                      className="key-copy-btn"
                      onClick={() => handleCopyKey('public')}
                    >
                      {copiedKey === 'public' ? '已复制' : '复制'}
                    </button>
                  )}
                </div>
                <div className="key-box">
                  {keyPair ? (
                    <span className="key-snippet">{keyPair.publicKey.slice(0, 80)}…</span>
                  ) : (
                    <span className="key-placeholder">点击创建密钥对生成</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="form-section">
            <h2 className="section-heading section-heading-sub">
              <span className="section-accent" aria-hidden="true" />
              授权时间
            </h2>
            <div className="key-grid">
              <div className="key-col">
                <div className="toggle-row">
                  <button
                    type="button"
                    className={`toggle-cell ${durationType === 'limited' ? 'is-on' : ''}`}
                    onClick={() => setDurationType('limited')}
                  >
                    有期限
                  </button>
                  <div className="toggle-sep" />
                  <button
                    type="button"
                    className={`toggle-cell ${durationType === 'unlimited' ? 'is-on' : ''}`}
                    onClick={() => setDurationType('unlimited')}
                  >
                    无期限
                  </button>
                </div>
              </div>
            </div>

            {durationType === 'limited' && (
              <>
                <p className="field-hint">快速选择时长</p>
                <div className="quick-grid">
                  {durationOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`quick-cell ${selectedDuration === opt.value ? 'is-on' : ''}`}
                      onClick={() => handleQuickSelect(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="field-hint">自定义时长</p>
                <div className="custom-row">
                  <div className="custom-combo">
                    <input
                      className="custom-num"
                      type="number"
                      min={1}
                      max={999}
                      value={customMonths}
                      onChange={(e) => handleCustomChange(e.target.value)}
                      placeholder="请输入期限数"
                    />
                    <button
                      type="button"
                      className="custom-unit"
                      onClick={() => setShowDropdown((v) => !v)}
                    >
                      {customUnit === 'months' ? '个月' : '年'}
                      <span className="custom-chevron">▼</span>
                    </button>
                    {showDropdown && (
                      <div className="custom-menu">
                        <button type="button" onClick={() => { setCustomUnit('months'); setShowDropdown(false) }}>个月</button>
                        <button type="button" onClick={() => { setCustomUnit('years'); setShowDropdown(false) }}>年</button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="form-section">
            <h2 className="section-heading section-heading-sub">
              <span className="section-accent" aria-hidden="true" />
              功能配置
            </h2>
            <div className="config-json-section">
              <textarea
                className="config-json-input"
                value={configJson}
                onChange={(e) => setConfigJson(e.target.value)}
                placeholder="请输入 JSON 格式的功能配置"
                rows={4}
              />
            </div>
          </section>

          <div className="form-actions">
            <button
              type="button"
              className="btn-generate"
              onClick={handleGenerateLicense}
              disabled={isGenerating}
            >
              {isGenerating ? '生成中…' : '生成许可证'}
            </button>
          </div>

          <div className="preview-panel">
            <div className="preview-bar">
              <span className="preview-title">许可证内容</span>
              <div className="preview-btns">
                <button type="button" className="preview-chip" onClick={handleCopy}>
                  {copied ? '已复制' : '复制'}
                </button>
                <button type="button" className="preview-chip" onClick={handleDownload}>
                  下载
                </button>
              </div>
            </div>
            <pre className="preview-body">
              {previewLicense() || '填写信息后点击「生成许可证」预览内容'}
            </pre>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
