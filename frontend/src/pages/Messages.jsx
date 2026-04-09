import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  getInbox, 
  getSentMessages, 
  getConversation, 
  sendMessage, 
  getLibrarians, 
  getStudents,
  markAllRead,
  getUnreadCount
} from '../services/messaging';

export default function Messages() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role') || 'student';
  
  const [activeTab, setActiveTab] = useState('inbox'); // inbox, sent, compose
  const [messages, setMessages] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [conversationMessages, setConversationMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Compose form
  const [recipients, setRecipients] = useState([]);
  const [selectedRecipient, setSelectedRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    loadMessages();
    loadUnreadCount();
    loadRecipients();
    
    // Poll for new messages every 30 seconds
    const interval = setInterval(() => {
      loadUnreadCount();
      if (activeTab === 'inbox') {
        loadMessages();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [token, activeTab]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const data = activeTab === 'inbox' ? await getInbox(token) : await getSentMessages(token);
      setMessages(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const data = await getUnreadCount(token);
      setUnreadCount(data.unread_count || 0);
    } catch (err) {
      console.error('Failed to load unread count:', err);
    }
  };

  const loadRecipients = async () => {
    try {
      const isLibrarian = role === 'librarian' || role === 'admin';
      const data = isLibrarian ? await getStudents(token) : await getLibrarians(token);
      setRecipients(data);
    } catch (err) {
      console.error('Failed to load recipients:', err);
      // Fallback to opposite list in case role is missing/incorrect
      try {
        const fallbackData = await getLibrarians(token);
        setRecipients(fallbackData);
      } catch (fallbackErr) {
        console.error('Failed to load fallback recipients:', fallbackErr);
      }
    }
  };

  const loadConversation = async (userId) => {
    try {
      const data = await getConversation(token, userId);
      setConversationMessages(data);
      setSelectedConversation(userId);
      loadUnreadCount();
    } catch (err) {
      setError(err.message || 'Failed to load conversation');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!selectedRecipient || !messageBody.trim()) {
      setError('Please select a recipient and enter a message');
      return;
    }

    try {
      setSending(true);
      setError('');
      await sendMessage(token, selectedRecipient, subject, messageBody);
      
      // Reset form
      setSelectedRecipient('');
      setSubject('');
      setMessageBody('');
      setActiveTab('sent');
      
      alert('Message sent successfully!');
    } catch (err) {
      setError(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead(token);
      loadMessages();
      loadUnreadCount();
    } catch (err) {
      setError(err.message || 'Failed to mark all as read');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getOtherUser = (message) => {
    return activeTab === 'inbox' ? message.sender_details : message.recipient_details;
  };

  const handleMessageClick = (message) => {
    const otherUser = getOtherUser(message);
    loadConversation(otherUser.id);
  };

  if (loading && messages.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] min-w-[44px]"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Messages</h1>
                {unreadCount > 0 && (
                  <p className="text-sm text-gray-600">{unreadCount} unread</p>
                )}
              </div>
            </div>
            
            <button
              onClick={() => setActiveTab('compose')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 min-h-[44px]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">New Message</span>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mt-4 border-b border-gray-200">
            <button
              onClick={() => { setActiveTab('inbox'); setSelectedConversation(null); }}
              className={`px-4 py-2 font-medium transition-colors relative min-h-[44px] ${
                activeTab === 'inbox'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Inbox
              {unreadCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => { setActiveTab('sent'); setSelectedConversation(null); }}
              className={`px-4 py-2 font-medium transition-colors min-h-[44px] ${
                activeTab === 'sent'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Sent
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Compose Form */}
        {activeTab === 'compose' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <h2 className="text-xl font-bold mb-4 text-gray-900">Compose Message</h2>
            <form onSubmit={handleSendMessage} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  To: {role === 'student' ? 'Librarian' : 'Student'}
                </label>
                <select
                  value={selectedRecipient}
                  onChange={(e) => setSelectedRecipient(e.target.value)}
                  required
                  className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 text-black focus:border-blue-500 focus:outline-none min-h-[44px]"
                >
                  <option value="">Select recipient...</option>
                  {recipients.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject (optional)
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter subject..."
                  className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 text-black focus:border-blue-500 focus:outline-none min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message *
                </label>
                <textarea
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  required
                  rows={6}
                  placeholder="Type your message here..."
                  className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 text-black focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={sending}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 min-h-[44px]"
                >
                  {sending ? 'Sending...' : 'Send Message'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('inbox')}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors min-h-[44px]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Message List */}
        {(activeTab === 'inbox' || activeTab === 'sent') && !selectedConversation && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {activeTab === 'inbox' && unreadCount > 0 && (
              <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                <span className="text-sm text-gray-600">{unreadCount} unread messages</span>
                <button
                  onClick={handleMarkAllRead}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium min-h-[44px] px-4"
                >
                  Mark all as read
                </button>
              </div>
            )}

            {messages.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <p className="text-gray-500">No messages yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {messages.map((message) => {
                  const otherUser = getOtherUser(message);
                  const isUnread = activeTab === 'inbox' && !message.is_read;
                  
                  return (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        isUnread ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => handleMessageClick(message)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`font-semibold text-gray-900 ${isUnread ? 'font-bold' : ''}`}>
                              {otherUser.full_name}
                            </p>
                            {isUnread && (
                              <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                                New
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {message.subject || '(No subject)'}
                          </p>
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                            {message.body}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-gray-500">
                            {formatDate(message.created_at)}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Conversation View */}
        {selectedConversation && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <button
                onClick={() => setSelectedConversation(null)}
                className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 min-h-[44px]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to messages
              </button>
            </div>

            <div className="p-6 max-h-[600px] overflow-y-auto space-y-4">
              {conversationMessages.map((msg) => {
                const isMe = msg.sender === parseInt(localStorage.getItem('userId') || '0');
                
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg px-4 py-3 ${
                        isMe
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      {msg.subject && (
                        <p className="font-semibold mb-1">{msg.subject}</p>
                      )}
                      <p className="whitespace-pre-wrap">{msg.body}</p>
                      <p
                        className={`text-xs mt-2 ${
                          isMe ? 'text-blue-100' : 'text-gray-500'
                        }`}
                      >
                        {formatDate(msg.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
