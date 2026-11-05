'use client';

/**
 * PWA Service Worker 注册器。
 * 只做三件事：注册 /sw.js、让新版本立刻接管、避免重复 reload。
 * 不渲染任何 UI，挂在 RootLayout 的 body 末尾即可。
 */
import { useEffect } from 'react';

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    // 开发环境不注册，避免本地热更新被缓存壳干扰
    if (process.env.NODE_ENV !== 'production') return;

    let reloading = false;

    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          // 绕开 HTTP 缓存，保证 SW 文件本身总是最新的
          updateViaCache: 'none',
        });

        // 已有等待中的新版本：直接让它接管
        if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');

        reg.addEventListener('updatefound', () => {
          const next = reg.installing;
          if (!next) return;
          next.addEventListener('statechange', () => {
            // 首次安装（还没有 controller）时不要 reload，否则白屏抖一下
            if (next.state === 'installed' && navigator.serviceWorker.controller) {
              next.postMessage('SKIP_WAITING');
            }
          });
        });

        // 回到前台时检查一次更新（长期挂在后台的 App 场景）
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => {});
        });
      } catch (e) {
        // 注册失败不影响站点正常使用
        console.warn('[pwa] service worker 注册失败：', e);
      }
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return null;
}
