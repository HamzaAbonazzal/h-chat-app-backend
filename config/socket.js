import User from "../models/User.js";
import Message from "../models/Message.js";
import CallLog from "../models/CallLog.js";
import Conversation from "../models/Conversation.js";
import { resetUnreadCount } from "../utils/unreadHelper.js";
import { sendNotificationToUser } from "../utils/notificationService.js";
import { getUserContacts, canSeePresence } from "../utils/presenceHelper.js";
import logger from "../utils/logger.js";

// ⭐ Map: userId -> Set<socketId>
const onlineUsers = new Map();

// ⭐ Map: callId -> { callerId, receiverId, callType, startedAt, answeredAt }
const activeCalls = new Map();

// ⭐ Map: groupCallId -> { conversationId, participants, callType, startedAt, initiator }
const activeGroupCalls = new Map();

const addSocket = (userId, socketId) => {
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId).add(socketId);
};

const removeSocket = (userId, socketId) => {
  if (!onlineUsers.has(userId)) return 0;
  const set = onlineUsers.get(userId);
  set.delete(socketId);
  if (set.size === 0) {
    onlineUsers.delete(userId);
    return 0;
  }
  return set.size;
};

const isUserOnline = (userId) => onlineUsers.has(userId.toString());

const broadcastPresence = async (io, userId, isOnline, lastSeen = null) => {
  try {
    const user = await User.findById(userId).select(
      "username avatar isOnline lastSeen privacy",
    );
    if (!user) return;

    const contacts = await getUserContacts(userId);

    for (const contactId of contacts) {
      if (!canSeePresence(user, contactId, true)) continue;

      io.to(contactId).emit(isOnline ? "userOnline" : "userOffline", {
        userId: user._id,
        isOnline,
        lastSeen: isOnline ? null : lastSeen || user.lastSeen,
      });
    }
  } catch (err) {
    logger.error("broadcastPresence error", { err: err.message });
  }
};

// ⭐ حفظ سجل المكالمة + بث الحدث
const saveCallLog = async (callData, io) => {
  try {
    const {
      callerId,
      receiverId,
      callType,
      status,
      startedAt,
      endedAt,
      duration,
      endedById,
    } = callData;

    const log = await CallLog.create({
      caller: callerId,
      receiver: receiverId,
      callType,
      status,
      startedAt: startedAt || new Date(),
      endedAt: endedAt || null,
      duration: duration || 0,
      endedBy: endedById || null,
    });

    if (io) {
      const populated = await CallLog.findById(log._id)
        .populate("caller", "username avatar")
        .populate("receiver", "username avatar")
        .populate("endedBy", "username");

      const baseData = populated.toObject();

      io.to(callerId.toString()).emit("callLogAdded", {
        ...baseData,
        direction: "outgoing",
      });

      io.to(receiverId.toString()).emit("callLogAdded", {
        ...baseData,
        direction: "incoming",
      });
    }

    return log;
  } catch (err) {
    logger.error("saveCallLog error", { err: err.message });
    return null;
  }
};

export const initSocket = (io) => {
  logger.info("📦 Socket.IO: using in-memory adapter (single instance)");

  io.on("connection", (socket) => {
    logger.info(`🔌 Socket connected: ${socket.id}`);

    // ============ Setup ============
    socket.on("setup", async (userId) => {
      if (!userId) return;

      socket.userId = userId;
      socket.join(userId);

      const wasOffline = !isUserOnline(userId);
      addSocket(userId, socket.id);

      if (wasOffline) {
        await User.findByIdAndUpdate(userId, { isOnline: true });
        await broadcastPresence(io, userId, true);
      }

      const contacts = await getUserContacts(userId);
      const contactsData = await User.find({
        _id: { $in: contacts },
      }).select("_id isOnline lastSeen privacy");

      const statuses = contactsData
        .filter((c) => canSeePresence(c, userId, true))
        .map((c) => ({
          userId: c._id,
          isOnline: c.isOnline,
          lastSeen: c.lastSeen,
        }));

      socket.emit("contactsStatus", statuses);

      logger.info(
        `👤 User ${userId} online (sockets: ${onlineUsers.get(userId).size})`,
      );
    });

    // ============ Conversations ============
    socket.on("joinConversation", (conversationId) => {
      socket.join(conversationId);
    });

    socket.on("leaveConversation", (conversationId) => {
      socket.leave(conversationId);
    });

    // ============ Typing ============
    socket.on("typing", ({ conversationId, userId, username }) => {
      socket.to(conversationId).emit("typing", { userId, username });
    });

    socket.on("stopTyping", ({ conversationId, userId }) => {
      socket.to(conversationId).emit("stopTyping", { userId });
    });

    // ============ Messages Status ============

    socket.on("messageDelivered", async ({ messageIds, userId }) => {
      if (!Array.isArray(messageIds)) return;

      const messages = await Message.find({ _id: { $in: messageIds } });

      for (const message of messages) {
        if (!message.sender) continue;
        if (message.sender.toString() === userId) continue;

        if (!message.deliveredTo.some((id) => id.toString() === userId)) {
          message.deliveredTo.push(userId);
          await message.save();

          io.to(message.sender.toString()).emit("messageDelivered", {
            messageId: message._id,
            conversationId: message.conversation,
            deliveredTo: userId,
            deliveredAt: new Date(),
          });
        }
      }
    });

    socket.on("messageRead", async ({ messageIds, userId }) => {
      if (!Array.isArray(messageIds)) return;

      const messages = await Message.find({ _id: { $in: messageIds } });

      const me = await User.findById(userId).select("privacy");
      const readReceiptsEnabled = me?.privacy?.readReceipts !== false;

      for (const message of messages) {
        if (!message.sender) continue;
        if (message.sender.toString() === userId) continue;

        let changed = false;

        if (!message.deliveredTo.some((id) => id.toString() === userId)) {
          message.deliveredTo.push(userId);
          changed = true;
        }
        if (!message.readBy.some((id) => id.toString() === userId)) {
          message.readBy.push(userId);
          changed = true;
        }

        if (changed) {
          await message.save();
          if (readReceiptsEnabled) {
            io.to(message.sender.toString()).emit("messageRead", {
              messageId: message._id,
              conversationId: message.conversation,
              readBy: userId,
              readAt: new Date(),
            });
          }
        }
      }
    });

    socket.on("conversationOpened", async ({ conversationId, userId }) => {
      const unread = await Message.find({
        conversation: conversationId,
        sender: { $ne: userId },
        readBy: { $ne: userId },
        isDeleted: false,
      });

      await resetUnreadCount(conversationId, userId);

      io.to(userId).emit("unreadCountUpdated", {
        conversationId,
        unreadCount: 0,
      });

      if (unread.length === 0) return;

      const ids = unread.map((m) => m._id);

      await Message.updateMany(
        { _id: { $in: ids } },
        { $addToSet: { readBy: userId, deliveredTo: userId } },
      );

      const me = await User.findById(userId).select("privacy");
      const readReceiptsEnabled = me?.privacy?.readReceipts !== false;

      if (readReceiptsEnabled) {
        const senderIds = [
          ...new Set(
            unread.filter((m) => m.sender).map((m) => m.sender.toString()),
          ),
        ];

        for (const senderId of senderIds) {
          io.to(senderId).emit("messagesRead", {
            conversationId,
            readBy: userId,
            messageIds: ids,
            readAt: new Date(),
          });
        }
      }
    });

    // ============ 1-to-1 Calls ============

    socket.on("callUser", async ({ to, from, signal, callType }) => {
      if (!to || !from || !signal) return;

      if (!isUserOnline(to)) {
        await saveCallLog(
          {
            callerId: from,
            receiverId: to,
            callType: callType || "voice",
            status: "missed",
            startedAt: new Date(),
            endedAt: new Date(),
            duration: 0,
            endedById: from,
          },
          io,
        );

        socket.emit("callFailed", {
          reason: "USER_OFFLINE",
          message: "User is offline",
        });
        return;
      }

      for (const [callId, call] of activeCalls.entries()) {
        const involvesTarget = call.callerId === to || call.receiverId === to;
        if (involvesTarget) {
          socket.emit("callFailed", {
            reason: "USER_BUSY",
            message: "User is busy on another call",
          });
          return;
        }
      }

      for (const [groupCallId, call] of activeGroupCalls.entries()) {
        const involvesTarget = call.participants.some(
          (p) => p.toString() === to,
        );
        if (involvesTarget) {
          socket.emit("callFailed", {
            reason: "USER_BUSY",
            message: "User is in a group call",
          });
          return;
        }
      }

      const callId = `${from}-${to}-${Date.now()}`;

      activeCalls.set(callId, {
        callId,
        callerId: from,
        receiverId: to,
        callType: callType || "voice",
        startedAt: new Date(),
        answeredAt: null,
        callerSocketId: socket.id,
      });

      const callerUser = await User.findById(from).select("username avatar");

      io.to(to).emit("incomingCall", {
        callId,
        from,
        callerUser,
        signal,
        callType: callType || "voice",
      });

      socket.emit("callRinging", { callId });

      try {
        await sendNotificationToUser(to, {
          title: callerUser?.username || "مكالمة واردة",
          body:
            callType === "video"
              ? "📹 مكالمة مرئية واردة"
              : "📞 مكالمة صوتية واردة",
          data: {
            type: "incoming_call",
            callId,
            callerId: from,
            callerName: callerUser?.username || "Unknown",
            callType: callType || "voice",
            link: `/chat/${from}`,
          },
        });
        logger.info(`🔔 Push notification sent to ${to}`);
      } catch (err) {
        logger.error("Failed to send call notification", {
          to,
          err: err.message,
        });
      }

      logger.info(`📞 Call started: ${from} → ${to} (${callType})`);
    });

    socket.on("answerCall", async ({ to, callId, signal }) => {
      const call = activeCalls.get(callId);
      if (!call) return;

      call.answeredAt = new Date();

      io.to(to).emit("callAccepted", {
        callId,
        signal,
        answeredAt: call.answeredAt,
      });

      logger.info(`✅ Call answered: ${callId}`);
    });

    socket.on("rejectCall", async ({ to, callId, from }) => {
      const call = activeCalls.get(callId);

      if (call) {
        await saveCallLog(
          {
            callerId: call.callerId,
            receiverId: call.receiverId,
            callType: call.callType,
            status: "rejected",
            startedAt: call.startedAt,
            endedAt: new Date(),
            duration: 0,
            endedById: from,
          },
          io,
        );

        activeCalls.delete(callId);
      }

      io.to(to).emit("callRejected", { callId });

      logger.info(`❌ Call rejected: ${callId}`);
    });

    socket.on("iceCandidate", ({ to, candidate, callId }) => {
      io.to(to).emit("iceCandidate", { candidate, callId });
    });

    socket.on("endCall", async ({ to, callId, from }) => {
      let call = activeCalls.get(callId);
      let actualCallId = callId;

      if (!call) {
        for (const [id, c] of activeCalls.entries()) {
          if (c.callerId === from || c.receiverId === from) {
            call = c;
            actualCallId = id;
            logger.warn(`⚠️ Call found by fallback search: ${id}`);
            break;
          }
        }
      }

      if (call) {
        const endedAt = new Date();
        const duration = call.answeredAt
          ? Math.floor((endedAt - call.answeredAt) / 1000)
          : 0;

        await saveCallLog(
          {
            callerId: call.callerId,
            receiverId: call.receiverId,
            callType: call.callType,
            status: call.answeredAt ? "ended" : "missed",
            startedAt: call.startedAt,
            endedAt,
            duration,
            endedById: from,
          },
          io,
        );

        activeCalls.delete(actualCallId);

        logger.info(`📴 Call ended: ${actualCallId} (duration: ${duration}s)`);
      } else {
        logger.warn(`⚠️ endCall: no active call found for ${from}`);
      }

      io.to(to).emit("callEnded", { callId: actualCallId });
    });

    socket.on("busyCall", async ({ to, callId, from }) => {
      const call = activeCalls.get(callId);

      if (call) {
        await saveCallLog(
          {
            callerId: call.callerId,
            receiverId: call.receiverId,
            callType: call.callType,
            status: "missed",
            startedAt: call.startedAt,
            endedAt: new Date(),
            duration: 0,
            endedById: from,
          },
          io,
        );

        activeCalls.delete(callId);
      }

      io.to(to).emit("callBusy", { callId });
    });

    // ============ Group Calls (Mesh) ============

    socket.on("startGroupCall", async ({ conversationId, callType, from }) => {
      if (!conversationId || !from) return;

      try {
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.isGroup) {
          socket.emit("groupCallFailed", {
            reason: "INVALID_CONVERSATION",
            message: "Group not found",
          });
          return;
        }

        const isMember = conversation.participants.some(
          (p) => p.toString() === from.toString(),
        );
        if (!isMember) {
          socket.emit("groupCallFailed", {
            reason: "NOT_A_MEMBER",
            message: "You are not a member",
          });
          return;
        }

        const existingCallId = `${conversationId}-group`;
        if (activeGroupCalls.has(existingCallId)) {
          socket.emit("groupCallFailed", {
            reason: "CALL_IN_PROGRESS",
            message: "A group call is already in progress",
          });
          return;
        }

        const initiator = await User.findById(from).select("username avatar");

        const groupCallId = `${conversationId}-group-${Date.now()}`;

        activeGroupCalls.set(groupCallId, {
          groupCallId,
          conversationId,
          participants: [from],
          callType: callType || "voice",
          startedAt: new Date(),
          initiator: from,
        });

        const otherParticipants = conversation.participants.filter(
          (p) => p.toString() !== from.toString(),
        );

        for (const participantId of otherParticipants) {
          io.to(participantId.toString()).emit("incomingGroupCall", {
            groupCallId,
            conversationId,
            conversationName: conversation.name,
            conversationAvatar: conversation.groupAvatar,
            from,
            initiator,
            callType: callType || "voice",
          });
        }

        socket.emit("groupCallStarted", {
          groupCallId,
          conversationId,
          callType: callType || "voice",
          startedAt: activeGroupCalls.get(groupCallId).startedAt,
        });

        logger.info(
          `👥 Group call started: ${groupCallId} by ${from} (${callType})`,
        );
      } catch (err) {
        logger.error("startGroupCall error", { err: err.message });
        socket.emit("groupCallFailed", {
          reason: "INTERNAL_ERROR",
          message: err.message,
        });
      }
    });

    socket.on("joinGroupCall", async ({ groupCallId, userId }) => {
      if (!groupCallId || !userId) return;

      const call = activeGroupCalls.get(groupCallId);

      if (!call) {
        socket.emit("groupCallFailed", {
          reason: "CALL_NOT_FOUND",
          message: "Call ended or not found",
        });
        return;
      }

      if (call.participants.length >= 4) {
        socket.emit("groupCallFailed", {
          reason: "CALL_FULL",
          message: "Group call is full (max 4 participants)",
        });
        return;
      }

      const alreadyIn = call.participants.some(
        (p) => p.toString() === userId.toString(),
      );
      if (!alreadyIn) {
        call.participants.push(userId);
      }

      const newUser = await User.findById(userId).select("username avatar");

      const existingParticipants = call.participants
        .filter((p) => p.toString() !== userId.toString())
        .map((p) => p.toString());

      const participantsData = await User.find({
        _id: { $in: existingParticipants },
      }).select("username avatar _id");

      socket.emit("groupCallParticipants", {
        groupCallId,
        participants: participantsData,
      });

      for (const participantId of existingParticipants) {
        io.to(participantId).emit("userJoinedGroupCall", {
          groupCallId,
          user: newUser,
        });
      }

      logger.info(
        `👥 User ${userId} joined group call ${groupCallId} (${call.participants.length} total)`,
      );
    });

    socket.on("groupCallOffer", ({ groupCallId, to, from, signal }) => {
      io.to(to).emit("groupCallOffer", {
        groupCallId,
        from,
        signal,
      });
    });

    socket.on("groupCallAnswer", ({ groupCallId, to, from, signal }) => {
      io.to(to).emit("groupCallAnswer", {
        groupCallId,
        from,
        signal,
      });
    });

    socket.on(
      "groupCallIceCandidate",
      ({ groupCallId, to, from, candidate }) => {
        io.to(to).emit("groupCallIceCandidate", {
          groupCallId,
          from,
          candidate,
        });
      },
    );

    socket.on("leaveGroupCall", async ({ groupCallId, userId }) => {
      const call = activeGroupCalls.get(groupCallId);
      if (!call) return;

      call.participants = call.participants.filter(
        (p) => p.toString() !== userId.toString(),
      );

      for (const participantId of call.participants) {
        io.to(participantId.toString()).emit("userLeftGroupCall", {
          groupCallId,
          userId,
        });
      }

      if (call.participants.length === 0) {
        activeGroupCalls.delete(groupCallId);
        logger.info(`👥 Group call ended: ${groupCallId} (empty)`);
      } else if (call.participants.length === 1) {
        const lastUserId = call.participants[0].toString();
        io.to(lastUserId).emit("groupCallEnded", {
          groupCallId,
          reason: "ALL_LEFT",
        });
        activeGroupCalls.delete(groupCallId);
        logger.info(`👥 Group call ended: ${groupCallId} (only one left)`);
      }
    });

    socket.on("endGroupCall", ({ groupCallId, userId }) => {
      const call = activeGroupCalls.get(groupCallId);
      if (!call) return;

      for (const participantId of call.participants) {
        io.to(participantId.toString()).emit("groupCallEnded", {
          groupCallId,
          reason: "ENDED_BY_USER",
          endedBy: userId,
        });
      }

      activeGroupCalls.delete(groupCallId);
      logger.info(`👥 Group call ended: ${groupCallId} by ${userId}`);
    });

    socket.on("rejectGroupCall", ({ groupCallId, userId }) => {
      const call = activeGroupCalls.get(groupCallId);
      if (!call) return;

      io.to(call.initiator.toString()).emit("groupCallRejected", {
        groupCallId,
        userId,
      });
    });

    // ============ Disconnect ============
    socket.on("disconnect", async () => {
      if (socket.userId) {
        const remaining = removeSocket(socket.userId, socket.id);

        if (remaining === 0) {
          const lastSeen = new Date();
          await User.findByIdAndUpdate(socket.userId, {
            isOnline: false,
            lastSeen,
          });
          await broadcastPresence(io, socket.userId, false, lastSeen);
        }

        for (const [callId, call] of activeCalls.entries()) {
          if (call.callerId === socket.userId) {
            io.to(call.receiverId).emit("callEnded", { callId });

            const endedAt = new Date();
            const duration = call.answeredAt
              ? Math.floor((endedAt - call.answeredAt) / 1000)
              : 0;

            await saveCallLog(
              {
                callerId: call.callerId,
                receiverId: call.receiverId,
                callType: call.callType,
                status: call.answeredAt ? "ended" : "missed",
                startedAt: call.startedAt,
                endedAt,
                duration,
                endedById: call.callerId,
              },
              io,
            );

            activeCalls.delete(callId);
          } else if (call.receiverId === socket.userId) {
            io.to(call.callerId).emit("callEnded", { callId });

            const endedAt = new Date();
            const duration = call.answeredAt
              ? Math.floor((endedAt - call.answeredAt) / 1000)
              : 0;

            await saveCallLog(
              {
                callerId: call.callerId,
                receiverId: call.receiverId,
                callType: call.callType,
                status: call.answeredAt ? "ended" : "missed",
                startedAt: call.startedAt,
                endedAt,
                duration,
                endedById: call.receiverId,
              },
              io,
            );

            activeCalls.delete(callId);
          }
        }

        for (const [groupCallId, call] of activeGroupCalls.entries()) {
          const wasParticipant = call.participants.some(
            (p) => p.toString() === socket.userId,
          );

          if (wasParticipant) {
            call.participants = call.participants.filter(
              (p) => p.toString() !== socket.userId,
            );

            for (const participantId of call.participants) {
              io.to(participantId.toString()).emit("userLeftGroupCall", {
                groupCallId,
                userId: socket.userId,
              });
            }

            if (call.participants.length === 0) {
              activeGroupCalls.delete(groupCallId);
              logger.info(
                `👥 Group call ended: ${groupCallId} (empty on disconnect)`,
              );
            } else if (call.participants.length === 1) {
              const lastUserId = call.participants[0].toString();
              io.to(lastUserId).emit("groupCallEnded", {
                groupCallId,
                reason: "ALL_LEFT",
              });
              activeGroupCalls.delete(groupCallId);
            }
          }
        }

        logger.info(
          `❌ Socket disconnected: ${socket.id} (user: ${socket.userId}, remaining: ${remaining})`,
        );
      } else {
        logger.info(`❌ Socket disconnected: ${socket.id} (no user)`);
      }
    });
  });
};
