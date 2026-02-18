/**
 * Interface para as respostas do comando init.
 * Representa as escolhas do usuário durante o fluxo interativo.
 */
export interface InitAnswers {
  tool: string;
  model: string;
}

/**
 * Interface para configuração de templates.
 * Mapeia ferramentas e modelos para os paths de arquivos de comando.
 */
export interface TemplateConfig {
  [key: string]: {
    tool: string;
    model: string;
    opencodeCommands: string[];
  };
}
