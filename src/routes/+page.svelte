<script>
	let userMessage = "";
	let problems = [];
	let chatHistory = [];
	let knowledgeBase = [""];
	let currentProblemIndex = 0;
	let showHint = false;
	let isCorrect = false;

	async function getAgentResponse(messages) {
		const response = await fetch("/api/agent", {
			method: "POST",
			body: JSON.stringify(messages),
			headers: {
				"content-type": "application/json",
			},
		});

		return await response.json();
	}

	async function initializeAgent() {
		// 問題がまだ取得されていない場合に問題を生成
		if (problems.length === 0) {
			const randomFactor = Math.floor(Math.random() * 30) + 1;

			// problemPromptを更新
			const problemPrompt = {
				role: "user",
				content: `
                以下の条件に基づき、ランダムに異なる問題を生成してください．難易度は${randomFactor}に基づきます．
				${randomFactor}の数字が大きければ大きいほど，難しい問題を生成する必要があります．
                5問生成します。
                どこが誤りであるかは明示する必要はありません．

                出力する英文は以下のような形式で必ず出力してください．関係詞や時制，三単現のS，主語の一致，正しい前置詞，接続詞，疑問文など様々な文法的な内容を含んだものにすることで，きちんと英語文法を理解していなければいけないような問題を作成するようにしてください．
                "We are pleased to inform that you have been admitted as a member of our association."
                "The movie, which we saw last weekend, was so bored that I almost fell asleep."
                "It is hard to believe that a year and half have passed since the last time our whole family got together."

                回答は以下のJSONを埋めてください．

                JSON:
                {
                    "problems": [
                        {
                            "level": "${randomFactor}",
                            "buggy_sentence": "", # 1箇所だけ文法的な誤りの含んだ難関大学受験英語レベルの例文（高度な文法規則の誤用や複雑な構造を含む。）
                            "hint": "", # 文法的にどういった分野で誤りなのか（時制や3単元のsなど）
                            "answer": "" # 文法的な誤りの原因についての説明
                        }
                    ]
                }
                `,
			};

			// problemPromptを送信し，問題を取得
			await getAgentResponse([problemPrompt]).then((response) => {
				problems = JSON.parse(response).problems;
			});
		}

		// 問題が正常に取得されていない場合は終了
		if (problems.length === 0) {
			console.log("問題の取得に失敗しました．");
			return;
		}

		// 全ての問題を解き終えていないことを確認
		if (currentProblemIndex >= problems.length) {
			console.log("全ての問題を解き終えました．");
			return;
		}

		// initialBehaviorPromptを送信
		const initialBehaviorPrompt = {
			role: "user",
			content: `
            以下の「（英文法に誤りのある）おかしな英文」に対して，学習者の立場から「文法的に誤りを含んでいるらしいから教えてほしい」という主旨の文章を日本語で作成してください．
			「教えてほしい」という趣旨を言うだけでよく，問題の解説・解説は絶対に言わないでください．
            英文: "${problems[currentProblemIndex].buggy_sentence}"
            期待される動作: "${problems[currentProblemIndex].answer}"

            JSON:
            {
                "message": ""
            }
            `,
		};

		await getAgentResponse([initialBehaviorPrompt]).then((response) => {
			chatHistory = [
				{
					role: "assistant",
					content: JSON.parse(response).message,
				},
			];
		});
	}

	function goToNextProblem() {
		if (currentProblemIndex < problems.length - 1) {
			currentProblemIndex += 1;
			showHint = false;
			isCorrect = false;
			chatHistory = [];
			initializeAgent();
		} else {
			console.log("全ての問題を解き終えました．");
		}
	}

	async function updateKnowledgeBase() {
		const updatePrompt = {
			role: "user",
			content: `
            あなたは問題「${problems[currentProblemIndex].buggy_sentence}」に直面しています．
            ユーザーからの発話は，「${userMessage}」です．
            この発話から問題について得られた知識があれば，自分の知識に追加してください．
            なければ，更新しないでください．

            JSON:
            {
                "knowledge": [
                    ${knowledgeBase.map((knowledge) => `"${knowledge}"`).join(",")}
                    "",
                ]
            }
            `,
		};

		await getAgentResponse([updatePrompt]).then((response) => {
			knowledgeBase = JSON.parse(response).knowledge;
			console.log(knowledgeBase);
		});
	}

	async function sendMessage() {
		chatHistory = [
			...chatHistory,
			{ role: "user", content: `${userMessage}」` },
		];

		await updateKnowledgeBase();

		// エージェントが英文を修正するプロンプト
		const responsePrompt = {
			role: "system",
			content: `
            文法的に誤りのある英文（buggy_sentence）を今の知識（knowledge）だけを使って正しくなるように修正してください。
            自分の知識が不十分な場合は何も修正せずに，ユーザに知識を追加してもらうように要請してください．
            JSON:
            {
                "buggy_sentence": "${problems[currentProblemIndex].buggy_sentence}",
                "knowledge": [
                    ${knowledgeBase.map((knowledge) => `"${knowledge}"`).join(",")}
                ],
                "edited_sentence": "" # 修正後の英文
            }
            `,
		};

		let agentResponse = "";
		await getAgentResponse([responsePrompt]).then((response) => {
			agentResponse = JSON.parse(response);
		});

		// 修正後の英文を保存
		const originalBuggySentence =
			problems[currentProblemIndex].buggy_sentence; // 修正前の英文を保持
		problems[currentProblemIndex].buggy_sentence =
			agentResponse.edited_sentence;

		// 正誤判定プロンプト（修正された英文が正しいかどうかを検証する）
		const checkPrompt = {
			role: "system",
			content: `
            修正後の英文（edited_sentence）が正しいか（文法的に誤りが無いか）どうかを判定してください。ここでは，自分の知識に限定して，正誤を判定するのではなく，英語の専門教師として普通に英文が合っているかどうかを判定してください．
            JSON:
            {
                "edited_sentence": "${problems[currentProblemIndex].buggy_sentence}",
                "expected_behavior": "${problems[currentProblemIndex].answer}",
                "is_correct": false,
                "error_details": "" # 誤りがある場合は詳細を日本語で説明してください
            }
            `,
		};

		let checkResponse = "";
		await getAgentResponse([checkPrompt]).then((response) => {
			checkResponse = JSON.parse(response);
			isCorrect = checkResponse.is_correct;
		});

		let agentMessage = "";
		if (isCorrect) {
			agentMessage = "正しい英文です．ありがとうございます．";
			agentMessage += `<br>修正前: ${originalBuggySentence}`;
			agentMessage += `<br>修正後: ${problems[currentProblemIndex].buggy_sentence}`;
			agentMessage += `<br>根拠: ${problems[currentProblemIndex].answer}`;
		} else {
			agentMessage = "まだ間違っています...";
			agentMessage += `<br>誤りの詳細: ${checkResponse.error_details}`;
			showHint = true;
		}

		// エージェントの返答を履歴に追加
		chatHistory = [
			...chatHistory,
			{ role: "assistant", content: agentMessage },
		];

		// ユーザーの入力をリセット
		userMessage = "";
	}

	function displayHint() {
		showHint = true;
	}
</script>

<main
	style="font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6;"
>
	<h1
		style="font-size: 2em; color: #333; text-align: center; margin-bottom: 20px;"
	>
		My Teachable Agent
	</h1>
	<textarea
		rows="4"
		cols="50"
		bind:value={userMessage}
		placeholder="メッセージを入力してください"
		style="width: 100%; max-width: 600px; padding: 10px; font-size: 1em; border: 1px solid #ccc; border-radius: 5px; margin-bottom: 15px;"
	></textarea>
	<br />
	<button
		on:click={() => sendMessage()}
		style="padding: 10px 20px; font-size: 1em; background-color: #007BFF; color: white; border: none; border-radius: 5px; cursor: pointer; margin-bottom: 20px;"
		>送信</button
	>
	{#if isCorrect}
		<button
			on:click={() => goToNextProblem()}
			style="padding: 10px 20px; font-size: 1em; background-color: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer;"
			>次の問題へ</button
		>
	{/if}

	{#if currentProblemIndex === problems.length}
		<p style="font-size: 1.2em; color: #28a745;">
			全ての問題を解き終えました．
		</p>
	{/if}

	{#if chatHistory.length === 0}
		{#await initializeAgent()}
			<p style="font-size: 1.2em; color: #666;">
				エージェントを初期化中...
			</p>
		{:catch error}
			<p style="font-size: 1.2em; color: #dc3545;">
				エージェントの初期化に失敗しました．
			</p>
			<p style="font-size: 1em; color: #dc3545;">
				エラー: {error.message}
			</p>
		{/await}
	{/if}
	{#if problems.length > 0}
		<p style="font-size: 1.2em; color: #333;">
			<strong>Level:</strong>
			{problems[currentProblemIndex]?.level}
		</p>
		<p style="font-size: 1.2em; color: #333;">
			<strong>おかしな英文:</strong>
		</p>
		<pre
			style="background-color: #f8f9fa; padding: 10px; border-radius: 5px;"><code
				>{problems[currentProblemIndex].buggy_sentence}</code
			></pre>
		<button
			on:click={() => displayHint()}
			style="padding: 10px 20px; font-size: 1em; background-color: #ffc107; color: white; border: none; border-radius: 5px; cursor: pointer; margin-top: 10px;"
			>ヒントを見る</button
		>
	{/if}
	{#if showHint}
		<p style="font-size: 1.2em; color: #ffc107;">
			<strong>ヒント:</strong>
		</p>
		<pre
			style="background-color: #fff3cd; padding: 10px; border-radius: 5px;"><code
				>{problems[currentProblemIndex].hint}</code
			></pre>
	{/if}

	{#each chatHistory.slice().reverse() as { role, content }, i}
		{#if role !== "system"}
			<div
				style="color: {role === 'user'
					? 'black'
					: 'skyblue'}; margin-bottom: 10px; font-size: 1.1em;"
			>
				{#if role === "assistant"}
					{@html content}
				{:else}
					<strong>あなた:</strong> {content}
				{/if}
			</div>
		{/if}
	{/each}
</main>
