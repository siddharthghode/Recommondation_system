// Messaging API functions
import { BASE_URL } from './api';

export const getMessages = async (token) => {
  const res = await fetch(`${BASE_URL}/messages/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch messages');
  return res.json();
};

export const getInbox = async (token, isRead = null) => {
  let url = `${BASE_URL}/messages/inbox/`;
  if (isRead !== null) {
    url += `?is_read=${isRead}`;
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch inbox');
  return res.json();
};

export const getSentMessages = async (token) => {
  const res = await fetch(`${BASE_URL}/messages/sent/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch sent messages');
  return res.json();
};

export const getConversation = async (token, userId) => {
  const res = await fetch(`${BASE_URL}/messages/${userId}/conversation/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch conversation');
  return res.json();
};

export const sendMessage = async (token, recipientId, subject, body, parentMessageId = null) => {
  const res = await fetch(`${BASE_URL}/messages/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      recipient: recipientId,
      subject,
      body,
      parent_message: parentMessageId,
    }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || error.error || 'Failed to send message');
  }
  return res.json();
};

export const markMessageRead = async (token, messageId) => {
  const res = await fetch(`${BASE_URL}/messages/${messageId}/mark_read/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to mark message as read');
  return res.json();
};

export const markAllRead = async (token) => {
  const res = await fetch(`${BASE_URL}/messages/mark_all_read/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to mark all as read');
  return res.json();
};

export const getUnreadCount = async (token) => {
  const res = await fetch(`${BASE_URL}/messages/unread_count/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch unread count');
  return res.json();
};

export const getLibrarians = async (token) => {
  const res = await fetch(`${BASE_URL}/messages/librarians/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch librarians');
  return res.json();
};

export const getStudents = async (token) => {
  const res = await fetch(`${BASE_URL}/messages/students/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch students');
  return res.json();
};
