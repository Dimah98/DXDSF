import { NodeResult } from './types';

// Обробник ноди-коментаря — просто пропускається при виконанні сценарію
export const commentNodeHandler = async ({ context }: any): Promise<NodeResult> => {
  // Нода-коментар не виконує жодних дій — просто передає потік далі
  // Не повертає nextHandle, тому наступні ноди активуються за стандартним правилом
  return { nextHandle: undefined, data: context };
};
