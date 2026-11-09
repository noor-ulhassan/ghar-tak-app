import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Bot, Send, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getChatbotResponse } from '@/ai/flows/chatbot-flow';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@clerk/react';
import { Link } from 'wouter';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  /** The "trouble connecting" reply; not part of the conversation sent to the assistant. */
  failed?: boolean;
}

export default function ChatbotWidget() {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', text: "Hello! I'm the Ghar Tak Assistant. How can I help you today?", sender: 'bot' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isBotReplying, setIsBotReplying] = useState(false);
  const { toast } = useToast();

  const handleSendMessage = async () => {
    if (inputValue.trim() === '' || isBotReplying) return;

    const newUserMessage: Message = { id: Date.now().toString(), text: inputValue, sender: 'user' };
    const history = messages
      .filter((m) => !m.failed)
      .map((m) => ({ role: m.sender === 'user' ? ('user' as const) : ('assistant' as const), content: m.text }));
    setMessages(prev => [...prev, newUserMessage]);
    const userMessage = inputValue;
    setInputValue('');
    setIsBotReplying(true);

    try {
      const result = await getChatbotResponse({ message: userMessage, history });
      const botResponse: Message = { 
        id: (Date.now() + 1).toString(), 
        text: result.response, 
        sender: 'bot' 
      };
      setMessages(prev => [...prev, botResponse]);
    } catch (error) {
      console.error("Chatbot AI error:", error);
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm sorry, but I'm having a little trouble connecting right now. Please try again in a moment.",
        sender: 'bot',
        failed: true,
      };
      setMessages(prev => [...prev, errorResponse]);
      toast({
        variant: 'destructive',
        title: 'Chatbot Error',
        description: 'Could not get a response from the assistant.',
      });
    } finally {
      setIsBotReplying(false);
    }
  };

  return (
    <>
      <Button
        variant="default"
        size="icon"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
        onClick={() => setIsOpen(true)}
        aria-label="Open Chatbot"
      >
        <Bot className="h-7 w-7" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px] flex flex-col h-[70vh] max-h-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Bot className="mr-2 h-5 w-5 text-primary" /> Ghar Tak Assistant
            </DialogTitle>
            <DialogDescription>
              Ask about products, services, or get help with your orders.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-grow p-4 border rounded-md my-4 bg-muted/30">
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3 rounded-lg ${
                      msg.sender === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card text-card-foreground border'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {isBotReplying && (
                 <div className="flex justify-start">
                    <div className="max-w-[85%] p-3 rounded-lg bg-card text-card-foreground border">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="mt-auto">
            {user ? (
              <div className="flex w-full space-x-2">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Type your message..."
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-grow"
                  disabled={isBotReplying}
                />
                <Button onClick={handleSendMessage} aria-label="Send Message" disabled={isBotReplying}>
                  {isBotReplying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            ) : (
              <div className="flex w-full flex-col items-center gap-2 text-center">
                <p className="text-sm text-muted-foreground">Sign in to chat with the Ghar Tak Assistant.</p>
                <Button asChild className="w-full" onClick={() => setIsOpen(false)}>
                  <Link href="/sign-in">Sign In</Link>
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
