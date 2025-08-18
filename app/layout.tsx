"use client";
import './globals.css';
import FontProvider from './font-provider';
import { UserProvider, useUser } from './context/UserContext';
import Link from 'next/link';
import Image from 'next/image'; // Added Next.js Image component

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <FontProvider>
      <UserProvider>
        <AuthLayoutContent>{children}</AuthLayoutContent>
      </UserProvider>
    </FontProvider>
  )
}

function AuthLayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="flex justify-between items-center p-4 gap-4 h-16">
          <Link href="/" className="text-xl font-semibold ml-16" style={{ fontFamily: 'Inter, sans-serif' }}>
            Project Pulse
          </Link>
          <nav className="flex items-center gap-6 ml-auto mr-16">
            <AuthNavigation />
          </nav>
        </header>
        {children}
      </body>
    </html>
  )
}

function AuthNavigation() {
  const { user, loading, logout } = useUser()

  if (loading) {
    return null // or a loading spinner
  }

  if (user) {
    return (
      <>
        <Link href="/dashboard" className="hover:text-blue-500 opacity-85">Dashboard</Link>
        <Link href="/bookmarks" className="hover:text-blue-500 opacity-85">Bookmarks</Link>
        <Link href="/chat" className="hover:text-blue-500 opacity-85">Chatbot</Link>
        <div className="flex items-center gap-2 ml-4">
          {user.picture && (
            <Image 
              src={user.picture} 
              alt="Profile" 
              width={32}
              height={32}
              className="w-8 h-8 rounded-full"
            />
          )}
          <span className="font-medium">{user.name || user.email}</span>
          <button
            className="ml-2 px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </>
    )
  }

  return (
    <button>
      {/* Sign in button if needed */}
    </button>
  )
}