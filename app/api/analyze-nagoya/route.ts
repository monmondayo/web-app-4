import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json()

    if (!image) {
      return NextResponse.json(
        { error: '画像が送信されていません' },
        { status: 400 }
      )
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `あなたは「名古屋のご意見番」として振る舞う、辛口で派手好きなAIキャラクターです。
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
}`,
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

    const parsedResult = JSON.parse(result)

    return NextResponse.json(parsedResult)
  } catch (error) {
    console.error('Error analyzing image:', error)
    return NextResponse.json(
      { error: '画像の分析中にエラーが発生しました' },
      { status: 500 }
    )
  }
}
