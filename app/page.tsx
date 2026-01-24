'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface AnalysisResult {
  score: number
  title: string
  comment: string
  vibe_tags: string[]
}

type AIProvider = 'openai' | 'claude' | 'gemini'

export default function Home() {
  const [image, setImage] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [provider, setProvider] = useState<AIProvider>('openai')

  const handleImageUpload = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      setImage(e.target?.result as string)
      setResult(null)
      setError(null)
    }
    reader.readAsDataURL(file)
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

    try {
      const response = await fetch('/api/analyze-nagoya', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image, provider }),
      })

      if (!response.ok) {
        throw new Error('分析に失敗しました')
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError('エラーが発生しました。もう一度お試しください。')
      console.error(err)
    } finally {
      setAnalyzing(false)
    }
  }

  const reset = () => {
    setImage(null)
    setResult(null)
    setError(null)
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

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* ヘッダー */}
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <h1 className="text-6xl md:text-8xl font-black mb-4 text-stroke">
            <span className="text-gradient-gold">名古屋ばえ</span>
            <br />
            <span className="text-white">スカウター</span>
          </h1>
          <p className="text-xl md:text-2xl text-nagoya-gold font-bold tracking-wider">
            NAGOYA VIBE CHECK
          </p>
          <p className="text-sm md:text-base text-gray-300 mt-2">
            その写真、でら名古屋だがね！
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
                  className="border-4 border-dashed border-nagoya-gold rounded-xl p-12 text-center bg-black/50 backdrop-blur-sm hover:border-nagoya-red transition-colors cursor-pointer neon-glow"
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="text-6xl mb-4">📸</div>
                    <p className="text-2xl font-bold text-nagoya-gold mb-2">
                      写真をアップロード
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
                <div className="bg-black/70 rounded-xl p-6 border-4 border-nagoya-gold neon-glow">
                  <img
                    src={image}
                    alt="アップロード画像"
                    className="w-full rounded-lg mb-4"
                  />

                  {/* AI選択 */}
                  <div className="mb-4">
                    <p className="text-nagoya-gold font-bold mb-2 text-center">
                      使うAIを選んでちょ！
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setProvider('openai')}
                        className={`py-3 px-2 rounded-lg font-bold transition-all ${
                          provider === 'openai'
                            ? 'bg-gradient-to-r from-nagoya-gold to-yellow-600 text-black scale-105 border-2 border-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        <div className="text-2xl mb-1">🤖</div>
                        <div className="text-xs">OpenAI</div>
                        <div className="text-xs">GPT-4o</div>
                      </button>
                      <button
                        onClick={() => setProvider('claude')}
                        className={`py-3 px-2 rounded-lg font-bold transition-all ${
                          provider === 'claude'
                            ? 'bg-gradient-to-r from-nagoya-purple to-pink-600 text-white scale-105 border-2 border-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        <div className="text-2xl mb-1">🎭</div>
                        <div className="text-xs">Claude</div>
                        <div className="text-xs">3.5 Sonnet</div>
                      </button>
                      <button
                        onClick={() => setProvider('gemini')}
                        className={`py-3 px-2 rounded-lg font-bold transition-all ${
                          provider === 'gemini'
                            ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white scale-105 border-2 border-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        <div className="text-2xl mb-1">✨</div>
                        <div className="text-xs">Gemini</div>
                        <div className="text-xs">1.5 Flash</div>
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={analyzeImage}
                      disabled={analyzing}
                      className="flex-1 bg-gradient-to-r from-nagoya-gold to-yellow-600 text-black text-xl font-black py-4 rounded-lg hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100"
                    >
                      {analyzing ? '診断中...' : '名古屋ばえ診断スタート！'}
                    </button>
                    <button
                      onClick={reset}
                      className="px-6 bg-gray-700 text-white font-bold rounded-lg hover:bg-gray-600 transition-colors"
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
            className="max-w-3xl mx-auto"
          >
            <div className="bg-gradient-to-br from-black via-purple-900 to-black border-8 border-nagoya-gold rounded-xl p-8 neon-glow">
              {/* スコア表示 */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: 'spring' }}
                className="text-center mb-8"
              >
                <div className="relative inline-block">
                  <motion.div
                    animate={{
                      boxShadow: [
                        '0 0 20px #FFD700',
                        '0 0 60px #FFD700',
                        '0 0 20px #FFD700',
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-9xl font-black text-gradient-gold mb-4"
                  >
                    {result.score}
                  </motion.div>
                  <div className="text-4xl font-bold text-white">点</div>
                </div>
              </motion.div>

              {/* タイトル */}
              <motion.div
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="bg-tiger-stripe p-4 mb-6 rounded-lg"
              >
                <h2 className="text-3xl font-black text-center text-white text-stroke">
                  {result.title}
                </h2>
              </motion.div>

              {/* コメント */}
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="bg-black/70 border-4 border-nagoya-red rounded-lg p-6 mb-6"
              >
                <p className="text-xl leading-relaxed text-white">
                  {result.comment}
                </p>
              </motion.div>

              {/* タグ */}
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="flex flex-wrap gap-3 mb-6"
              >
                {result.vibe_tags.map((tag, index) => (
                  <motion.span
                    key={index}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 1 + index * 0.1 }}
                    className="bg-gradient-to-r from-nagoya-purple to-pink-600 px-4 py-2 rounded-full text-white font-bold text-sm"
                  >
                    {tag}
                  </motion.span>
                ))}
              </motion.div>

              {/* リセットボタン */}
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 1.2 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={reset}
                className="w-full bg-gradient-to-r from-nagoya-red to-red-700 text-white text-xl font-black py-4 rounded-lg hover:shadow-2xl transition-all"
              >
                もう一回診断する！
              </motion.button>
            </div>
          </motion.div>
        )}
      </div>
    </main>
  )
}
