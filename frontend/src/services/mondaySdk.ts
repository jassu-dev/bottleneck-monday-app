import mondaySdk from 'monday-sdk-js';

const monday = mondaySdk();

export interface MondayContext {
  boardId?: string | number;
  boardIds?: (string | number)[];
  user?: {
    id: string;
    name?: string;
    isViewOnly?: boolean;
  };
  theme?: string;
  app?: any;
}

export const initMonday = () => {
  return monday;
};

export const getMondayContext = (): Promise<MondayContext> => {
  return new Promise((resolve) => {
    try {
      monday.get('context').then((res: any) => {
        resolve(res?.data || {});
      }).catch(() => {
        // Fallback for standalone / local browser testing
        resolve({ boardId: '12345678' });
      });
    } catch {
      resolve({ boardId: '12345678' });
    }
  });
};

export const listenToContext = (callback: (context: MondayContext) => void) => {
  try {
    monday.listen('context', (res: any) => {
      callback(res?.data || {});
    });
  } catch (err) {
    console.warn('[MondaySDK] Unable to attach context listener:', err);
  }
};

export const showMondayNotice = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  try {
    monday.execute('notice', {
      message,
      type,
      timeout: 4000,
    });
  } catch {
    console.log(`[Notice ${type}]`, message);
  }
};

export const openItemCard = (itemId: string | number) => {
  try {
    monday.execute('openItemCard', { itemId: Number(itemId) });
  } catch {
    console.log(`[OpenItemCard] Item: ${itemId}`);
  }
};

export default monday;
