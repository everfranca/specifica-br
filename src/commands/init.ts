import { Command } from 'commander';
import prompts from 'prompts';
import { InitAnswers } from '../types/init.js';
import { createDirectories, copyTemplates } from '../utils/file-service.js';
import { showSuccessMessage, showMissionMessage, showErrorMessage, showInfoMessage } from '../utils/message-formatter.js';
import { updateNotifierMiddleware } from '../utils/update-notifier-middleware.js';

async function runInitCommand(): Promise<void> {
  console.log('');
  console.log('Inicializando estrutura Spec Driven Development...');
  console.log('');

  try {
    const toolResponse = await prompts({
      type: 'select',
      name: 'tool',
      message: 'Selecione a ferramenta de IA:',
      choices: [
        { title: 'OpenCode', value: 'opencode' }
      ],
      initial: 0
    });

    if (!toolResponse.tool) {
      showErrorMessage('Operação cancelada pelo usuário.');
      process.exit(1);
    }

    const modelResponse = await prompts({
      type: 'select',
      name: 'model',
      message: 'Selecione o modelo de IA:',
      choices: [
        { title: 'GLM 4.7', value: 'glm-4.7' }
      ],
      initial: 0
    });

    if (!modelResponse.model) {
      showErrorMessage('Operação cancelada pelo usuário.');
      process.exit(1);
    }

    const answers: InitAnswers = {
      tool: toolResponse.tool,
      model: modelResponse.model
    };

    console.log('');
    showInfoMessage(`Ferramenta: ${answers.tool} | Modelo: ${answers.model}`);

    console.log('');
    showInfoMessage('Criando estrutura de diretórios...');
    createDirectories();

    console.log('');
    showInfoMessage('Copiando arquivos de templates...');
    copyTemplates();

    showSuccessMessage();

    showMissionMessage();
  } catch (error) {
    if (error instanceof Error) {
      showErrorMessage(error.message);
    } else {
      showErrorMessage('Erro desconhecido ao executar comando init.');
    }
    process.exit(1);
  }
}

async function wrappedRunInitCommand(): Promise<void> {
  await updateNotifierMiddleware.wrap('init', runInitCommand);
}

export const initCommand = new Command('init')
  .description('Inicializa estrutura SDD no projeto atual')
  .action(wrappedRunInitCommand);
