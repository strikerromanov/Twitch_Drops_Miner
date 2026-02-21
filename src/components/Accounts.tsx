import { useEffect, useState } from "react";
import { Plus, Play, Square, RefreshCw, MoreVertical } from "lucide-react";

export default function Accounts() {
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then(setAccounts);
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Accounts</h1>
          <p className="text-[#a1a1aa] mt-1">
            Manage your connected Twitch accounts.
          </p>
        </div>
        <button className="flex items-center gap-2 bg-[#9146FF] hover:bg-[#772ce8] text-white px-4 py-2 rounded-lg font-medium transition-colors">
          <Plus size={18} />
          Add Account
        </button>
      </header>

      <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 gap-4 p-4 border-b border-[#27272a] bg-[#18181b]/50">
          <div className="col-span-3 col-header">Username</div>
          <div className="col-span-2 col-header">Status</div>
          <div className="col-span-3 col-header">Current Target</div>
          <div className="col-span-2 col-header text-right">Points</div>
          <div className="col-span-2 col-header text-right">Actions</div>
        </div>

        <div className="divide-y divide-[#27272a]">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-[#27272a]/30 transition-colors"
            >
              <div className="col-span-3 font-medium flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#9146FF] to-purple-400 flex items-center justify-center text-xs font-bold">
                  {acc.username.substring(0, 2).toUpperCase()}
                </div>
                {acc.username}
              </div>
              <div className="col-span-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                    acc.status === "farming"
                      ? "bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20"
                      : "bg-[#a1a1aa]/10 text-[#a1a1aa] border-[#a1a1aa]/20"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${acc.status === "farming" ? "bg-[#10b981]" : "bg-[#a1a1aa]"}`}
                  ></span>
                  {acc.status.toUpperCase()}
                </span>
              </div>
              <div className="col-span-3 text-[#a1a1aa] flex items-center gap-2">
                {acc.currentTarget ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    twitch.tv/{acc.currentTarget}
                  </>
                ) : (
                  "—"
                )}
              </div>
              <div className="col-span-2 text-right data-value text-[#fafafa]">
                {acc.points.toLocaleString()}
              </div>
              <div className="col-span-2 flex items-center justify-end gap-2">
                <button className="p-1.5 text-[#a1a1aa] hover:text-white hover:bg-[#27272a] rounded">
                  {acc.status === "farming" ? (
                    <Square size={16} />
                  ) : (
                    <Play size={16} />
                  )}
                </button>
                <button className="p-1.5 text-[#a1a1aa] hover:text-white hover:bg-[#27272a] rounded">
                  <RefreshCw size={16} />
                </button>
                <button className="p-1.5 text-[#a1a1aa] hover:text-white hover:bg-[#27272a] rounded">
                  <MoreVertical size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
