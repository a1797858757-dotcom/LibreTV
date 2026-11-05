import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { PwaRegister } from '@/components/pwa-register';

export const metadata: Metadata = {
  title: {
    default: '正版CCTV - 永久免费视频观看平台',
    template: '%s - 正版CCTV',
  },
  description:
    '正版CCTV 是一个免费的在线视频搜索平台，无广告、安全，提供来自多个视频源的内容搜索与观看服务，无需注册即可使用。',
  manifest: '/manifest.webmanifest',
  // PWA / iOS 主屏：capable 让「添加到主屏幕」以全屏独立窗口打开，而非 Safari 内嵌
  applicationName: '正版CCTV',
  appleWebApp: {
    capable: true,
    title: '正版CCTV',
    statusBarStyle: 'black',
  },
  // 关掉电话号码/邮箱自动识别，避免片名里的数字被渲染成电话链接
  formatDetection: { telephone: false, email: false, address: false },
  // 图标与门户站（LibreTV-portal）同一套：同一张 artwork 导出的多尺寸 + 根目录 favicon.ico 兜底。
  // 只声明单张 512 时，抓取端只能拿大图缩放，小尺寸下易糊、看起来「没填满」。
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/icons/icon-96.png', sizes: '96x96', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#0b101a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* iOS 15 之前只认 apple- 前缀这条，Next 的 appleWebApp 只输出 mobile-web-app-capable，这里补一份 */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        {/* 首屏前同步主题，避免亮暗闪烁 */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('libretv-theme')||'dark';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})()",
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
        {/* PWA：注册 Service Worker，不渲染 UI */}
        <PwaRegister />
      </body>
    </html>
  );
}
