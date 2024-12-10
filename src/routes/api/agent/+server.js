import { json } from '@sveltejs/kit';
import Groq from "groq-sdk";
const apiKey = import.meta.env.VITE_GROQ_API_KEY;

const groq = new Groq({ apiKey: apiKey });

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	const message = await request.json();
	const response = await getGroqChatCompletion(message);
	const agentMessage = response.choices[0]?.message?.content || ''
	return json(agentMessage);
}

async function getGroqChatCompletion(userMessage) {
	return groq.chat.completions.create({
		messages: userMessage,
		model: "llama-3.1-70b-versatile",
		temperature: 0,
		response_format: { "type": "json_object" },
	});
}
