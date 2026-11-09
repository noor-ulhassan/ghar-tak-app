import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  contactMessages,
  conversations,
  messages,
  providersTable,
  type Conversation,
} from "@workspace/db/schema";
import { displayName, ensureUser } from "../lib/users";
import { requireAuth } from "./auth";

const router: IRouter = Router();

function validContent(res: Response, content: unknown): content is string {
  if (typeof content !== "string" || !content.trim() || content.trim().length > 2000) {
    res.status(400).json({ error: "content is required (max 2000 characters)" });
    return false;
  }
  return true;
}

async function displayNameOf(clerkUserId: string): Promise<string | null> {
  return displayName(await ensureUser(clerkUserId));
}

// Viewer must be a participant: the customer or the provider owner.
async function loadParticipantConversation(
  conversationId: string,
  clerkUserId: string,
): Promise<
  | { ok: true; conversation: Conversation; role: "user" | "provider" }
  | { ok: false; status: 404 | 403 }
> {
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!conversation) return { ok: false, status: 404 };

  if (conversation.userId === clerkUserId) {
    return { ok: true, conversation, role: "user" };
  }

  const [provider] = await db
    .select({ userId: providersTable.userId })
    .from(providersTable)
    .where(eq(providersTable.id, conversation.providerId))
    .limit(1);
  if (provider?.userId === clerkUserId) {
    return { ok: true, conversation, role: "provider" };
  }

  return { ok: false, status: 403 };
}

// POST /api/providers/:providerId/messages — customer starts or continues a chat
router.post("/providers/:providerId/messages", requireAuth, async (req, res) => {
  const clerkUserId = (req as any).clerkUserId as string;
  const { content } = req.body as { content?: string };
  if (!validContent(res, content)) return;
  const text = content.trim();

  try {
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, String(req.params.providerId)))
      .limit(1);
    if (!provider) {
      res.status(404).json({ error: "Provider not found" });
      return;
    }

    let [conversation] = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.providerId, provider.id),
          eq(conversations.userId, clerkUserId),
        ),
      )
      .limit(1);

    if (!conversation) {
      const customer = await ensureUser(clerkUserId);
      const snapshot = {
        providerId: provider.id,
        userId: clerkUserId,
        userName: displayName(customer),
        userEmail: customer.email,
        userAvatar: customer.profileImageUrl,
        providerName: provider.name,
        providerAvatar: provider.avatarUrl,
      };
      // Unique (provider_id, user_id) index: a concurrent first message may win the race.
      const [created] = await db
        .insert(conversations)
        .values(snapshot)
        .onConflictDoNothing({ target: [conversations.providerId, conversations.userId] })
        .returning();
      if (created) {
        conversation = created;
      } else {
        [conversation] = await db
          .select()
          .from(conversations)
          .where(
            and(
              eq(conversations.providerId, provider.id),
              eq(conversations.userId, clerkUserId),
            ),
          )
          .limit(1);
      }
    }

    const senderName = (await displayNameOf(clerkUserId)) ?? conversation.userName ?? "Customer";
    const [message] = await db
      .insert(messages)
      .values({
        conversationId: conversation.id,
        senderId: clerkUserId,
        senderType: "user",
        senderName,
        content: text,
      })
      .returning();

    await db
      .update(conversations)
      .set({
        lastMessage: text,
        lastMessageAt: new Date(),
        unreadCountProvider: sql`${conversations.unreadCountProvider} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversation.id));

    res.status(201).json({ conversationId: conversation.id, message });
  } catch (err) {
    req.log.error({ err }, "POST /providers/:providerId/messages error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/conversations — chats where I am the customer or the provider owner
router.get("/conversations", requireAuth, async (req, res) => {
  const clerkUserId = (req as any).clerkUserId as string;
  try {
    const ownedProviders = await db
      .select({ id: providersTable.id })
      .from(providersTable)
      .where(eq(providersTable.userId, clerkUserId));

    const conditions = [eq(conversations.userId, clerkUserId)];
    if (ownedProviders.length > 0) {
      conditions.push(
        inArray(
          conversations.providerId,
          ownedProviders.map((p) => p.id),
        ),
      );
    }

    const rows = await db
      .select()
      .from(conversations)
      .where(or(...conditions))
      .orderBy(desc(conversations.lastMessageAt))
      .limit(100);

    res.json(
      rows.map((c) => ({
        ...c,
        viewerRole: c.userId === clerkUserId ? ("user" as const) : ("provider" as const),
      })),
    );
  } catch (err) {
    req.log.error({ err }, "GET /conversations error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/conversations/:conversationId/messages — thread for participants
router.get("/conversations/:conversationId/messages", requireAuth, async (req, res) => {
  const clerkUserId = (req as any).clerkUserId as string;
  try {
    const result = await loadParticipantConversation(String(req.params.conversationId), clerkUserId);
    if (!result.ok) {
      res.status(result.status).json({ error: result.status === 404 ? "Conversation not found" : "Forbidden" });
      return;
    }

    const thread = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, result.conversation.id))
      .orderBy(messages.createdAt)
      .limit(500);

    res.json(thread);
  } catch (err) {
    req.log.error({ err }, "GET /conversations/:id/messages error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/conversations/:conversationId/messages — reply as customer or provider
router.post("/conversations/:conversationId/messages", requireAuth, async (req, res) => {
  const clerkUserId = (req as any).clerkUserId as string;
  const { content } = req.body as { content?: string };
  if (!validContent(res, content)) return;
  const text = content.trim();

  try {
    const result = await loadParticipantConversation(String(req.params.conversationId), clerkUserId);
    if (!result.ok) {
      res.status(result.status).json({ error: result.status === 404 ? "Conversation not found" : "Forbidden" });
      return;
    }
    const { conversation, role } = result;

    const senderName =
      (await displayNameOf(clerkUserId)) ??
      (role === "user" ? conversation.userName : conversation.providerName) ??
      (role === "user" ? "Customer" : "Provider");

    const [message] = await db
      .insert(messages)
      .values({
        conversationId: conversation.id,
        senderId: clerkUserId,
        senderType: role,
        senderName,
        content: text,
      })
      .returning();

    await db
      .update(conversations)
      .set({
        lastMessage: text,
        lastMessageAt: new Date(),
        unreadCountUser: role === "provider" ? sql`${conversations.unreadCountUser} + 1` : conversations.unreadCountUser,
        unreadCountProvider: role === "user" ? sql`${conversations.unreadCountProvider} + 1` : conversations.unreadCountProvider,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversation.id));

    res.status(201).json({ conversationId: conversation.id, message });
  } catch (err) {
    req.log.error({ err }, "POST /conversations/:id/messages error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/conversations/:conversationId/read — reset the viewer's unread counter
router.post("/conversations/:conversationId/read", requireAuth, async (req, res) => {
  const clerkUserId = (req as any).clerkUserId as string;
  try {
    const result = await loadParticipantConversation(String(req.params.conversationId), clerkUserId);
    if (!result.ok) {
      res.status(result.status).json({ error: result.status === 404 ? "Conversation not found" : "Forbidden" });
      return;
    }

    await db
      .update(conversations)
      .set(
        result.role === "user"
          ? { unreadCountUser: 0 }
          : { unreadCountProvider: 0 },
      )
      .where(eq(conversations.id, result.conversation.id));

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "POST /conversations/:id/read error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/messages — contact form (support) or message to provider
router.post("/messages", async (req, res) => {
  const { name, email, message, providerId, providerName } = req.body as {
    name?: string;
    email?: string;
    message?: string;
    providerId?: string;
    providerName?: string;
  };

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    res.status(400).json({ error: "name, email, and message are required" });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  const [row] = await db
    .insert(contactMessages)
    .values({
      name: name.trim().slice(0, 200),
      email: email.trim().slice(0, 255),
      message: message.trim().slice(0, 2000),
      providerId: providerId ?? null,
      providerName: providerName ?? null,
    })
    .returning();

  res.status(201).json({ success: true, id: row.id });
});

export default router;
