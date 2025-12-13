// chat.service.ts
import env from "@/environment";
import OpenAI from "openai";

import { IMessage } from "@/interface/request/chat.request";
import { IChatResponse } from "@/interface/response/chat.response";

class ChatService {
  private client: OpenAI;
  private sessions = new Map<string, IMessage[]>();
  private readonly MAX_HISTORY = 10;

  constructor() {
    this.client = new OpenAI({
      apiKey: env.NVIDIA_API_KEY,
      baseURL: "https://integrate.api.nvidia.com/v1",
    });
  }

  /** Get or create session memory */
  private getSession(sessionId: string): IMessage[] {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, []);
    }
    return this.sessions.get(sessionId)!;
  }

  /** Add message to memory */
  private addMessage(sessionId: string, msg: IMessage) {
    const mem = this.getSession(sessionId);
    mem.push(msg);

    if (mem.length > this.MAX_HISTORY) {
      this.sessions.set(sessionId, mem.slice(-this.MAX_HISTORY));
    }
  }

  /** Main chat function (non-streaming) */
  public async chat(sessionId: string, userMessage: string, thinking?: boolean): Promise<IChatResponse> {
    // Save user message
    this.addMessage(sessionId, { role: "user", content: userMessage });

    const history = this.getSession(sessionId);

    // Build final message list
    const apiMessages = [
      {
        role: "system",
        content: `You are SHEILD AI.
          Your responses must NOT include:
          - reasoning
          - chain-of-thought
          - hidden thinking

          Each session is completely isolated.
          You are in session: ${sessionId}.`,
      },
      ...history,
    ];

    // Send to NVIDIA via OpenAI SDK
    const response: any = await this.client.chat.completions.create(
      {
        model: "deepseek-ai/deepseek-v3.1",
        messages: apiMessages as any, // bypass type mismatch
        temperature: 0.2,
        top_p: 0.7,
        max_tokens: 2048,
        chat_template_kwargs: { thinking: thinking ?? false }, // disables reasoning
      } as any
    );

    // Extract message safely
    const finalText =
      response?.choices?.[0]?.message?.content ||
      response?.choices?.[0]?.delta?.content ||
      "";

    // Save assistant message
    this.addMessage(sessionId, { role: "assistant", content: finalText });

    return {
      content: finalText,
      sessionId,
    };
  }

  public getHistory(sessionId: string) {
    return this.getSession(sessionId);
  }

  public clearSession(sessionId: string) {
    this.sessions.delete(sessionId);
  }

  public clearAllSessions() {
    this.sessions.clear();
  }

  public getSessionCount() {
    return this.sessions.size;
  }
}

export default new ChatService();
