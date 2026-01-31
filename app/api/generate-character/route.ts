import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const runtime = 'nodejs'

// Lazy initialization to avoid build-time errors when env vars are missing
function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

const getGoogleAI = () => {
  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new Error('Google AI API キーが設定されていません')
  }
  return new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY)
}

const GEMINI_IMAGE_MODELS = new Set([
  'gemini-2.5-flash-image',
  'gemini-3-pro-image-preview',
])

async function describeImageWithClaude(image: string) {
  // Extract base64 data and mime
  const base64Data = image.split(',')[1]
  const mediaTypeMatch = image.match(/data:(.*?);/)?.[1] || 'image/jpeg'
  const mediaType = (
    mediaTypeMatch === 'image/png' ? 'image/png' :
    mediaTypeMatch === 'image/gif' ? 'image/gif' :
    mediaTypeMatch === 'image/webp' ? 'image/webp' :
    'image/jpeg'
  ) as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

  const anthropic = getAnthropic()
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 180,
    system:
      'あなたは画像を60語以内で要約し、主体・色・服装・アクセサリー・雰囲気を短く列挙します。絵文字や装飾は不要。',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Data,
            },
          },
          {
            type: 'text',
            text: 'この画像をキャラクター化のヒントとして60語以内で要約してください。',
          },
        ],
      },
    ],
  })

  const first = response.content[0]
  if (!first || first.type !== 'text') throw new Error('Claude要約が空です')
  return first.text.trim()
}

async function generateCharacterImage(description: string) {
  const prompt = `Create a kawaii, glittery Nagoya-inspired mascot character. Use elements from this description: ${description}. Style: chibi, gold accents, rich colors, lively expression. Avoid realism; no text overlay.`

  const openai = getOpenAI()
  const img = await openai.images.generate({
    model: 'gpt-image-1',
    prompt,
    size: '1024x1024',
    quality: 'high',
  } as any)

  const url = img.data?.[0]?.url
  if (!url) throw new Error('Image generation failed')
  return { url, modelUsed: 'OpenAI gpt-image-1' }
}

async function generateCharacterImageWithGemini(modelName: string, description: string) {
  if (!GEMINI_IMAGE_MODELS.has(modelName)) {
    throw new Error('未対応のGemini画像生成モデルです')
  }
  const prompt = `Create a kawaii, glittery Nagoya-inspired mascot character. Use elements from this description: ${description}. Style: chibi, gold accents, rich colors, lively expression. Avoid realism; no text overlay.`

  const genAI = getGoogleAI()
  const model = genAI.getGenerativeModel({ model: modelName })

  // 画像生成モデルはパーツとして画像データを返す場合があります
  const result = await model.generateContent([{ text: prompt } as any])
  const response = await result.response
  // まず candidates → content.parts を探索
  const parts: any[] = (response as any)?.candidates?.[0]?.content?.parts || []
  // inlineData（base64）または fileData（URI）に対応
  const imagePart = parts.find((p) => p.inlineData?.data || p.fileData?.fileUri)
  if (imagePart?.inlineData?.data) {
    return { url: `data:${imagePart.inlineData.mimeType || 'image/png'};base64,${imagePart.inlineData.data}`, modelUsed: `Gemini ${modelName}` }
  }
  if (imagePart?.fileData?.fileUri) {
    return { url: imagePart.fileData.fileUri as string, modelUsed: `Gemini ${modelName}` }
  }

  // パーツに画像がない場合、当該モデルが画像出力しなかった可能性
  throw new Error('このGeminiモデルは画像を返しませんでした。"gemini-2.5-flash-image" を推奨します。')
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API キーが設定されていません' },
        { status: 500 }
      )
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API キーが設定されていません' },
        { status: 500 }
      )
    }

    const { image, generator = 'openai', model } = await request.json()
    if (!image) {
      return NextResponse.json(
        { error: '画像が送信されていません' },
        { status: 400 }
      )
    }

    const description = await describeImageWithClaude(image)
    let characterUrl: string
    let modelUsed: string
    if (generator === 'gemini') {
      if (!process.env.GOOGLE_AI_API_KEY) {
        return NextResponse.json(
          { error: 'Google AI API キーが設定されていません' },
          { status: 500 }
        )
      }
      const modelName = typeof model === 'string' ? model : 'gemini-2.5-flash-image'
      try {
        const result = await generateCharacterImageWithGemini(modelName, description)
        characterUrl = result.url
        modelUsed = result.modelUsed
      } catch (err) {
        const emsg = err instanceof Error ? err.message : String(err)
        // Geminiの429/クォータ超過時はフォールバック
        const isQuota = /429|Too\s*Many\s*Requests|quota|rate\s*limit/i.test(emsg)
        if (isQuota) {
          // 代替のGemini画像モデルに切替を試行
          const altModel = modelName === 'gemini-2.5-flash-image' ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image'
          try {
            const result = await generateCharacterImageWithGemini(altModel, description)
            characterUrl = result.url
            modelUsed = result.modelUsed
          } catch (err2) {
            const emsg2 = err2 instanceof Error ? err2.message : String(err2)
            // Geminiが両方ダメならOpenAIへフォールバック
            console.warn('Gemini quota exceeded; falling back to OpenAI. Details:', emsg, emsg2)
            const result = await generateCharacterImage(description)
            characterUrl = result.url
            modelUsed = result.modelUsed
          }
        } else {
          throw err
        }
      }
    } else {
      const result = await generateCharacterImage(description)
      characterUrl = result.url
      modelUsed = result.modelUsed
    }

    return NextResponse.json({ characterUrl, description, modelUsed })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Error generating character:', msg)
    return NextResponse.json(
      {
        error: 'キャラクター生成に失敗しました',
        details: process.env.NODE_ENV === 'development' ? msg : undefined,
      },
      { status: 500 }
    )
  }
}
