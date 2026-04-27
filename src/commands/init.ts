import { Command } from 'commander';
import prompts from 'prompts';
import { InitAnswers, ToolMapping } from '../types/init.js';
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

    const toolsMapping = await fileService.loadToolsMapping();

    const choices = toolsMapping.map(tool => ({
      title: tool.name,
      value: tool.name
    }));

    const toolResponse = await prompts({
      type: 'select',
      name: 'toolName',
      message: 'Selecione a ferramenta de IA:',
      choices,
      initial: 0
    });

    if (!toolResponse.toolName) {
      showErrorMessage('Operação cancelada pelo usuário.');
      process.exit(1);
    }

    const selectedTool = toolsMapping.find(tool => tool.name === toolResponse.toolName);

    if (!selectedTool) {
      showErrorMessage('Erro: Ferramenta não encontrada no mapeamento.');
      process.exit(1);
    }

    const answers: InitAnswers = {
      toolName: toolResponse.toolName
    };

    console.log('');
    showInfoMessage('Os seguintes diretórios serão criados:');
    if (selectedTool.commands) {
      console.log(`  Commands: ${selectedTool.commands} (7 arquivos)`);
    }
    if (selectedTool.skills) {
      console.log(`  Skills:   ${selectedTool.skills} (2 skills com referências)`);
    }
    if (selectedTool.templates) {
      console.log(`  Templates: ${selectedTool.templates} (7 arquivos)`);
    }
    console.log('');

    const confirmResponse = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: 'Deseja continuar?',
      initial: true
    });

    if (!confirmResponse.confirm) {
      showErrorMessage('Operação cancelada pelo usuário.');
      process.exit(1);
    }

    console.log('');
    showInfoMessage('Criando estrutura de diretórios...');

    const copyResult = await fileService.createStructure(selectedTool);

    showSuccessMessage(copyResult);

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
