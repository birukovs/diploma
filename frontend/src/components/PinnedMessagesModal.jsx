import { XIcon } from "lucide-react";

function PinnedMessagesModal({ pinnedMessages, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="rounded-xl shadow-2xl w-full max-w-lg mx-4 bg-[#0f1116] border border-[#e21a1a]">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-[#e21a1a]/50 px-6 py-4">
          <h2 className="text-2xl font-semibold text-white">Закрепленные сообщения</h2>
          <button onClick={onClose} className="text-2xl text-gray-300 hover:text-white">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* MESSAGES LIST */}
        <div className="px-6 py-4 max-h-96 overflow-y-auto">
          {pinnedMessages.map((msg) => (
            <div key={msg.id} className="flex items-start gap-3 py-4 border-b border-[#e21a1a]/25 last:border-b-0 text-white">
              <img
                src={msg.user.image}
                alt={msg.user.name}
                className="w-9 h-9 rounded-full object-cover mt-1"
              />

              <div className="text-sm font-semibold text-white mb-1">{msg.user.name}</div>
              <div className="text-base text-gray-200 whitespace-pre-line">{msg.text}</div>
            </div>
          ))}

          {pinnedMessages.length === 0 && (
            <div className="text-center text-gray-400 py-8">Нет закрепленных сообщений</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PinnedMessagesModal;