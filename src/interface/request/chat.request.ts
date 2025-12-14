import { AIModelRole } from "@/utils/appConstant";
export interface IMessage {
  role: AIModelRole;
  content: string;
}
