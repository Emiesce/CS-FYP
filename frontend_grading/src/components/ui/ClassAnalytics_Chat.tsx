import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Button } from "./button";
import { Textarea } from "./textarea";
import { ScrollArea } from "./scroll-area";
import { X, Send, Sparkles, Loader2 } from "lucide-react";
import { Badge } from "./badge";
import Markdown from "react-markdown";

type ChatRole = "user" | "assistant";

interface Message {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: Date;
}

interface AIChatbotProps {
  onClose: () => void;
  examId: string;
}

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type ChatRequest = {
  exam_id: string;
  messages: ChatMessage[];
};

export function AIChatbot({ onClose, examId }: AIChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Hello! I'm your AI assistant for exam analytics. I can help you gain deeper insights into student performance, identify trends, analyze specific questions, and provide recommendations. How can I assist you today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  async function sendMessage(userText: string) {
    if (!userText || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userText,
      timestamp: new Date(),
    };
    const updatedUi = [...messages, userMessage];

    setMessages(updatedUi);
    setInput("");
    setIsLoading(true);

    const chatRequest: ChatRequest = {
      exam_id: examId,
      messages: [{ role: "user", content: userText }],
    };

    const res = await fetch("http://127.0.0.1:8000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chatRequest),
    });

    const data = await res.json();
    const assistantText = data.choices[0].message.content as string;
    const assistantResponseRecord: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: assistantText,
      timestamp: new Date(),
    };

    setMessages([...updatedUi, assistantResponseRecord]);

    setIsLoading(false);
  }

  return (
    <Card className="flex flex-col shadow-lg border-2 max-w-[420px] max-h-[480px] w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">AI Insights Assistant</CardTitle>
            <p className="text-sm text-muted-foreground">
              Ask me anything about {examId} performance
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <ScrollArea ref={scrollAreaRef} className="scrollable-container p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] border rounded-lg px-4 py-2 ${
                    message.role === "user"
                      ? "bg-\[\#cee5ff\]"
                      : "bg-\[\#fafbff\]"
                  }`}
                >
                  {message.role === "assistant" && (
                    <Badge className="mb-2 text-xs bg-card text-muted-foreground">
                      <Sparkles className="w-3 h-3 mr-1" />
                      AI Assistant
                    </Badge>
                  )}
                  <p className="text-sm whitespace-pre-wrap">
                    <Markdown>{message.content}</Markdown>
                  </p>
                  <p className="text-xs opacity-70 mt-2">
                    {message.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-lg px-4 py-3 bg-muted">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <p className="text-sm">Analyzing data...</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-4 bg-background">
          <div className="flex gap-2 mb-4">
            <Textarea
              ref={textareaRef}
              placeholder="Ask about score trends, student performance, question difficulty..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="min-h-[60px] max-h-[120px] resize-none"
              disabled={isLoading}
            />
            <Button
              onClick={sendMessage.bind(null, input)}
              disabled={!input.trim() || isLoading}
              size="sm"
              className="h-[60px] w-[60px] shrink-0"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-auto">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
