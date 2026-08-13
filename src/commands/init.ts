import { Command } from 'commander';
import prompts from 'prompts';
import { InitAnswers, InstallScope } from '../types/init.js';
import { FileService } from '../utils/file-service.js';
import {
  showSuccessMessage,
  showMissionMessage,
  showErrorMessage,
  showInfoMessage,
  showTargetsPreview,
  displayPath
} from '../utils/message-formatter.js';
import { updateNotifierMiddleware } from '../utils/update-notifier-middleware.js';

interface InitOptions {
  local?: boolean;
}

async function runInitCommand(options: InitOptions = {}): Promise<void> {
  const scope: InstallScope = options.local ? 'local' : 'global';

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
      type: 'multiselect',
      name: 'toolNames',
      message: 'Selecione as ferramentas de IA (espaço para marcar, enter para confirmar):',
      choices,
      min: 1,
      instructions: false
    });

    if (!toolResponse.toolNames || toolResponse.toolNames.length === 0) {
      showErrorMessage('Operação cancelada pelo usuário.');
      process.exit(1);
    }

    const answers: InitAnswers = {
      toolNames: toolResponse.toolNames,
      scope
    };

    const selectedTools = toolsMapping.filter(tool => answers.toolNames.includes(tool.name));

    if (selectedTools.length !== answers.toolNames.length) {
      showErrorMessage('Erro: Ferramenta não encontrada no mapeamento.');
      process.exit(1);
    }

    const targets = fileService.resolveTargets(selectedTools, scope);

    console.log('');
    showInfoMessage(
      scope === 'global'
        ? 'Instalação global — os seguintes diretórios serão criados:'
        : 'Instalação no projeto — os seguintes diretórios serão criados:'
    );
    showTargetsPreview(targets);
    console.log('');

    if (scope === 'global') {
      console.log('  Os templates continuam no projeto, em specs/templates/.');
      console.log('');
    }

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

    const copyResult = await fileService.createStructure(selectedTools, scope);

    // Com a instalacao global, copias antigas dentro do projeto viram duplicatas.
    // Varremos os diretorios de todas as ferramentas e removemos so o que e nosso.
    if (scope === 'global') {
      const artifacts = await fileService.scanProjectArtifacts(toolsMapping);

      if (artifacts.length > 0) {
        console.log('');
        showInfoMessage('Instalação antiga do specifica-br encontrada neste projeto:');
        artifacts.forEach(artifact => {
          console.log(`  ${displayPath(artifact.dir)} (${artifact.entries.length} item(ns))`);
        });
        console.log('');

        const cleanupResponse = await prompts({
          type: 'confirm',
          name: 'confirm',
          message: 'Remover a instalação antiga do projeto?',
          initial: true
        });

        if (cleanupResponse.confirm) {
          const cleanup = await fileService.cleanProjectArtifacts(artifacts);
          copyResult.projectCleanup.removed.push(...cleanup.removed);
          copyResult.projectCleanup.keptDirs.push(...cleanup.keptDirs);
        }
      }
    }

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

async function wrappedRunInitCommand(options: InitOptions): Promise<void> {
  await updateNotifierMiddleware.wrap('init', () => runInitCommand(options));
}

export const initCommand = new Command('init')
  .description('Instala comandos e skills SDD no diretório global da ferramenta de IA')
  .option('--local', 'Instala comandos e skills no projeto atual em vez do diretório global')
  .action(wrappedRunInitCommand);
