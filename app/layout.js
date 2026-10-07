// app/layout.js
import './globals.css';
import { Toaster } from 'react-hot-toast';
import AppShell from '../components/Layout/AppShell';

export const metadata = {
  title: 'Heaven Homes CRM',
  description: 'CRM for Heaven Homes',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}