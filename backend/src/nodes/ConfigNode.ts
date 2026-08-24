import { NodeHandlerParams } from './types';
import { ConfigStore } from '../configs/ConfigStore';
import {
  evaluateConfig,
  loadConfigFiles,
  saveConfigFiles,
} from '../configs/ConfigEvaluator';

export const configNodeHandler = async ({
  currentNode,
  context,
  globalVariables,
  projectName,
  logToClient,
}: NodeHandlerParams) => {
  const nodeData = currentNode.data as Record<string, unknown>;
  const configId = nodeData?.configId as string | undefined;
  if (!configId) {
    logToClient('❌ Конфігурацію не вибрано', 'error');
    return { nextHandle: 'false', data: context };
  }

  const config = ConfigStore.getById(configId);
  if (!config) {
    logToClient(`❌ Конфігурацію ${configId} не знайдено`, 'error');
    return { nextHandle: 'false', data: context };
  }

  const fileCache = loadConfigFiles(config, projectName, logToClient);
  const extractedVars: Record<string, unknown> = {};
  const filesToSave = new Set<string>();

  const allPassed = evaluateConfig(config, projectName, fileCache, filesToSave, extractedVars, globalVariables, logToClient);

  saveConfigFiles(filesToSave, fileCache, projectName, logToClient);

  const nodeResults: Record<string, unknown> = {
    lastConfigName: config.name,
    lastResult: allPassed,
    lastVars: extractedVars,
  };

  const nextHandle = allPassed ? 'true' : 'false';
  logToClient(`${allPassed ? '✅' : '❌'} Фінальний результат: ${allPassed ? 'TRUE' : 'FALSE'}`, allPassed ? 'success' : 'error');

  return {
    nextHandle,
    data: { ...context, ...extractedVars },
    updateNodeData: nodeResults,
  };
};
