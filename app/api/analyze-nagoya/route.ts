import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Lazy initialization to avoid build-time errors
function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

function getAnthropic() {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })
}

function getGoogleAI() {
  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new Error('Google AI API key is not configured')
  }
  return new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY)
}

const SYSTEM_PROMPT = `あなたは「名古屋のご意見番」として振る舞う、辛口で派手好きなAIキャラクターです。
ユーザーから送られてきた画像を、独自の「名古屋ばえ基準」で分析し、100点満点で採点し、名古屋弁でコメントしてください。

**キャラクター設定:**
- 一人称は「わっち」、語尾は「だがね」「だわ」「してみゃー」など、コテコテの名古屋弁を使う。
- 基本的に上から目線で辛口だが、良いもの(派手なもの)は手放しで褒める。
- 質素、地味、シンプルを嫌う。「ケチくさい」が一番の悪口。

**名古屋ばえ採点基準(以下の要素が強いほど高得点):**
1. **ボリューム感**: 食べ物ならデカ盛り、髪型なら盛り髪。物理的なデカさは正義。
2. **色の濃さ**: 茶色い(味噌色)、金色(ゴールド)、原色の組み合わせ。地味な色は減点。
3. **ブランド主張**: ロゴがデカい、一目で高いと分かる高級品が写っている。
4. **コテコテ度**: やりすぎ感、情報量の多さ、ギラギラした加工。

**レスポンス形式(必ずJSONで返してください):**
{
  "score": ボリューム、色、ブランド、コテコテ度を総合判断した0〜100の整数,
  "title": "写真に付けるキャッチコピー(例:味噌カツ級の衝撃！)",
  "comment": "名古屋弁での辛口コメント(100文字程度)。なぜその点数なのかの理由と、もっと名古屋っぽくするためのアドバイスを含めること。",
  "vibe_tags": ["#茶色は正義", "#盛りすぎ注意", "#ロゴドン"] などのハッシュタグを3つ生成
}`

async function analyzeWithOpenAI(image: string) {
  const openai = getOpenAI()
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'この画像の名古屋ばえ度を採点してください',
          },
          {
            type: 'image_url',
            image_url: {
              url: image,
            },
          },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 1000,
  })

  const result = response.choices[0].message.content
  if (!result) {
    throw new Error('AIからのレスポンスが空です')
  }

  return JSON.parse(result)
}

async function analyzeWithClaude(image: string, modelName?: string) {
  const anthropic = getAnthropic()

  // Extract base64 data from data URL
  const base64Data = image.split(',')[1]
  const mediaTypeMatch = image.match(/data:(.*?);/)?.[1] || 'image/jpeg'

  // Map to supported media types
  const mediaType = (
    mediaTypeMatch === 'image/png' ? 'image/png' :
    mediaTypeMatch === 'image/gif' ? 'image/gif' :
    mediaTypeMatch === 'image/webp' ? 'image/webp' :
    'image/jpeg'
  ) as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

  const response = await anthropic.messages.create({
    model: modelName || 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
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
            text: 'この画像の名古屋ばえ度を採点してください。必ずJSON形式で返答してください。',
          },
        ],
      },
    ],
  })

  const result = response.content[0]
  if (result.type !== 'text') {
    throw new Error('AIからのレスポンスが不正です')
  }

  // Extract JSON from response (Claude might wrap it in markdown code blocks)
  let jsonText = result.text.trim()
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```$/, '')
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```$/, '')
  }

  return JSON.parse(jsonText)
}

async function analyzeWithGemini(image: string) {
  const genAI = getGoogleAI()
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  // Extract base64 data from data URL
  const base64Data = image.split(',')[1]
  const mimeType = image.match(/data:(.*?);/)?.[1] || 'image/jpeg'

  const result = await model.generateContent([
    {
      inlineData: {
        data: base64Data,
        mimeType,
      },
    },
    SYSTEM_PROMPT + '\n\nこの画像の名古屋ばえ度を採点してください。必ずJSON形式で返答してください。',
  ])

  const response = await result.response
  const text = response.text()

  // Extract JSON from response (Gemini might wrap it in markdown code blocks)
  let jsonText = text.trim()
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```$/, '')
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```$/, '')
  }

  return JSON.parse(jsonText)
}

export async function POST(request: NextRequest) {
  try {
    const { image, provider = 'openai' } = await request.json()

    if (!image) {
      return NextResponse.json(
        { error: '画像が送信されていません' },
        { status: 400 }
      )
    }

    let parsedResult

    switch (provider) {
      case 'openai': {
        if (!process.env.OPENAI_API_KEY) {
          return NextResponse.json(
            { error: 'OpenAI API キーが設定されていません' },
            { status: 500 }
          )
        }
        parsedResult = await analyzeWithOpenAI(image)
        break
      }
      case 'claude-haiku': {
        if (!process.env.ANTHROPIC_API_KEY) {
          return NextResponse.json(
            { error: 'Anthropic API キーが設定されていません' },
            { status: 500 }
          )
        }
        parsedResult = await analyzeWithClaude(image, 'claude-haiku-4-5-20251001')
        break
      }
      case 'claude-sonnet': {
        if (!process.env.ANTHROPIC_API_KEY) {
          return NextResponse.json(
            { error: 'Anthropic API キーが設定されていません' },
            { status: 500 }
          )
        }
        parsedResult = await analyzeWithClaude(image, 'claude-sonnet-4-5-20250929')
        break
      }
      case 'gemini': {
        if (!process.env.GOOGLE_AI_API_KEY) {
          return NextResponse.json(
            { error: 'Google AI API キーが設定されていません' },
            { status: 500 }
          )
        }
        parsedResult = await analyzeWithGemini(image)
        break
      }
      default:
        return NextResponse.json(
          { error: '無効なAIプロバイダーが指定されました' },
          { status: 400 }
        )
    }

    return NextResponse.json(parsedResult)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error analyzing image:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { 
        error: '画像の分析中にエラーが発生しました',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    )
  }
}
