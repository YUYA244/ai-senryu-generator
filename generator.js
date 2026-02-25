import fs from 'fs';
import fetch from 'node-fetch';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';

// .envファイルの読み込み
dotenv.config();

// ES Modules形式で動作するため、ディレクトリパスの解決を念のため入れておきます
const DATA_DIR = path.resolve('data');
const DATA_FILE = path.join(DATA_DIR, 'senryu_today.json');

async function generateDailySenryu() {
    console.log("=== AI風刺川柳 自動生成処理を開始します ===");

    // APIキーが存在するかチェック
    if (!process.env.NEWS_API_KEY || !process.env.GEMINI_API_KEY) {
        console.error("❌ エラー: NEWS_API_KEY または GEMINI_API_KEY が .env ファイルに設定されていません。");
        return;
    }

    try {
        // --- 1. 3日前〜前日のニュースを取得 ---
        console.log("🌐 ニュースを取得中...");

        // 過去の日付文字列 "YYYY-MM-DD" を取得する関数
        const getDaysAgoString = (daysAgo) => {
            const date = new Date();
            date.setDate(date.getDate() - daysAgo);
            return date.toISOString().split('T')[0];
        };

        const fromDate = getDaysAgoString(3);
        const toDate = getDaysAgoString(1);

        // NewsAPI: 日本のニュースを取得
        const newsApiUrl = `https://newsapi.org/v2/top-headlines?country=jp&apiKey=${process.env.NEWS_API_KEY}`;
        // ※ 検索キーワードを入れる場合は以下のように everything エンドポイントを使います
        // const newsApiUrl = `https://newsapi.org/v2/everything?q=日本 OR 政治 OR 経済&language=ja&from=${fromDate}&to=${toDate}&sortBy=popularity&apiKey=${process.env.NEWS_API_KEY}`;

        const response = await fetch(newsApiUrl);
        const newsData = await response.json();

        if (newsData.status !== "ok" || !newsData.articles || newsData.articles.length === 0) {
            console.error("❌ ニュースの取得に失敗したか、記事が見つかりませんでした。");
            return;
        }

        // 最新のニュースから一番適していそうなものをピックアップ（ここでは1件目）
        const topNews = newsData.articles[0];
        console.log(`🗞️ ピックアップしたニュース: ${topNews.title}`);


        // --- 2. Gemini API を使って川柳を生成 ---
        console.log("🤖 Geminiで川柳を生成中...");

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // 軽量かつ高速な gemini-1.5-flash モデルを使用
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
            あなたは日本に住む、少し皮肉屋でユーモアのある隠居です。
            以下の最近のニュースに基づいて、ユーモアと少しの皮肉を交えた風刺川柳（5・7・5）を作成してください。

            ニュースタイトル: ${topNews.title}
            内容: ${topNews.description || '詳細なし'}

            以下のJSON形式で出力してください：
            {
                "senryu": "〇〇〇\\n〇〇〇〇〇〇〇\\n〇〇〇",
                "explanation": "なぜこの川柳を作ったのかの短い解説（面白い皮肉を込めて）"
            }
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Geminiの返答からJSON部分のみを抽出（```json と ``` で囲まれている場合を考慮）
        let aiResultStr = responseText.trim();
        if (aiResultStr.startsWith('```json')) {
            aiResultStr = aiResultStr.replace(/^```json/, '').replace(/```$/, '').trim();
        } else if (aiResultStr.startsWith('```')) {
            aiResultStr = aiResultStr.replace(/^```/, '').replace(/```$/, '').trim();
        }

        const aiResult = JSON.parse(aiResultStr);

        // --- 3. 生成したデータをJSONファイルとして保存 ---
        const finalData = {
            date: new Date().toISOString().split('T')[0],
            senryu: aiResult.senryu,
            explanation: aiResult.explanation,
            news_title: topNews.title,
            news_url: topNews.url
        };

        // dataディレクトリがなければ作成
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR);
        }

        fs.writeFileSync(DATA_FILE, JSON.stringify(finalData, null, 2));

        console.log("✅ 今日の川柳データを保存しました:");
        console.log(finalData);

    } catch (error) {
        console.error("❌ エラーが発生しました:", error);
    }
}

// 実行する
generateDailySenryu();
