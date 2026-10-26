import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Qprint — Real-Time College Printing Management',
  description: 'Fast Printing • No Long Waiting • Real-Time Order Tracking. Place printing orders remotely, pay online, and get notified when your print is ready.',
  keywords: 'qprint, college printing, xerox, print management, real-time queue',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
