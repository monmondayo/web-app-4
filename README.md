# 名古屋ばえスカウター (NAGOYA VIBE CHECK)

「その写真、でら名古屋だがね!」

ユーザーがアップロードした写真の「名古屋っぽさ(名古屋ばえ)」をAIが独断と偏見で採点する、エンタメWebアプリです。
<img width="2048" height="1286" alt="nagoya-vibe-card (1)" src="https://github.com/user-attachments/assets/3c5052fd-c220-4b83-870c-b57cd862059d" />

## 🎯 コンセプト

ファッション、グルメ、風景など、あらゆる写真に潜む「名古屋的な要素(派手さ、ボリューム、色の濃さ、ブランド主張)」をAIが検知し、辛口の名古屋弁で採点・コメントします。

## ✨ 特徴

- 📸 **画像アップロード**: ドラッグ&ドロップまたはファイル選択
- 🤖 **複数AI対応**: OpenAI GPT-4o、Claude 3.5 Sonnet、Gemini 1.5 Flashから選択可能
- 🎯 **UI上で選択**: 使いたいAIをその場で選べる
- 💬 **名古屋弁コメント**: 「わっち」が辛口で採点
- 🎨 **派手な演出**: パチンコ台風のド派手なデザイン
- ✨ **アニメーション**: Framer Motionによる豪華な演出
- 🎭 **キャラクター生成**: 診断画像からオリジナルマスコットキャラを自動生成
  - OpenAI DALL-E 3 または Gemini画像生成モデルを選択可能

## 🛠️ 技術スタック

- **Frontend**: Next.js 16 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS
- **Animation**: Framer Motion
- **AI**:
  - OpenAI API (GPT-4o / DALL-E 3)
  - Anthropic API (Claude 3.5 Sonnet / Claude Haiku)
  - Google AI API (Gemini 2.0 Flash / Gemini画像生成)

## 📦 セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example`をコピーして`.env`ファイルを作成し、使いたいAI APIキーを設定してください:

```bash
cp .env.example .env
```

`.env`ファイルに以下を記入（**使いたいAIのキーのみ設定すればOK**）:

```env
# OpenAI API (GPT-4o)
OPENAI_API_KEY=your_openai_api_key_here

# Anthropic API (Claude)
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Google AI API (Gemini)
GOOGLE_AI_API_KEY=your_google_ai_api_key_here
```

#### APIキーの取得方法

- **OpenAI**: [OpenAI Platform](https://platform.openai.com/api-keys)
- **Anthropic (Claude)**: [Anthropic Console](https://console.anthropic.com/)
- **Google AI (Gemini)**: [Google AI Studio](https://makersuite.google.com/app/apikey)

#### おすすめ

- **Claude Haiku**: 高速で軽量、実用的な分析に最適
- **Claude Sonnet**: 高品質な画像分析、詳細な評価が必要な場合
- **Gemini 2.0 Flash**: 無料枠あり、高速で試しやすい
- **GPT-4o**: 既存のOpenAIアカウントがあればすぐに使える

### 3. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで[http://localhost:3000](http://localhost:3000)を開いてアプリを確認できます。

## 🎮 使い方

1. トップページで写真をアップロード(ドラッグ&ドロップまたはクリック)
2. **使いたいAIを選択** 🤖🎭✨
   - 🤖 **OpenAI GPT-4o**: 定番の高精度AI
   - 🎭 **Claude**: Anthropicの高品質分析（複数モデル対応）
   - ✨ **Gemini**: Googleの高速AI
3. 「名古屋ばえ診断スタート!」ボタンをクリック
4. AIが分析中...🏯
5. 結果が派手に表示されます!
   - **スコア**: 0〜100点
   - **キャッチコピー**: 写真の印象
   - **辛口コメント**: 名古屋弁での評価とアドバイス
   - **#ハッシュタグ**: 名古屋ばえ要素

## 🏆 名古屋ばえ採点基準

AIは以下の基準で採点します:

1. **ボリューム感** (物理的なデカさは正義)
2. **色の濃さ** (茶色、金色、原色が高得点)
3. **ブランド主張** (ロゴがデカい、高級品)
4. **コテコテ度** (やりすぎ感、情報量の多さ)

## 🚀 本番環境へのデプロイ

### Vercelへのデプロイ

1. [Vercel](https://vercel.com)にログイン
2. プロジェクトをインポート
3. **Environment Variables** を設定（使いたいAI APIのキーのみ設定）:
   - `OPENAI_API_KEY` (OpenAI使用時)
   - `ANTHROPIC_API_KEY` (Claude使用時)
   - `GOOGLE_AI_API_KEY` (Gemini使用時)
4. デプロイ!

**注**: `.env` ファイルはリポジトリに含まれていません。Vercel上で環境変数を設定してください。

## 📝 ライセンス

MIT

## 🎉 楽しみ方

- 名古屋メシの写真で高得点を狙おう!
- 派手なファッションで診断してみよう!
- シンプルすぎる写真でAIにツッコミをもらおう!

---

**でら名古屋だがね!** 🏯✨
