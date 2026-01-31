'use client'

import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface AnalysisResult {
  score: number
  title: string
  comment: string
  vibe_tags: string[]
}

type AIProvider = 'claude-haiku' | 'claude-sonnet'

interface CharacterGenResult {
  characterUrl: string
  description?: string
  modelUsed?: string
}

// 画像を圧縮してbase64に変換する関数
const compressImage = (file: File, maxSizeMB: number = 4.5): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img

        // サイズを縮小
        const maxDimension = 2000
        if (width > height) {
          if (width > maxDimension) {
            height = (height * maxDimension) / width
            width = maxDimension
          }
        } else {
          if (height > maxDimension) {
            width = (width * maxDimension) / height
            height = maxDimension
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas context failed'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        // 品質を調整しながら圧縮
        let quality = 0.9
        let dataUrl = canvas.toDataURL('image/jpeg', quality)

        // サイズが指定値以下になるまで品質を下げる
        while (dataUrl.length > maxSizeMB * 1024 * 1024 && quality > 0.1) {
          quality -= 0.1
          dataUrl = canvas.toDataURL('image/jpeg', quality)
        }

        if (dataUrl.length > maxSizeMB * 1024 * 1024) {
          reject(new Error(`画像が大きすぎます。${maxSizeMB}MB以下にしてください。`))
          return
        }

        resolve(dataUrl)
      }
      img.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'))
    reader.readAsDataURL(file)
  })
}

export default function Home() {
  const [image, setImage] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [provider, setProvider] = useState<AIProvider>('claude-haiku')
  const [showCropModal, setShowCropModal] = useState(false)
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 })
  const [isDrawing, setIsDrawing] = useState(false)
  const [startCoords, setStartCoords] = useState({ x: 0, y: 0 })
  const [imgWidth, setImgWidth] = useState(0)
  const [imgHeight, setImgHeight] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [originalImage, setOriginalImage] = useState<string | null>(null)
  const [cropFrameSize] = useState({ width: 300, height: 300 })  // 固定フレームサイズ
  const [character, setCharacter] = useState<CharacterGenResult | null>(null)
  const [generatingChar, setGeneratingChar] = useState(false)
  const [characterError, setCharacterError] = useState<string | null>(null)
  const [charProvider, setCharProvider] = useState<'gemini' | 'openai'>('gemini')
  const [charModel, setCharModel] = useState<string>('gemini-2.5-flash-image')
  const [autoGenerateAfterScore, setAutoGenerateAfterScore] = useState<boolean>(true)
  const [showCharSettings, setShowCharSettings] = useState(false)
  const [showStartCharSettings, setShowStartCharSettings] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [showDownloadModal, setShowDownloadModal] = useState(false)
  const resultCardRef = useRef<HTMLDivElement | null>(null)
  const charImageRef = useRef<HTMLImageElement | null>(null)

  const handleImageUpload = useCallback(async (file: File) => {
    try {
      setError(null)
      const compressedImage = await compressImage(file)
      setImage(compressedImage)
      setResult(null)
        setCharacter(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '画像の処理に失敗しました'
      setError(errorMessage)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file && file.type.startsWith('image/')) {
        handleImageUpload(file)
      }
    },
    [handleImageUpload]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleImageUpload(file)
      }
    },
    [handleImageUpload]
  )

  const analyzeImage = async () => {
    if (!image) return

    setAnalyzing(true)
    setError(null)
    setCharacter(null)
    setCharacterError(null)

    try {
      const response = await fetch('/api/analyze-nagoya', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image, provider }),
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMessage = data.details || data.error || '分析に失敗しました'
        throw new Error(errorMessage)
      }

      setResult(data)
      // スコア後の自動キャラ生成（任意）
      if (autoGenerateAfterScore) {
        // 非同期で実行（分析結果の表示をブロックしない）
        generateCharacter()
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'エラーが発生しました。もう一度お試しください。'
      setError(errorMessage)
      console.error('Analysis error:', err)
    } finally {
      setAnalyzing(false)
    }
  }

  const generateCharacter = async () => {
    if (!image) return
    setGeneratingChar(true)
    setCharacterError(null)
    setCharacter(null)
    try {
      const res = await fetch('/api/generate-character', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image, generator: charProvider, model: charModel }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.details || data.error || 'キャラクター生成に失敗しました')
      }

      setCharacter({ characterUrl: data.characterUrl, description: data.description })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'キャラクター生成に失敗しました'
      setCharacterError(msg)
    } finally {
      setGeneratingChar(false)
    }
  }

  const reset = () => {
    setImage(null)
    setResult(null)
    setError(null)
    setShowCropModal(false)
    setShareError(null)
    setCharacter(null)
  }

  const handleDownloadCard = async (downloadType: 'full' | 'character') => {
    try {
      setShareError(null)
      const { toPng } = await import('html-to-image')
      
      let dataUrl: string
      let filename: string
      
      if (downloadType === 'full' && resultCardRef.current) {
        // 結果カード全体の固定幅で PNG 変換
        dataUrl = await toPng(resultCardRef.current, { 
          pixelRatio: 2, 
          cacheBust: true,
          width: resultCardRef.current.offsetWidth,
          height: resultCardRef.current.offsetHeight,
        })
        filename = 'nagoya-vibe-card.png'
      } else if (downloadType === 'character' && charImageRef.current) {
        dataUrl = await toPng(charImageRef.current, { 
          pixelRatio: 2, 
          cacheBust: true,
          width: charImageRef.current.offsetWidth,
          height: charImageRef.current.offsetHeight,
        })
        filename = 'nagoya-character.png'
      } else {
        setShareError('ダウンロードする画像がありません')
        return
      }
      
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      setShowDownloadModal(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ダウンロードに失敗しました'
      setShareError(msg)
    }
  }

  const handleShareCard = async () => {
    if (!resultCardRef.current) {
      setShareError('共有するカードがありません')
      return
    }
    setShareError(null)
    try {
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(resultCardRef.current, { pixelRatio: 2, cacheBust: true })

      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const file = new File([blob], 'nagoya-vibe-card.png', { type: 'image/png' })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: '名古屋ばえスカウター',
          text: result ? `スコア: ${result.score}点` : '名古屋ばえスカウター',
        })
      } else {
        setShareError('このブラウザでは共有機能が利用できません')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '共有に失敗しました'
      setShareError(msg)
    }
  }

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    const displayWidth = img.width
    const displayHeight = img.height
    setImgWidth(displayWidth)
    setImgHeight(displayHeight)
    setCropOffset({ x: 0, y: 0 })
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setIsDrawing(true)
    setStartCoords({ x, y })
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = e.currentTarget
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const deltaX = x - startCoords.x
    const deltaY = y - startCoords.y

    setCropOffset((prev) => ({
      x: prev.x + deltaX,
      y: prev.y + deltaY,
    }))

    setStartCoords({ x, y })
  }

  const handleMouseUp = () => {
    setIsDrawing(false)
  }

  const applyCrop = () => {
    if (!originalImage) {
      setError('画像が見つかりません')
      return
    }

    const canvas = document.createElement('canvas')
    const img = new Image()

    img.onload = async () => {
      try {
        // キャンバスサイズを設定（フレームサイズ）
        canvas.width = cropFrameSize.width
        canvas.height = cropFrameSize.height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          setError('キャンバス処理に失敗しました')
          return
        }

        // 画像をズーム＆オフセット位置で描画
        const scaledWidth = imgWidth * zoom
        const scaledHeight = imgHeight * zoom

        ctx.drawImage(
          img,
          cropOffset.x,
          cropOffset.y,
          scaledWidth,
          scaledHeight
        )

        const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.9)
        
        // base64形式をFileに変換して圧縮
        const arr = croppedDataUrl.split(',')
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg'
        const bstr = atob(arr[1])
        const n = bstr.length
        const u8arr = new Uint8Array(n)
        for (let i = 0; i < n; i++) {
          u8arr[i] = bstr.charCodeAt(i)
        }
        const file = new File([u8arr], 'cropped.jpg', { type: mime })
        
        const compressed = await compressImage(file)
        setImage(compressed)
        setShowCropModal(false)
        setResult(null)
        setZoom(1)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'トリミングに失敗しました'
        setError(errorMessage)
      }
    }

    img.onerror = () => {
      setError('画像の読み込みに失敗しました')
    }

    img.src = originalImage
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-black via-purple-900 to-black overflow-hidden">
      {/* 背景装飾 */}
      <div className="fixed inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-32 h-32 tiger-stripe" />
        <div className="absolute top-0 right-0 w-32 h-32 tiger-stripe" />
        <div className="absolute bottom-0 left-0 w-32 h-32 tiger-stripe" />
        <div className="absolute bottom-0 right-0 w-32 h-32 tiger-stripe" />
      </div>

      <div className="relative z-10 container mx-auto max-w-7xl px-3 md:px-4 py-2 md:py-2">
        {/* ヘッダー */}
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-1.5 md:mb-2"
        >
          <div className="inline-block bg-gradient-to-r from-nagoya-gold via-yellow-300 to-nagoya-gold p-1.5 md:p-2 rounded-lg shadow-[0_0_25px_rgba(255,215,0,0.6)] border-2 border-white/40">
            <h1 className="text-2xl md:text-4xl font-black text-black drop-shadow-lg leading-tight whitespace-nowrap">
              名古屋ばえスカウター
            </h1>
          </div>
          <p className="mt-0.5 text-xs md:text-sm text-nagoya-gold font-bold tracking-wider">
            NAGOYA VIBE CHECK
          </p>
        </motion.div>

        {!result ? (
          <>
            {/* 画像アップロードエリア */}
            {!image ? (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="max-w-2xl mx-auto"
              >
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="border-3 border-dashed border-nagoya-gold rounded-lg p-4 md:p-5 text-center bg-black/50 backdrop-blur-sm hover:border-nagoya-red transition-colors cursor-pointer neon-glow"
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="text-4xl mb-1">📸</div>
                    <p className="text-base font-bold text-nagoya-gold">
                      画像をやりる
                    </p>
                    <p className="text-gray-400">
                      ドラッグ＆ドロップ または クリックして選択
                    </p>
                  </label>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="max-w-2xl mx-auto"
              >
                <div className="bg-black/70 rounded-xl p-4 border-4 border-nagoya-gold neon-glow">
                  <img
                    src={image}
                    alt="アップロード画像"
                    onLoad={handleImageLoad}
                    className="w-full max-w-sm mx-auto rounded-lg mb-4"
                  />

                  {/* トリミングボタン */}
                  <button
                    onClick={() => {
                      setShowCropModal(true)
                      setOriginalImage(image)
                      setZoom(1)
                    }}
                    className="w-full mb-3 bg-purple-600 text-white font-bold py-1.5 px-3 text-sm rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    ✂️ トリミング
                  </button>

                  {/* AI選択 */}
                  <div className="mb-2">
                    <p className="text-nagoya-gold font-bold mb-2 text-center text-xs">
                      使うAIを選んでちょ！
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setProvider('claude-haiku')}
                        className={`py-2 px-2 rounded-lg font-bold text-xs transition-all ${
                          provider === 'claude-haiku'
                            ? 'bg-gradient-to-r from-nagoya-gold to-yellow-600 text-black scale-105 border-2 border-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        <div className="text-xl mb-0.5">🎭</div>
                        <div className="text-[10px]">Claude</div>
                        <div className="text-[10px]">Haiku</div>
                      </button>
                      <button
                        onClick={() => setProvider('claude-sonnet')}
                        className={`py-2 px-2 rounded-lg font-bold text-xs transition-all ${
                          provider === 'claude-sonnet'
                            ? 'bg-gradient-to-r from-nagoya-purple to-pink-600 text-white scale-105 border-2 border-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        <div className="text-xl mb-0.5">🎭</div>
                        <div className="text-[10px]">Claude</div>
                        <div className="text-[10px]">Sonnet</div>
                      </button>
                    </div>
                  </div>

                  {/* 事前キャラ生成設定（任意、デフォルト非表示） */}
                  <div className="mb-3 bg-black/60 border border-white/10 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-nagoya-gold font-bold">キャラクター生成の設定（任意）</p>
                      <button
                        onClick={() => setShowStartCharSettings((v) => !v)}
                        className="text-[11px] px-2 py-1 rounded border border-white/20 text-white hover:bg-white/10"
                      >
                        {showStartCharSettings ? '設定を閉じる' : '設定を開く'}
                      </button>
                    </div>
                    {showStartCharSettings && (
                      <div className="space-y-3 mt-3">
                        {/* プロバイダー選択 */}
                        <div>
                          <label className="block text-xs text-gray-300 mb-2">プロバイダー</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => setCharProvider('gemini')}
                              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                                charProvider === 'gemini'
                                  ? 'bg-blue-600 text-white border-2 border-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                            >
                              🎨 Gemini
                            </button>
                            <button
                              onClick={() => setCharProvider('openai')}
                              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                                charProvider === 'openai'
                                  ? 'bg-green-600 text-white border-2 border-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                            >
                              🖼️ OpenAI
                            </button>
                          </div>
                        </div>
                        {/* モデル選択 */}
                        {charProvider === 'gemini' && (
                          <div>
                            <label className="block text-xs text-gray-300 mb-2">Gemini モデル</label>
                            <select
                              className="w-full bg-gray-800 text-white border border-white/10 rounded-lg p-2 text-xs"
                              value={charModel}
                              onChange={(e) => setCharModel(e.target.value)}
                            >
                              <option value="gemini-2.5-flash-image">gemini-2.5-flash-image</option>
                              <option value="gemini-3-pro-image-preview">gemini-3-pro-image-preview</option>
                            </select>
                          </div>
                        )}
                        {charProvider === 'openai' && (
                          <div className="text-xs text-gray-400">
                            📌 OpenAI gpt-image-1 を使用します
                          </div>
                        )}
                        {/* 自動生成トグル */}
                        <div className="flex items-center gap-2 bg-gray-800 text-white border border-white/10 rounded-lg p-2 text-xs">
                          <input
                            id="auto-gen-toggle"
                            type="checkbox"
                            className="accent-nagoya-gold"
                            checked={autoGenerateAfterScore}
                            onChange={(e) => setAutoGenerateAfterScore(e.target.checked)}
                          />
                          <label htmlFor="auto-gen-toggle" className="cursor-pointer select-none">
                            スコア後に自動でキャラ生成
                          </label>
                        </div>
                      </div>
                    )}
                    <p className="text-[11px] text-gray-400 mt-2">※ API 利用料が発生する場合があります。</p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={analyzeImage}
                      disabled={analyzing}
                      className="flex-1 bg-gradient-to-r from-nagoya-gold to-yellow-600 text-black text-base md:text-lg font-black py-3 rounded-lg hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100"
                    >
                      {analyzing ? '診断中...' : '名古屋ばえ診断スタート！'}
                    </button>
                    <button
                      onClick={reset}
                      className="px-4 bg-gray-700 text-white font-bold text-sm rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      戻る
                    </button>
                  </div>
                  {error && (
                    <p className="text-red-500 mt-4 text-center">{error}</p>
                  )}
                </div>
              </motion.div>
            )}

            {/* ローディングアニメーション */}
            <AnimatePresence>
              {analyzing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
                >
                  <div className="text-center">
                    <motion.div
                      animate={{
                        rotate: 360,
                        scale: [1, 1.2, 1],
                      }}
                      transition={{
                        rotate: { duration: 2, repeat: Infinity, ease: 'linear' },
                        scale: { duration: 1, repeat: Infinity },
                      }}
                      className="text-8xl mb-4"
                    >
                      🏯
                    </motion.div>
                    <motion.p
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="text-3xl font-bold text-nagoya-gold"
                    >
                      名古屋ばえ度を測定中...
                    </motion.p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          /* 結果表示 */
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', duration: 0.8 }}
            className="max-w-5xl mx-auto"
          >
            <div
              ref={resultCardRef}
              className="bg-gradient-to-br from-black via-purple-900 to-black border-6 border-nagoya-gold rounded-xl p-2 md:p-3 neon-glow space-y-2"
            >
              {/* タイトル + スコア ヘッダー */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                {/* タイトル（2列分） */}
                <motion.div
                  initial={{ x: -100, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="bg-tiger-stripe p-2 rounded md:col-span-2"
                >
                  <h2 
                    className="text-base md:text-lg font-black text-center text-white"
                    style={{
                      textShadow: '3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 10px rgba(255,255,255,0.5)'
                    }}
                  >
                    {result.title}
                  </h2>
                </motion.div>

                {/* スコア表示（右側） */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: 'spring' }}
                  className="relative flex flex-col items-center justify-center bg-gradient-to-br from-yellow-600 via-yellow-500 to-yellow-600 rounded-xl p-1 border-4 border-yellow-400 shadow-2xl"
                  style={{
                    background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 25%, #FFD700 50%, #FFA500 75%, #FFD700 100%)',
                    backgroundSize: '200% 200%',
                  }}
                >
                  {/* 内側フレーム */}
                  <div className="w-full bg-gradient-to-br from-black via-purple-900 to-black rounded-lg p-3 border-2 border-yellow-300">
                    <div className="text-center space-y-1">
                      <motion.div
                        animate={{
                          boxShadow: [
                            '0 0 30px #FFD700',
                            '0 0 80px #FFD700',
                            '0 0 30px #FFD700',
                          ],
                          textShadow: [
                            '0 0 10px #FFD700, 0 0 20px #FFD700',
                            '0 0 20px #FFD700, 0 0 40px #FFD700',
                            '0 0 10px #FFD700, 0 0 20px #FFD700',
                          ]
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="text-6xl md:text-7xl font-black text-gradient-gold drop-shadow-2xl"
                      >
                        {result.score}
                      </motion.div>
                      <div className="text-xl md:text-2xl font-black text-yellow-300 tracking-wider" style={{ textShadow: '0 0 10px #FFD700, 2px 2px 4px rgba(0,0,0,0.8)' }}>点</div>
                    </div>
                  </div>
                  {/* 装飾用コーナー */}
                  <div className="absolute top-0 left-0 w-3 h-3 bg-red-600 rounded-tl-lg border-t-2 border-l-2 border-yellow-300"></div>
                  <div className="absolute top-0 right-0 w-3 h-3 bg-red-600 rounded-tr-lg border-t-2 border-r-2 border-yellow-300"></div>
                  <div className="absolute bottom-0 left-0 w-3 h-3 bg-red-600 rounded-bl-lg border-b-2 border-l-2 border-yellow-300"></div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-red-600 rounded-br-lg border-b-2 border-r-2 border-yellow-300"></div>
                </motion.div>
              </div>

              {/* 3列レイアウト：画像 + キャラ + コメント */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {/* 入力画像表示（左） */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="flex flex-col items-center gap-2"
                >
                  <img
                    src={image || ''}
                    alt="分析した画像"
                    className="w-full max-w-xs md:max-w-sm mx-auto rounded-lg border-4 border-nagoya-gold shadow-xl"
                  />
                </motion.div>

                {/* キャラクター生成パネル（中央） */}
                <motion.div
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="bg-black/70 border-4 border-nagoya-purple rounded-lg p-2 space-y-2 flex flex-col"
                >
                  <div className="flex items-center justify-between mb-1 gap-1">
                    <h3 className="text-sm md:text-base font-bold text-nagoya-gold whitespace-nowrap">🎨 キャラ</h3>
                    <button
                      onClick={() => setShowCharSettings((v) => !v)}
                      className="text-[11px] px-2 py-1 rounded border border-white/20 text-white hover:bg-white/10 shrink-0"
                    >
                      {showCharSettings ? '設定を閉じる' : '設定を開く'}
                    </button>
                  </div>

                  {/* プロバイダー＆モデル選択 */}
                  {showCharSettings && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      <div>
                        <label className="block text-xs text-gray-300 font-bold mb-1">プロバイダー</label>
                        <div className="grid grid-cols-2 gap-1">
                          <button
                            onClick={() => setCharProvider('gemini')}
                            className={`py-1 px-2 rounded text-xs font-bold transition-all ${
                              charProvider === 'gemini'
                                ? 'bg-blue-600 text-white border border-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                          >
                            Gemini
                          </button>
                          <button
                            onClick={() => setCharProvider('openai')}
                            className={`py-1 px-2 rounded text-xs font-bold transition-all ${
                              charProvider === 'openai'
                                ? 'bg-green-600 text-white border border-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                          >
                            OpenAI
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-300 font-bold mb-1">モデル</label>
                        {charProvider === 'gemini' ? (
                          <select
                            className="w-full bg-gray-800 text-white border border-white/10 rounded p-1 text-xs"
                            value={charModel}
                            onChange={(e) => setCharModel(e.target.value)}
                          >
                            <option value="gemini-2.5-flash-image">gemini-2.5-flash-image</option>
                            <option value="gemini-3-pro-image-preview">gemini-3-pro-image-preview</option>
                          </select>
                        ) : (
                          <div className="w-full bg-gray-800 text-gray-400 border border-white/10 rounded p-1 text-xs">
                            gpt-image-1
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 生成ボタン */}
                  <button
                    onClick={generateCharacter}
                    disabled={generatingChar}
                    className="w-full bg-gradient-to-r from-nagoya-purple to-pink-600 text-white font-bold py-2 text-sm rounded hover:scale-105 transition-transform disabled:opacity-60 disabled:scale-100"
                  >
                    {generatingChar ? '生成中...' : '✨ 生成'}
                  </button>

                  {/* エラーメッセージ */}
                  {characterError && (
                    <div className="bg-red-900/30 border border-red-500/50 rounded p-2 text-xs text-red-300">
                      {characterError}
                    </div>
                  )}

                  {/* 生成結果 */}
                  {character ? (
                    <div className="space-y-1.5 pt-2 border-t border-white/10 flex-1" ref={charImageRef}>
                      <img
                        src={character.characterUrl}
                        alt="生成キャラクター"
                        className="w-full max-h-48 object-contain rounded-lg border-2 border-nagoya-gold shadow-lg"
                      />
                      {character.modelUsed && (
                        <div className="bg-gray-800 rounded-lg p-1.5 text-xs text-gray-300 text-center">
                          📊 <span className="text-nagoya-gold font-bold">{character.modelUsed}</span>
                        </div>
                      )}
                      {character.description && (
                        <div className="bg-gray-900 rounded-lg p-2 text-xs border border-nagoya-gold/30 w-full">
                          <p className="font-bold text-yellow-300 mb-0.5">特徴:</p>
                          <p className="text-[10px] text-gray-100 leading-relaxed whitespace-normal break-words w-full">{character.description}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-400 text-xs text-center p-4">
                      キャラを生成するとここに表示されます
                    </div>
                  )}
                </motion.div>

                {/* コメント + タグ（右） */}
                <div className="space-y-2 flex flex-col">
                  {/* コメント */}
                  <motion.div
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    className="bg-gradient-to-br from-gray-900 via-black to-gray-900 border-4 border-nagoya-red rounded-lg p-3 flex-1 shadow-xl"
                  >
                    <p className="text-sm leading-relaxed font-bold text-white" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>
                      {result.comment}
                    </p>
                  </motion.div>

                  {/* タグ */}
                  <motion.div
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.9 }}
                    className="flex flex-wrap gap-1"
                  >
                    {result.vibe_tags.map((tag, index) => (
                      <motion.span
                        key={index}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 1 + index * 0.1 }}
                        className="bg-gradient-to-r from-nagoya-purple to-pink-600 px-2 py-0.5 rounded-full text-white font-bold text-[10px]"
                      >
                        #{tag}
                      </motion.span>
                    ))}
                  </motion.div>
                </div>
              </div>

              {shareError && (
                <p className="text-red-400 text-xs text-center">{shareError}</p>
              )}

              <div className="grid md:grid-cols-3 gap-2">
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1.1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowDownloadModal(true)}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-black py-2 rounded hover:shadow-2xl transition-all"
                >
                  💾 保存
                </motion.button>

                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1.15 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleShareCard}
                  className="w-full bg-gradient-to-r from-nagoya-gold to-yellow-500 text-black text-sm font-black py-2 rounded hover:shadow-2xl transition-all"
                >
                  🔗 共有
                </motion.button>

                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1.2 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={reset}
                  className="w-full bg-gradient-to-r from-nagoya-red to-red-700 text-white text-sm font-black py-2 rounded hover:shadow-2xl transition-all"
                >
                  もう一回診断する！
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ダウンロードオプションモーダル */}
        <AnimatePresence>
          {showDownloadModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
              onClick={() => setShowDownloadModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: -20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: -20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-gradient-to-br from-black via-purple-900 to-black border-4 border-nagoya-gold rounded-xl p-6 max-w-sm w-full shadow-2xl"
              >
                <h2 className="text-xl font-bold text-nagoya-gold mb-4 text-center">
                  💾 何を保存しますか？
                </h2>

                <div className="space-y-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleDownloadCard('full')}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold py-3 rounded-lg hover:shadow-2xl transition-all"
                  >
                    📋 カード全体
                  </motion.button>

                  {character && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleDownloadCard('character')}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 rounded-lg hover:shadow-2xl transition-all"
                    >
                      🎨 キャラクターのみ
                    </motion.button>
                  )}

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowDownloadModal(false)}
                    className="w-full bg-gray-700 text-white font-bold py-3 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    キャンセル
                  </motion.button>
                </div>

                {shareError && (
                  <p className="text-red-400 text-xs mt-3 text-center">{shareError}</p>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* トリミングモーダル */}
        <AnimatePresence>
          {showCropModal && image && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
              onClick={() => setShowCropModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-black border-4 border-nagoya-gold rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-auto"
              >
                <h2 className="text-2xl font-bold text-nagoya-gold mb-4">
                  ✂️ 画像をトリミング
                </h2>
                <p className="text-gray-300 mb-4 text-sm">
                  トリミング範囲をドラッグして選択してください
                </p>

                {/* ズームスライダー */}
                <div className="mb-4 bg-gray-800 p-3 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <label className="text-gray-300 font-bold min-w-fit">🔍 ズーム:</label>
                    <input
                      type="range"
                      min="0.5"
                      max="3"
                      step="0.1"
                      value={zoom}
                      onChange={(e) => setZoom(parseFloat(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-nagoya-gold font-bold min-w-fit">{zoom.toFixed(1)}x</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    画像をドラッグして位置を調整してください
                  </p>
                </div>

                {/* トリミングキャンバス */}
                <div className="mb-4 bg-gray-950 rounded-lg flex justify-center p-4 relative" style={{ minHeight: '400px' }}>
                  <div className="relative" style={{ width: cropFrameSize.width, height: cropFrameSize.height, overflow: 'hidden', border: '3px solid #FFD700', borderRadius: '8px' }}>
                    <canvas
                      ref={(canvas) => {
                        if (canvas && originalImage) {
                          const img = new Image()
                          img.onload = () => {
                            const ctx = canvas.getContext('2d')
                            if (!ctx) return

                            canvas.width = cropFrameSize.width
                            canvas.height = cropFrameSize.height

                            // 背景を暗くする
                            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
                            ctx.fillRect(0, 0, canvas.width, canvas.height)

                            // ズーム＆オフセット位置で画像を描画
                            const scaledWidth = imgWidth * zoom
                            const scaledHeight = imgHeight * zoom
                            ctx.drawImage(
                              img,
                              cropOffset.x,
                              cropOffset.y,
                              scaledWidth,
                              scaledHeight
                            )
                          }
                          img.src = originalImage
                        }
                      }}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      style={{ cursor: isDrawing ? 'grabbing' : 'grab', display: 'block' }}
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={applyCrop}
                    className="flex-1 bg-gradient-to-r from-nagoya-gold to-yellow-600 text-black font-bold py-3 rounded-lg hover:scale-105 transition-transform"
                  >
                    ✓ 決定
                  </button>
                  <button
                    onClick={() => setShowCropModal(false)}
                    className="flex-1 bg-gray-700 text-white font-bold py-3 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}
