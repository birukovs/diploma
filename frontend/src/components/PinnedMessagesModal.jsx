import { XIcon } from "lucide-react";

/**
 * Build a summary string for a pinned message.
 * Handles polls, images, files, videos, and text.
 */
function buildPinnedSummary(message) {
  // Check for poll
  const poll = message?.poll || message?.poll_data;
  const pollId = message?.poll_id || message?.pollId;
  if (poll || pollId) {
    const question = poll?.name || poll?.question || poll?.title || "";
    return question ? `📊 Опрос: ${question}` : "📊 Опрос";
  }

  // Check attachments
  const attachments = message?.attachments ?? [];
  if (attachments.length > 0) {
    const first = attachments[0];
    const mimeType = first?.mime_type || first?.mimeType || "";
    const type = first?.type || "";
    const filename = first?.title || first?.name || first?.fallback || "";

    // Image
    if (type === "image" || mimeType.startsWith("image/")) {
      return filename ? `🖼️ Фото: ${filename}` : "🖼️ Фото";
    }

    // Video
    if (type === "video" || mimeType.startsWith("video/")) {
      return filename ? `🎬 Видео: ${filename}` : "🎬 Видео";
    }

    // File/document
    if (type === "file" || mimeType) {
      return filename ? `📎 Файл: ${filename}` : "📎 Файл";
    }
  }

  // Text message
  if (message?.text) {
    const text = message.text.trim();
    if (text.length > 80) {
      return text.slice(0, 80) + "…";
    }
    return text;
  }

  // Fallback
  return "📌 Сообщение";
}

function PinnedMessagesModal({ pinnedMessages, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className="rounded-xl shadow-2xl w-full max-w-lg mx-4 bg-[#0f1116] border border-[#e21a1a]"
        data-ui="pinned-list-v1"
      >
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-[#e21a1a]/50 px-6 py-4">
          <h2 className="text-2xl font-semibold text-white">Закрепленные сообщения</h2>
          <button onClick={onClose} className="text-2xl text-gray-300 hover:text-white">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* MESSAGES LIST */}
        <div className="px-6 py-4 max-h-96 overflow-y-auto">
          {pinnedMessages.map((msg) => {
            const summary = buildPinnedSummary(msg);

            return (
              <div
                key={msg.id}
                className="flex items-start gap-3 py-4 border-b border-[#e21a1a]/25 last:border-b-0 text-white"
              >
                <img
                  src={msg.user?.image || ""}
                  alt={msg.user?.name || "User"}
                  className="w-9 h-9 rounded-full object-cover mt-1 shrink-0"
                />

                <div className="flex flex-col min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white mb-1">
                    {msg.user?.name || "Unknown"}
                  </div>
                  <div
                    className="text-base text-gray-200 whitespace-nowrap overflow-hidden text-ellipsis"
                    title={summary}
                  >
                    {summary}
                  </div>
                </div>
              </div>
            );
          })}

          {pinnedMessages.length === 0 && (
            <div className="text-center text-gray-400 py-8">Нет закрепленных сообщений</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PinnedMessagesModal;