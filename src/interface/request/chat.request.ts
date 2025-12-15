import { AIModelRole } from "@/utils/appConstant";
export interface IMessage {
  role: AIModelRole;
  content: string;
}

export interface IChatRequest {
  sessionId: string;
  message: string;
  thinking?: boolean;
}
