// chat.service.ts
import env from "@/environment";
import OpenAI from "openai";

import { IMessage } from "@/interface/request/chat.request";
import { IChatResponse } from "@/interface/response/chat.response";
import { Log } from "@/utils/logger";
import utils from "@/utils";

class ChatService {
  private client: OpenAI;
  private sessions = new Map<string, IMessage[]>();
  private readonly MAX_HISTORY = utils.appConstant.MAX_HISTORY;

  constructor() {
    this.client = new OpenAI({
      apiKey: env.NVIDIA_API_KEY,
      baseURL: env.BASE_URL,
    });
  }



  /** Main chat function (non-streaming) */
  public async chatService(sessionId: string, userMessage: string, thinking?: boolean): Promise<IChatResponse> {

    Log.debug("ChatService:::chatService:::: sessionId message thinking", sessionId, userMessage, thinking)
    // Save user message
    this._addMessage(sessionId, { role: utils.appConstant.AIModelRole.USER, content: userMessage });

    const history = this._getSession(sessionId);
    Log.debug("ChatService:::chatService:::: history", history.length)

    // Build final message list
    const apiMessages = [
      {
        role: utils.appConstant.AIModelRole.SYSTEM,
        content: `${utils.appConstant.SHEILD_AI_SYSTEM_PROMPT}

          Each session is completely isolated.
          You are in session: ${sessionId}.`,
      },
      ...history,
    ];

    // Send to NVIDIA via OpenAI SDK
    const response: any = await this.client.chat.completions.create(
      {
        model: env.NVIDIA_AI_MODEL,
        messages: apiMessages as any, // bypass type mismatch
        temperature: env.TEMPERATURE,
        top_p: env.TOP_P,
        max_tokens: env.MAX_TOKENS,
        chat_template_kwargs: { thinking: thinking ?? false }, // disables reasoning
      } as any
    );

    Log.debug("ChatService:::chatService:::: response", response)
    // Extract message safely
    const finalText =
      response?.choices?.[0]?.message?.content ||
      response?.choices?.[0]?.delta?.content ||
      "";

    // ################### Safety Check ###################
    // 1. Remove leaked "thinking" blocks if any (e.g. <think>...</think>)
    let safeText = finalText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

    // 2. Remove other potential leakage markers
    safeText = safeText.replace(/\[Reasoning\][\s\S]*?(\n|$)/gi, "").trim();

    // 3. Basic content validation (can be expanded with a blacklist if needed)
    if (!safeText || safeText.length < 2) {
      Log.warn("ChatService:::chatService:::: Response was empty or unsafe, using fallback.");
      safeText = "I apologize, but I couldn't generate a proper response. Please try asking again.";
    }

    // 4. Critical Safety Keyword Check (Suicide/Harm/Bad Advice)
    // SafetyCheck ensures we catch extreme cases where the AI output might reflect self-harm or unsafe advice.
    const safetyOverride = utils.SafetyCheck.checkAndSanitize(safeText);
    if (safetyOverride) {
      Log.warn("ChatService:::chatService:::: Content overridden by SafetyCheck");
      safeText = safetyOverride;
    }

    const finalTextSanitized = safeText;

    Log.debug("ChatService:::chatService:::: finalTextSanitized", finalTextSanitized);

    // Save assistant message
    this._addMessage(sessionId, { role: utils.appConstant.AIModelRole.ASSISTANT, content: finalTextSanitized });

    return {
      content: finalTextSanitized,
      sessionId,
    };
  }


  /** Get session history */
  public async getHistory(sessionId: string) {
    return this._getSession(sessionId);
  }

  /** Clear session */
  public async clearSession(sessionId: string) {
    this.sessions.delete(sessionId);
  }

  /** Clear all sessions */
  public async clearAllSessions() {
    this.sessions.clear();
  }

  /** Get session count */
  public async getSessionCount() {
    return this.sessions.size;
  }




  // private
  // ###############################################################
  /** Get or create session memory */
  private _getSession(sessionId: string): IMessage[] {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, []);
    }
    return this.sessions.get(sessionId)!;
  }

  /** Add message to memory */
  private _addMessage(sessionId: string, msg: IMessage) {
    const mem = this._getSession(sessionId);
    mem.push(msg);

    if (mem.length > this.MAX_HISTORY) {
      this.sessions.set(sessionId, mem.slice(-this.MAX_HISTORY));
    }
  }

}

export default new ChatService();
