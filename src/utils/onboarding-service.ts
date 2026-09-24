import prompts from 'prompts';
import { runInitCommand } from '../commands/init.js';
import { FileService } from './file-service.js';
import { showInfoMessage } from './message-formatter.js';
import { logService } from './log-service.js';

class OnboardingService {
  private podePerguntar(): boolean {
    return Boolean(process.stdin.isTTY) && !process.env.CI;
  }

  async garantirOnboardingSeNecessario(): Promise<void> {
    try {
      const fileService = new FileService();
      const toolsMapping = await fileService.loadToolsMapping();

      if (await fileService.existeInstalacaoEmQualquerEscopo(toolsMapping)) {
        return;
      }

      showInfoMessage(
        'Nenhuma instalação do specifica-br foi encontrada. O comando "specifica-br init" é obrigatório após instalar o pacote: ele instala os comandos e skills SDD no diretório da sua ferramenta de IA.'
      );

      if (!this.podePerguntar()) {
        console.log('  Execute "specifica-br init" para concluir a configuração.');
        return;
      }

      const response = await prompts({
        type: 'confirm',
        name: 'instalar',
        message: 'Deseja executar o init agora e selecionar sua ferramenta de IA?',
        initial: true
      });

      if (response === undefined || !response.instalar) {
        console.log('  Execute "specifica-br init" mais tarde para concluir a configuração.');
        return;
      }

      await runInitCommand({});
    } catch (error) {
      await logService.logError(
        error instanceof Error ? error : new Error(String(error)),
        'OnboardingService'
      );
    }
  }
}

export const onboardingService = new OnboardingService();
