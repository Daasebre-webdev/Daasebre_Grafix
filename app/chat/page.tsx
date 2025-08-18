'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image' // Added Image import
import { useUser } from '../context/UserContext'


interface Message {
  id: string;
  sender: 'user' | 'ai' | 'error';
  text: string;
  timestamp: Date;
  isEditing?: boolean;
}

interface ChatHistoryItem {
  date: string;
  messages: Message[];
}

export default function Chat() {
  const { user } = useUser() // Removed unused loading variable
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [isPaused, setIsPaused] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [animateText, setAnimateText] = useState(true)
  const [isInputActive, setIsInputActive] = useState(false)
  const [showNotification, setShowNotification] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [typingProgress, setTypingProgress] = useState(0)

  const generateId = () => Math.random().toString(36).substring(2, 11)

  const toggleNotifications = () => {
    setShowNotification(!showNotification)
  }

  // Message editing functions
  const startEditing = (id: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === id 
        ? {...msg, isEditing: true} 
        : {...msg, isEditing: false}
    ))
    const message = messages.find(msg => msg.id === id)
    setEditContent(message?.text || '')
  }

  const saveEdit = (id: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === id 
        ? {...msg, text: editContent, isEditing: false} 
        : msg
    ))
  }

  const cancelEdit = (id: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === id 
        ? {...msg, isEditing: false} 
        : msg
    ))
  }

  // Message management functions
  const deleteMessage = (id: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== id))
    
    setChatHistory(prev => 
      prev.map(history => ({
        ...history,
        messages: history.messages.filter(msg => msg.id !== id)
      }))
    )
  }

  const shareMessage = (text: string) => {
    if (navigator.share) {
      navigator.share({
        title: 'Check out this message',
        text: text
      }).catch(err => console.log('Error sharing:', err))
    } else {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      alert('Message copied to clipboard!')
    }
  }

  const activateInput = () => {
    setIsInputActive(true)
    setAnimateText(false)
    setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
  }

  const clearHistory = () => {
    if (confirm('Are you sure you want to clear all chat history?')) {
      setChatHistory([])
      setMessages([])
      localStorage.removeItem('chatHistory')
    }
  }

  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('chatHistory')
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory)
        setChatHistory(Array.isArray(parsed) ? parsed : [])
      }
    } catch (error) {
      console.error('Failed to load chat history:', error)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isPaused || isLoading) return

    const userMessage: Message = {
      id: generateId(),
      sender: 'user',
      text: input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setIsTyping(true)
    setTypingProgress(0)

    const typingInterval = setInterval(() => {
      setTypingProgress(prev => Math.min(prev + Math.random() * 10, 90))
    }, 300)

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token || ''}`
        },
        body: JSON.stringify({ 
          message: input,
          userId: user?.id
        })
      })

      clearInterval(typingInterval)
      setTypingProgress(100)

      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`)
      }

      const data = await response.json()

      const aiMessage: Message = {
        id: generateId(),
        sender: 'ai',
        text: data.text,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, aiMessage])
      
      try {
        const newHistoryItem: ChatHistoryItem = {
          date: new Date().toISOString(),
          messages: [...messages, userMessage, aiMessage]
        }
        
        const updatedHistory = [...chatHistory, newHistoryItem]
        setChatHistory(updatedHistory)
        localStorage.setItem('chatHistory', JSON.stringify(updatedHistory))
      } catch (storageError) {
        console.error('Failed to save history:', storageError)
      }

    } catch (error) {
      setMessages(prev => [...prev, {
        id: generateId(),
        sender: 'error',
        text: `Error: ${error instanceof Error ? error.message : 'Failed to process request'}`,
        timestamp: new Date()
      }])
    } finally {
      setIsLoading(false)
      setIsTyping(false)
      setTypingProgress(0)
      clearInterval(typingInterval)
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex h-screen bg-gray-50 relative">
      {/* Watermark text */}
      <div 
        id="animated-text"
        className="absolute inset-0 overflow-hidden opacity-5 pointer-events-none z-0"
        style={{
          backgroundImage: 'linear-gradient(90deg, transparent, transparent 50%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.1))',
          backgroundSize: '200% 100%',
          backgroundRepeat: 'repeat',
          fontFamily: 'sans-serif',
          fontSize: '10rem',
          fontWeight: 'bold',
          lineHeight: '1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'transparent',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          userSelect: 'none',
          visibility: animateText ? 'visible' : 'hidden'
        }}
      >
        PROJECTPULSE CHATBOT PROJECTPULSE CHATBOT
      </div>

      {/* Sidebar Navigation */}
      <div className="w-64 bg-gradient-to-b from-blue-900 to-black text-white fixed left-0 top-0 bottom-0 z-20 p-4 shadow-lg">
        <div className="flex items-center mb-8 mt-4 pl-2">
          <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-medium mr-3 overflow-hidden">
            {user && (
              <Image
                src={
                  user.picture.startsWith('http')
                    ? user.picture
                    : `http://localhost/Google_signup/${user.picture}`
                }
                alt="User profile"
                width={40}
                height={40}
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <h2 className="text-xl font-bold">Navigation</h2>
        </div>
        
        <nav className="space-y-2">
          <Link href="/dashboard" className="flex items-center p-3 rounded-lg hover:bg-blue-800 transition-colors">
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            Dashboard
          </Link>
          <Link href="/bookmarks" className="flex items-center p-3 rounded-lg hover:bg-blue-800 transition-colors">
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            Bookmarks
          </Link>
          <Link href="/chat" className="flex items-center p-3 rounded-lg bg-blue-800 hover:bg-blue-700 transition-colors">
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Chat
          </Link>
        </nav>

        {/* History Section */}
        <div className="mt-8">
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center p-3 rounded-lg hover:bg-blue-800 transition-colors w-full"
          >
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Chat History
          </button>
          {showHistory && (
            <div className="mt-2 ml-8 space-y-1 max-h-60 overflow-y-auto">
              {chatHistory.length > 0 ? (
                chatHistory.map((history, index) => (
                  <button
                    key={index}
                    className="text-left p-2 rounded hover:bg-blue-800 w-full truncate"
                    onClick={() => setMessages(history.messages)}
                  >
                    {new Date(history.date).toLocaleString()}
                  </button>
                ))
              ) : (
                <p className="text-sm text-gray-300 p-2">No history yet</p>
              )}
            </div>
          )}
        </div>

        {/* Clear History Button */}
        <div className="mt-4">
          <button 
            onClick={clearHistory}
            className="flex items-center p-3 rounded-lg hover:bg-red-800 transition-colors w-full text-red-300 hover:text-white"
          >
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear All History
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col ml-64">
        {/* Top Navigation Bar */}
        <div className="bg-white border-b border-gray-200 fixed top-0 right-0 left-64 z-10 p-4 shadow-sm">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-semibold text-gray-800">AI Chat Assistant</h1>
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => setIsPaused(!isPaused)}
                className={`p-2 rounded-full ${isPaused ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'} hover:bg-gray-200`}
                title={isPaused ? 'Resume chat' : 'Pause chat'}
              >
                {isPaused ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </button>
              
              <div className="relative">
                <button 
                  onClick={toggleNotifications}
                  className="p-2 rounded-full hover:bg-gray-100 relative"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
                
                {showNotification && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg py-1 z-20">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-700">Notifications</p>
                    </div>
                    <div className="px-4 py-2">
                      <p className="text-sm text-gray-500">No new notifications</p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-medium overflow-hidden">
                {user && (
                  <Image 
                    src={
                      user.picture.startsWith('http')
                        ? user.picture
                        : `http://localhost/Google_signup/${user.picture}`
                    }
                    alt="User profile"
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto pt-20 pb-24 px-6 space-y-4 mt-2 relative z-10">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              {!isInputActive ? (
                <button 
                  onClick={activateInput}
                  className="text-center text-gray-600 hover:text-indigo-600 transition-colors"
                >
                  <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow">
                    <p className="text-xl font-medium">How can I help you today?</p>
                    <p className="mt-2 text-indigo-500 animate-pulse">Ask me anything...</p>
                  </div>
                </button>
              ) : null}
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-xs md:max-w-md lg:max-w-lg rounded-lg px-4 py-2 relative group ${
                      msg.sender === 'user' 
                        ? 'bg-indigo-500 text-white rounded-br-none' 
                        : msg.sender === 'error'
                          ? 'bg-red-100 text-red-800 rounded-bl-none'
                          : 'bg-white text-gray-800 shadow rounded-bl-none'
                    }`}
                  >
                    {msg.isEditing ? (
                      <div className="flex flex-col">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full p-2 border rounded text-gray-800"
                          rows={3}
                        />
                        <div className="flex justify-end space-x-2 mt-2">
                          <button 
                            onClick={() => saveEdit(msg.id)}
                            className="px-2 py-1 bg-green-500 text-white rounded text-sm"
                          >
                            Save
                          </button>
                          <button 
                            onClick={() => cancelEdit(msg.id)}
                            className="px-2 py-1 bg-gray-500 text-white rounded text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p>{msg.text}</p>
                        <div className="absolute -top-3 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                          {msg.sender === 'user' && (
                            <>
                              <button 
                                onClick={() => startEditing(msg.id)}
                                className="p-1 bg-white text-indigo-500 rounded-full shadow hover:bg-gray-100"
                                title="Edit"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button 
                                onClick={() => deleteMessage(msg.id)}
                                className="p-1 bg-white text-red-500 rounded-full shadow hover:bg-gray-100"
                                title="Delete"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </>
                          )}
                          <button 
                            onClick={() => shareMessage(msg.text)}
                            className="p-1 bg-white text-gray-600 rounded-full shadow hover:bg-gray-100"
                            title="Share"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                          </button>
                        </div>
                        <div className="text-xs opacity-70 mt-1">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {/* Typing Indicator */}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="max-w-xs md:max-w-md lg:max-w-lg bg-white text-gray-800 shadow rounded-lg px-4 py-2 rounded-bl-none">
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <div className="text-xs text-gray-500">AI is typing...</div>
                    </div>
                    {typingProgress > 0 && (
                      <div className="w-full bg-gray-200 rounded-full h-1 mt-2">
                        <div 
                          className="bg-indigo-500 h-1 rounded-full transition-all duration-300" 
                          style={{ width: `${typingProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        {(isInputActive || messages.length > 0) && (
          <div className="p-4 border-t border-gray-200 bg-white fixed bottom-0 right-0 left-64 z-10">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isPaused ? "Chat is paused - click play to resume" : "Type your message..."}
                className={`flex-1 border ${isPaused ? 'border-red-300' : 'border-gray-300'} rounded-full px-4 py-2 focus:outline-none focus:ring-2 ${isPaused ? 'focus:ring-red-500' : 'focus:ring-indigo-500'}`}
                autoFocus
                disabled={isPaused || isLoading}
              />
              <button 
                type="submit" 
                className={`rounded-full p-2 w-10 h-10 flex items-center justify-center transition-colors ${
                  isPaused ? 'bg-red-500 hover:bg-red-600' : 
                  isLoading ? 'bg-gray-500' : 
                  'bg-indigo-600 hover:bg-indigo-700'
                } text-white`}
                disabled={!input.trim() || isPaused || isLoading}
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}