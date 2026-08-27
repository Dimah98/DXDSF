import { NodeHandlerParams } from './types';

export const valueLoopNodeHandler = async ({
  currentNode,
  activePage,
  ws,
  nodeTitle,
  takeDebugSnapshot,
  smartSleep,
  logToClient,
  context
}: NodeHandlerParams) => {
  try {
    const nodeResults: Record<string, unknown> = { data: context };
    const nodeData = currentNode.data as Record<string, unknown>;
    const parentSel = nodeData.selector as string | undefined;
    const childType = (nodeData.childType as string) || 'img';
    const childCustom = (nodeData.childCustomSelector as string) || '';
    const minValue = (nodeData.minValue as number) ?? 0;
    const childSelector = childType === 'custom' ? childCustom : childType;

    if (!parentSel) {
      nodeResults.nextHandle = 'fail';
      if (ws && typeof ws.send === 'function' && (ws.readyState === undefined || ws.readyState === 1)) {
        try { ws.send(JSON.stringify({ type: 'NODE_DATA_UPDATE', nodeId: currentNode.id, data: { loopResult: { clicked: 0, total: 0 } } })); } catch {}
      }
    } else {
      const elements = await activePage.evaluate(({ pSel, cSel, min }: { pSel: string; cSel: string; min: number }) => {
        const parent = document.querySelector(pSel);
        if (!parent) return [];
        const children = Array.from(parent.querySelectorAll(cSel)) as HTMLElement[];
        const results: { index: number, num: number, rect: { x: number, y: number } }[] = [];
        children.forEach((el, i) => {
          const container = el.closest('[class]') || el.parentElement;
          if (!container) return;
          const text = container.textContent || '';
          const match = text.match(/(\d+(?:\.\d+)?)/);
          const num = match ? parseFloat(match[1]) : -1;
          if (num >= min) {
            const rect = el.getBoundingClientRect();
            results.push({ index: i, num, rect: { x: Math.round(rect.left + rect.width/2), y: Math.round(rect.top + rect.height/2) } });
          }
        });
        return results;
      }, { pSel: parentSel, cSel: childSelector, min: minValue });

      let clicked = 0;
      for (const el of elements) {
        if (!(ws as any).isBotRunning) break;
        await activePage.evaluate(({ x, y }: any) => { window.scrollTo({ left: x - window.innerWidth / 2, top: y - window.innerHeight / 2, behavior: 'auto' }); }, { x: el.rect.x, y: el.rect.y });
        await smartSleep(200, ws);
        const vCoords = await activePage.evaluate(({ x, y }: any) => { return { x: x - window.scrollX, y: y - window.scrollY }; }, { x: el.rect.x, y: el.rect.y });
        await takeDebugSnapshot(currentNode.id, nodeTitle, vCoords);
        await activePage.mouse.click(vCoords.x, vCoords.y);
        clicked++;

        // Надсилаємо прогрес в реальному часі після кожного кліку
        if (ws && typeof ws.send === 'function' && (ws.readyState === undefined || ws.readyState === 1)) {
          try {
            ws.send(JSON.stringify({
              type: 'NODE_DATA_UPDATE',
              nodeId: currentNode.id,
              data: { loopResult: { clicked, total: elements.length } },
            }));
          } catch {}
        }
        logToClient(`🔁 Цикл: ${clicked}/${elements.length}`, 'debug');

        await smartSleep(300, ws);
      }

      nodeResults.data = { ...context, count: clicked, value: clicked };
      nodeResults.nextHandle = clicked > 0 ? 'done' : 'fail';
      logToClient(`✅ Цикл завершено: клікнуто ${clicked} з ${elements.length}`, 'success');
    }
    return nodeResults;
  } catch (err: any) {
    logToClient(`❌ Помилка в ValueLoopNode: ${err.message}`, 'error');
    return { data: context, nextHandle: 'error' };
  }
};
