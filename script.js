document.addEventListener('DOMContentLoaded', () => {
    const senryuDisplay = document.getElementById('senryu-display');
    const explanationDisplay = document.getElementById('explanation-display');
    const newsSourceDisplay = document.getElementById('news-source-display');
    const shareBtn = document.getElementById('share-x-btn');
    const dateDisplay = document.getElementById('current-date');

    // 本日の日付を表示 (日本のタイムゾーン基準)
    const today = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' };
    dateDisplay.textContent = today.toLocaleDateString('ja-JP', options);

    let currentSenryuText = '';

    // 川柳データの取得処理
    async function fetchTodaySenryu() {
        try {
            // 自動生成されたJSONファイルを取得（キャッシュを避けるためにタイムスタンプ付与）
            const response = await fetch(`data/senryu_today.json?t=${new Date().getTime()}`);
            if (!response.ok) {
                throw new Error("データが見つかりませんでした");
            }
            const data = await response.json();

            // データ描画
            renderSenryu(data);

        } catch (error) {
            console.error("川柳の取得に失敗しました:", error);
            // エラー時はフォールバックのメッセージを表示
            senryuDisplay.innerHTML = `
                <div class="senryu-text">
                    <p>詠み込みに</p>
                    <p>失敗をして</p>
                    <p>詫びる朝</p>
                </div>
            `;
            explanationDisplay.innerHTML = `<p>システムの不具合により今日の川柳が取得できませんでした。しばらく時間をおいてお試しください。</p>`;
        }
    }

    // 画面への描画
    function renderSenryu(data) {
        // 5・7・5を想定し、改行で分割して3つのpタグにする
        const lines = data.senryu.split('\n');
        let senryuHtml = '<div class="senryu-text">';
        lines.forEach(line => {
            senryuHtml += `<p>${line}</p>`;
        });
        senryuHtml += '</div>';

        // X(Twitter)シェア用のスペース区切りテキスト
        currentSenryuText = data.senryu.replace(/\n/g, ' ');

        // アニメーション付きでフェードイン
        senryuDisplay.style.opacity = '0';
        setTimeout(() => {
            senryuDisplay.innerHTML = senryuHtml;
            explanationDisplay.innerHTML = `<p>${data.explanation}</p>`;

            if (data.news_title && data.news_url) {
                newsSourceDisplay.innerHTML = `
                    <span class="news-label">元ネタになったニュース</span>
                    <a href="${data.news_url}" target="_blank" rel="noopener noreferrer">${data.news_title}</a>
                `;
            }

            senryuDisplay.style.transition = 'opacity 0.8s ease';
            senryuDisplay.style.opacity = '1';
        }, 300);

        // Xシェアボタンを有効化
        shareBtn.disabled = false;
        shareBtn.addEventListener('click', shareToX);
    }

    // X (Twitter) への共有機能
    function shareToX() {
        if (!currentSenryuText) return;

        // シェアするテキストの組み立て
        const textToShare = `【今日のAI風刺川柳】\n\n${currentSenryuText}\n\n#風刺川柳 #AI川柳 #ニュース`;

        // 現在のウェブサイトURL
        const urlToShare = window.location.href;

        // X Web Intent クエリの作成
        // ref: https://developer.x.com/en/docs/x-for-websites/tweet-button/guides/web-intent
        const xIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(textToShare)}&url=${encodeURIComponent(urlToShare)}`;

        // ポップアップウインドウで開く
        window.open(xIntentUrl, 'share-x', 'width=550,height=420');
    }

    // 初期化実行
    fetchTodaySenryu();
});
