import { Command } from 'commander';
import prompts from 'prompts';
import { InitAnswers } from '../types/init.js';
import { FileService } from '../utils/file-service.js';
import { showSuccessMessage, showMissionMessage, showErrorMessage, showInfoMessage } from '../utils/message-formatter.js';
import { updateNotifierMiddleware } from '../utils/update-notifier-middleware.js';

async function runInitCommand(): Promise<void> {
  console.log('');
  console.log('Inicializando estrutura Spec Driven Development...');
  console.log('');

  const handleSigInt = () => {
    console.log('');
    showErrorMessage('Operação cancelada pelo usuário.');
    process.exit(1);
  };

  const fileService = new FileService();

  try {
    process.on('SIGINT', handleSigInt);

    const directoryConventionResponse = await prompts({
      type: 'select',
      name: 'directoryConvention',
      message: 'Selecione a convenção de diretórios para comandos:',
      choices: [
        { title: 'Recomendado (OpenCode)', value: 'opencode', description: 'Cria diretório .opencode/commands/ para uso com OpenCode' },
        { title: 'Agnóstico (Specifica-BR)', value: 'specifica-br', description: 'Cria diretório specifica-br/commands/ para uso em qualquer IDE/IA' }
      ],
      initial: 0
    });

    if (!directoryConventionResponse.directoryConvention) {
      showErrorMessage('Operação cancelada pelo usuário.');
      process.exit(1);
    }

    const answers: InitAnswers = {
      directoryConvention: directoryConventionResponse.directoryConvention
    };

    if (answers.directoryConvention === 'opencode') {
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

      answers.tool = toolResponse.tool;
      answers.model = modelResponse.model;

      console.log('');
      showInfoMessage(`Ferramenta: ${answers.tool} | Modelo: ${answers.model}`);
    }

    console.log('');
    showInfoMessage('Criando estrutura de diretórios...');
    console.log(`• Convenção selecionada: ${answers.directoryConvention}`);
    await fileService.createStructure(answers.directoryConvention);

    showSuccessMessage(answers.directoryConvention);

    showMissionMessage();
  } catch (error) {
    if (error instanceof Error) {
      showErrorMessage(error.message);
    } else {
      showErrorMessage('Erro desconhecido ao executar comando init.');
    }
    process.exit(1);
  } finally {
    process.off('SIGINT', handleSigInt);
  }
}

async function wrappedRunInitCommand(): Promise<void> {
  await updateNotifierMiddleware.wrap('init', runInitCommand);
}

export const initCommand = new Command('init')
  .description('Inicializa estrutura SDD no projeto atual')
  .action(wrappedRunInitCommand);
