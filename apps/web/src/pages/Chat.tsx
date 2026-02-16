import { createSignal, For, onMount, onCleanup } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { Avatar, Icon, Input, Button } from '@bolh/ui';

interface Message {
  id: string;
  senderId: number;
  text: string;
  timestamp: string;
  isRead: boolean;
}

// Mock data
const currentUserId = 1;
const otherUser = {
  id: 2,
  name: 'Александр Иванов',
  avatarUrl: undefined,
  isOnline: true,
};

const initialMessages: Message[] = [
  { id: '1', senderId: 2, text: 'Здравствуйте! Я принял ваш заказ.', timestamp: '10:30', isRead: true },
  { id: '2', senderId: 1, text: 'Отлично, спасибо! Когда будете?', timestamp: '10:31', isRead: true },
  { id: '3', senderId: 2, text: 'Буду через 5-10 минут. Уже еду к вам.', timestamp: '10:32', isRead: true },
  { id: '4', senderId: 1, text: 'Хорошо, жду вас у входа', timestamp: '10:33', isRead: true },
];

export default function ChatPage() {
  const params = useParams();
  const navigate = useNavigate();
  
  const [messages, setMessages] = createSignal<Message[]>(initialMessages);
  const [newMessage, setNewMessage] = createSignal('');
  const [isTyping, setIsTyping] = createSignal(false);

  let messagesEndRef: HTMLDivElement | undefined;
  let wsConnection: WebSocket | null = null;

  const closeConnection = () => {
    if (wsConnection) {
      wsConnection.close();
      wsConnection = null;
    }
  };

  onMount(() => {
    scrollToBottom();
    connectWebSocket();
  });

  onCleanup(() => {
    closeConnection();
  });

  const connectWebSocket = () => {
    // TODO: Connect to actual WebSocket
    // wsConnection = new WebSocket('wss://api.guardio.app/ws');
    // wsConnection.onmessage = handleWsMessage;
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const sendMessage = () => {
    const text = newMessage().trim();
    if (!text) return;

    const message: Message = {
      id: Date.now().toString(),
      senderId: currentUserId,
      text,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      isRead: false,
    };

    setMessages([...messages(), message]);
    setNewMessage('');
    scrollToBottom();

    // TODO: Send via WebSocket or API
    // wsConnection?.send(JSON.stringify({ type: 'chat:message', data: message }));

    // Simulate reply
    setTimeout(() => {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        const reply: Message = {
          id: (Date.now() + 1).toString(),
          senderId: 2,
          text: 'Понял, скоро буду!',
          timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          isRead: false,
        };
        setMessages([...messages(), reply]);
        scrollToBottom();
      }, 2000);
    }, 1000);
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div class="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div class="bg-white shadow-sm px-4 py-3 flex items-center gap-3 safe-area-inset-top">
        <button onClick={() => navigate(-1)}>
          <Icon name="arrowLeft" size="md" />
        </button>
        <Avatar
          src={otherUser.avatarUrl}
          name={otherUser.name}
          size="sm"
          status={otherUser.isOnline ? 'online' : 'offline'}
        />
        <div class="flex-1">
          <h1 class="font-semibold text-gray-900">{otherUser.name}</h1>
          <p class="text-xs text-green-600">
            {isTyping() ? 'Typing...' : otherUser.isOnline ? 'Online' : 'Offline'}
          </p>
        </div>
        <button class="p-2">
          <Icon name="phone" size="md" class="text-gray-600" />
        </button>
      </div>

      {/* Messages */}
      <div class="flex-1 overflow-y-auto p-4 space-y-3">
        <For each={messages()}>
          {(message) => {
            const isOwn = message.senderId === currentUserId;
            return (
              <div class={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div
                  class={`
                    max-w-[75%] rounded-2xl px-4 py-2
                    ${isOwn
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-white text-gray-900 rounded-bl-sm shadow-sm'
                    }
                  `}
                >
                  <p class="text-sm">{message.text}</p>
                  <p class={`text-xs mt-1 ${isOwn ? 'text-blue-200' : 'text-gray-400'}`}>
                    {message.timestamp}
                    {isOwn && message.isRead && ' ✓✓'}
                  </p>
                </div>
              </div>
            );
          }}
        </For>
        
        {/* Typing indicator */}
        {isTyping() && (
          <div class="flex justify-start">
            <div class="bg-white rounded-2xl px-4 py-2 shadow-sm">
              <div class="flex gap-1">
                <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ "animation-delay": "0ms" }} />
                <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ "animation-delay": "150ms" }} />
                <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ "animation-delay": "300ms" }} />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div class="bg-white border-t border-gray-200 px-4 py-3 safe-area-inset-bottom">
        <div class="flex items-center gap-2">
          <button class="p-2 text-gray-400">
            <Icon name="plus" size="md" />
          </button>
          <input
            type="text"
            value={newMessage()}
            onInput={(e) => setNewMessage(e.currentTarget.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            class="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage().trim()}
            class={`
              p-2 rounded-full
              ${newMessage().trim() ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}
            `}
          >
            <Icon name="arrowRight" size="md" />
          </button>
        </div>
      </div>
    </div>
  );
}
