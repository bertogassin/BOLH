/**
 * Notifications State Management Hook
 * Handles fetching, managing, and subscribing to notifications
 */

import { createSignal, createEffect, onMount, Accessor } from "solid-js";

export interface Notification {
  id: string;
  user_id: number;
  title: string;
  body: string;
  notification_type: string;
  data?: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

export interface NotificationSettings {
  push_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  order_updates: boolean;
  promotions: boolean;
  security_alerts: boolean;
}

export interface NotificationStore {
  // State
  notifications: Accessor<Notification[]>;
  unreadCount: Accessor<number>;
  settings: Accessor<NotificationSettings | null>;
  wsConnected: Accessor<boolean>;
  loading: Accessor<boolean>;
  error: Accessor<string | null>;

  // Actions
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationIds: string[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  updateSettings: (settings: Partial<NotificationSettings>) => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
}

export function useNotifications(): NotificationStore {
  // State signals
  const [notifications, setNotifications] = createSignal<Notification[]>([]);
  const [unreadCount, setUnreadCount] = createSignal(0);
  const [settings, setSettings] = createSignal<NotificationSettings | null>(null);
  const [wsConnected, setWsConnected] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const apiBase = "http://localhost:8080/api/v1";

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${apiBase}/notifications`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to fetch notifications: ${msg}`);
      console.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Mark notifications as read
  const markAsRead = async (notificationIds: string[]) => {
    try {
      setError(null);
      const response = await fetch(`${apiBase}/notifications/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_ids: notificationIds }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      // Update local state
      setNotifications(
        notifications().map((n) =>
          notificationIds.includes(n.id) ? { ...n, is_read: true } : n
        )
      );
      
      const unread = notifications().filter((n) => !n.is_read).length;
      setUnreadCount(unread);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to mark as read: ${msg}`);
      console.error(msg);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    const unreadIds = notifications()
      .filter((n) => !n.is_read)
      .map((n) => n.id);
    
    if (unreadIds.length > 0) {
      await markAsRead(unreadIds);
    }
  };

  // Fetch notification settings
  const fetchSettings = async () => {
    try {
      setError(null);
      const response = await fetch(`${apiBase}/notifications/settings`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setSettings(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to fetch settings: ${msg}`);
      console.error(msg);
    }
  };

  // Update notification settings
  const updateSettings = async (newSettings: Partial<NotificationSettings>) => {
    try {
      setError(null);
      const response = await fetch(`${apiBase}/notifications/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setSettings(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to update settings: ${msg}`);
      console.error(msg);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId: string) => {
    try {
      setError(null);
      setNotifications(notifications().filter((n) => n.id !== notificationId));
      const unread = notifications().filter((n) => !n.is_read).length;
      setUnreadCount(unread);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to delete notification: ${msg}`);
      console.error(msg);
    }
  };

  // Initialize WebSocket connection for real-time notifications
  createEffect(() => {
    const wsUrl = "ws://localhost:8080/api/v1/notifications/ws";
    const ws = new WebSocket(wsUrl);

    ws.addEventListener("open", () => {
      setWsConnected(true);
      console.log("Notifications WebSocket connected");
    });

    ws.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(event.data);
        handleWsMessage(message);
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    });

    ws.addEventListener("close", () => {
      setWsConnected(false);
      // Attempt reconnect after 3 seconds
      setTimeout(() => ws.close(), 3000);
    });

    ws.addEventListener("error", (err) => {
      setWsConnected(false);
      console.error("WebSocket error:", err);
    });

    return () => ws.close();
  });

  const handleWsMessage = (message: any) => {
    switch (message.type) {
      case "notification:new":
        // Add new notification to the list
        const newNotif: Notification = {
          id: message.data.id,
          user_id: message.data.user_id,
          title: message.data.title,
          body: message.data.body,
          notification_type: message.data.notification_type,
          data: message.data.data,
          is_read: false,
          created_at: message.data.created_at,
        };
        setNotifications([newNotif, ...notifications()]);
        setUnreadCount(unreadCount() + 1);
        break;

      case "notification:read":
        // Mark specific notification as read
        setNotifications(
          notifications().map((n) =>
            n.id === message.data.notification_id
              ? { ...n, is_read: true }
              : n
          )
        );
        break;

      case "notification:unread_count":
        // Update unread count
        setUnreadCount(message.data.count);
        break;

      case "notification:marked_read":
        // Mark multiple as read
        const markedIds = message.data.notification_ids || [];
        setNotifications(
          notifications().map((n) =>
            markedIds.includes(n.id) ? { ...n, is_read: true } : n
          )
        );
        setUnreadCount(message.data.count);
        break;

      default:
        break;
    }
  };

  // Auto-fetch notifications on mount
  onMount(() => {
    fetchNotifications();
    fetchSettings();
  });

  return {
    notifications,
    unreadCount,
    settings,
    wsConnected,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    fetchSettings,
    updateSettings,
    deleteNotification,
  };
}
