
import { Log } from "./logger";

export class SafetyCheck {

    // Critical mental health / self-harm triggers
    private static selfHarmPatterns = [
        /kill myself/gi,
        /suicide/gi,
        /harm myself/gi,
        /end my life/gi,
        /want to die/gi,
        /take my own life/gi,
    ];

    // Women's safety specific triggers (Immediate Danger / Exploitation)
    // These patterns check if the AI is inadvertently generating content depicting or encouraging these acts
    // or if the conversation has drifted into very unsafe territory where a hard stop is needed.
    private static womenSafetyCriticalPatterns = [
        /victim blaming/gi,
        /you asked for it/gi,
        /it was your fault/gi, // Victim blaming
        /ignore the harassment/gi, // Bad advice
        /don't report/gi, // Bad advice
        /how to hide a body/gi, // Illegal/Harmful
        /how to rape/gi, // Illegal/Harmful
    ];

    /**
     * Checks text for critical safety violations.
     * @param text The text to check (usually AI response or User Persona reflection)
     * @returns A safe fallback message if a violation is found, or null if safe.
     */
    public static checkAndSanitize(text: string): string | null {
        if (!text) return null;

        // 1. Check for Self-Harm content
        // Note: regex.test() advances state for global regexes, so we use string.match or reset regex. 
        // Using .some with new RegExp or match is safer than reusing global constants.
        const isSelfHarm = this.selfHarmPatterns.some(pattern => text.match(pattern));

        if (isSelfHarm) {
            Log.warn("SafetyCheck::: Content flagged as Self-Harm related.");
            return "I want to ensure you receive appropriate support. You are not alone. Please reach out to a trusted friend, family member, or a professional.\n\nImmediate Help:\n- National Emergency Number: 112\n- Suicide Prevention India (Aasra): 91-9820466726\n- Vandrevala Foundation: 1860-266-2345";
        }

        // 2. Check for Women's Safety Critical Failures (Bad advice / Harmful content)
        const isUnsafeAdvice = this.womenSafetyCriticalPatterns.some(pattern => text.match(pattern));

        if (isUnsafeAdvice) {
            Log.warn("SafetyCheck::: Content flagged as Unsafe/Harmful Advice.");
            return "I cannot continue this response as it may violate safety guidelines. My goal is to empower and support you. If you are in danger, please contact the police (100/112) or the National Commission for Women (7827170170) immediately.";
        }

        return null;
    }
}
