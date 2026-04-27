export interface ToolMapping {
  name: string;
  commands?: string;
  skills?: string;
  templates?: string;
}

export interface InitAnswers {
  toolName: string;
}

export interface CopyResult {
  commandsDir: string;
  commandsCopied: string[];
  skillsDir?: string;
  skillsCopied: string[];
  templatesDir: string;
  templatesCopied: string[];
}
