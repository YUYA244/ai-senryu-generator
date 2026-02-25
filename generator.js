import fs from 'fs';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const DATA_DIR = path.resolve('data');
const DATA_FILE = path.join(DATA_DIR, 'senryu_today.json');

async function generateDailySenryu() {
    console.log("=== AI風刺川柳 自動生成処理を開始します ===");

    if (!process.env.GEMINI_API_KEY) {
        console.error("❌ エラー: GEMINI_API_KEY が設定されていません。");
        return;
    }

    try {
        // --- 1. Yahoo!ニュース(RSS)から最新ニュースを取得 ---
        console.log("🌐 ニュースを取得中...");
        
        const rssUrl = 'https://news.yahoo.co.jp/rss/topics/top-picks.xml';
        const response = await fetch(rssUrl);
        const xmlText = await response.text();
        
        const items = xmlText.split('<item>');
        if (items.length < 2) {
            console.error("❌ ニュースが見つかりませんでした。");
            return;
        }

        const firstItem = items[1];
        const titleMatch = firstItem.match(/<title>(.*?)<\/title>/);
        const linkMatch = firstItem.match(/<link>(.*?)<\/link>/);

        if (!titleMatch || !linkMatch) {
            console.error("❌ ニュースの解析に失敗しました。");
            return;
        }

        const topNews = {
            title: titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1'),
            url: linkMatch[1]
        };
        console.log(`🗞️ ピックアップしたニュース: ${topNews.title}`);


        // --- 2. Gemini 本体と直接通信して川柳を生成！ ---
        console.log("🤖 Geminiで川柳を生成中...");
        
        const prompt = `
            あなたは日本に住む、少し皮肉屋でユーモアのある隠居です。
            以下の最近のニュースのタイトルから内容を推測し、ユーモアと少しの皮肉を交えた風刺川柳（5・7・5）を作成してください。

            ニュースタイトル: ${topNews.title}

            以下のJSON形式で出力してください：
            {
                "senryu": "〇〇〇\\n〇〇〇〇〇〇〇\\n〇〇〇",
                "explanation": "なぜこの川柳を作ったのかの短い解説（面白い皮肉を込めて）"
            }
        `;

        // 🛡️ セキュリティ対策: URLにキーを含めるのをやめ、安全なヘッダー(x-goog-api-key)に隠して送ります
        const apiKey = process.env.GEMINI_API_KEY.trim();
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent`;

        const geminiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey  // ←ここが安全な鍵穴です
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        // サーバーエラー時にエラー詳細を確認（ここでもキーは表示されません）
        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error(`❌ Gemini API エラー (${geminiResponse.status}):`, errorText);
            return;
        }

        const data = await geminiResponse.json();
        let aiResultStr = data.candidates[0].content.parts[0].text.trim();
        
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

        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR);
        }

        fs.writeFileSync(DATA_FILE, JSON.stringify(finalData, null, 2));
        console.log("✅ 今日の川柳データを保存しました:");
        console.log(finalData);

    } catch (error) {
        console.error("❌ 予期せぬエラーが発生しました:", error);
    }
}

generateDailySenryu();

