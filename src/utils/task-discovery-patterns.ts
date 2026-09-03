/**
 * Expressoes regulares literais de CT-014, centralizadas em um unico lugar para
 * que a task-7 (preflight, grupo E) possa reutiliza-las sem redigita-las.
 *
 * Qualquer divergencia entre estas constantes e a tabela de CT-014 da techspec
 * e um defeito: a fonte vence.
 */

/** Nome de arquivo que conta como task: `task-<digitos><resto>.md`, sem distincao de caixa. */
export const TASK_FILE_PATTERN = /^task-\d+.*\.md$/i;

/** Numero da task: digitos apos `task-`, com os zeros a esquerda descartados pela captura. */
export const TASK_NUMBER_PATTERN = /^task-0*(\d+)/;

/** Metadado de conclusao: linha `| **Status** | DONE ...` do `task-template.md`. */
export const STATUS_DONE_PATTERN = /^\|\s*\*\*Status\*\*\s*\|\s*DONE/im;
