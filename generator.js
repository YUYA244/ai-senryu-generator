import fs from 'fs';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const DATA_DIR = path.resolve('data');
const DATA_FILE = path.join(DATA_DIR, 'senryu_today.json');

async function generateDailySenryu() {
    console.log("=== AI風刺川柳 自動生成処理を開始します (Claude版) ===");

    if (!process.env.ANTHROPIC_API_KEY) {
        console.error("❌ エラー: ANTHROPIC_API_KEY が設定されていません。");
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


        // --- 2. Claude API を使って川柳を生成！ ---
        console.log("🤖 Claudeで川柳を生成中...");
        
        const prompt = `
あなたは日本に住む、少し皮肉屋でユーモアのある隠居です。
以下の最近のニュースのタイトルから内容を推測し、ユーモアと少しの皮肉を交えた風刺川柳（5・7・5）を作成してください。

ニュースタイトル: ${topNews.title}

以下のJSON形式で出力してください。JSON以外の文章は絶対に含めないでください：
{
    "senryu": "〇〇〇\\n〇〇〇〇〇〇〇\\n〇〇〇",
    "explanation": "なぜこの川柳を作ったのかの短い解説（面白い皮肉を込めて）"
}
`;

        // ClaudeのAPIと直接通信
        const apiKey = process.env.ANTHROPIC_API_KEY.trim();
        const claudeUrl = `https://api.anthropic.com/v1/messages`;

        const claudeResponse = await fetch(claudeUrl, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: "claude-haiku-4-5", // 2026年最新の高速モデル「Haiku 4.5」を使用
                max_tokens: 500,
                messages: [
                    { role: "user", content: prompt }
                ]
            })
        });

        if (!claudeResponse.ok) {
            const errorText = await claudeResponse.text();
            console.error(`❌ Claude API エラー (${claudeResponse.status}):`, errorText);
            return;
        }

        const data = await claudeResponse.json();
        let aiResultStr = data.content[0].text.trim();
        
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
