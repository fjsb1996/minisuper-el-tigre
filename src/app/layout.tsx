import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mini-Súper EL TIGRE - Punto de Venta y Administración',
  description:
    'Sistema integral de Punto de Venta (POS), Escáner de código de barras, Inventario, Fiado, Proveedores y Reportes para Mini-Súper EL TIGRE (MXN).',
  manifest: '/manifest.json',
  icons: {
    icon: '/logo-icono-tigre.png',
    apple: '/logo-icono-tigre.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Mini-Súper EL TIGRE',
  },
};

export const viewport: Viewport = {
  themeColor: '#ea580c',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-MX" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="min-h-screen antialiased selection:bg-orange-500 selection:text-white"
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AppShell>{children}</AppShell>
          <Toaster position="top-center" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
