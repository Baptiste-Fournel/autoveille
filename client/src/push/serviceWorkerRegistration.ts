import { isRefreshMessage } from '../serviceWorker/refreshMessage';

const SERVICE_WORKER_ADDRESS = '/sw.js';

export const registerServiceWorker = async (navigator: Navigator, onRefresh: () => void): Promise<boolean> => {
  if (!('serviceWorker' in navigator)) {
    return false;
  }
  const registered = await navigator.serviceWorker.register(SERVICE_WORKER_ADDRESS).then(
    () => true,
    () => false,
  );
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (isRefreshMessage(event.data)) {
      onRefresh();
    }
  });
  return registered;
};
